"""
Agent API routes
"""
import json
import uuid
from flask import Blueprint, request, jsonify
from services.ai_agent import chat
from services.embeddings import generate_embedding
from services.vector_store import search, search_by_documents
from models.chunk import get_chunks_by_ids
from database import get_cursor

bp = Blueprint('agent', __name__, url_prefix='/api/agent')


@bp.route('/chat', methods=['POST'])
def agent_chat():
    """Chat with the AI agent"""
    try:
        data = request.get_json()
        user_query = data.get('query')
        conversation_id = data.get('conversationId')
        document_ids = data.get('documentIds')
        chunk_limit = data.get('chunkLimit', 5)

        if not user_query:
            return jsonify({'error': True, 'message': 'Query is required'}), 400

        # Get or create conversation
        conv_id = conversation_id
        conversation_history = []

        with get_cursor() as cursor:
            if conv_id:
                # Load existing conversation
                cursor.execute(
                    'SELECT role, content FROM conversation_messages WHERE conversation_id = %s ORDER BY created_at',
                    (conv_id,)
                )
                conversation_history = cursor.fetchall()
            else:
                # Create new conversation
                session_id = str(uuid.uuid4())
                cursor.execute(
                    'INSERT INTO conversations (session_id) VALUES (%s)',
                    (session_id,)
                )
                conv_id = cursor.lastrowid

        # Retrieve relevant chunks
        query_vector = generate_embedding(user_query)

        if document_ids and len(document_ids) > 0:
            search_results = search_by_documents(query_vector, document_ids, chunk_limit)
        else:
            search_results = search(query_vector, chunk_limit)

        # Get full chunk data
        chunk_ids = [r['payload']['chunk_id'] for r in search_results]
        chunks = get_chunks_by_ids(chunk_ids)

        # Format chunks for the agent
        formatted_chunks = []
        for result in search_results:
            chunk = next((c for c in chunks if c['id'] == result['payload']['chunk_id']), None)
            formatted_chunks.append({
                'id': chunk['id'] if chunk else None,
                'document_id': chunk['document_id'] if chunk else None,
                'document_name': chunk.get('document_name') or result['payload'].get('document_name') if chunk else result['payload'].get('document_name'),
                'hierarchy_path': chunk.get('hierarchy_path') or result['payload'].get('hierarchy_path') if chunk else result['payload'].get('hierarchy_path'),
                'content': chunk['content'] if chunk else result['payload'].get('text_preview'),
                'score': result['score']
            })

        # Call the AI agent
        agent_response = chat(user_query, conversation_history, formatted_chunks)

        with get_cursor() as cursor:
            # Save user message
            cursor.execute(
                'INSERT INTO conversation_messages (conversation_id, role, content) VALUES (%s, %s, %s)',
                (conv_id, 'user', user_query)
            )

            # Save assistant message
            cursor.execute(
                '''INSERT INTO conversation_messages (conversation_id, role, content, chunks_used, citations)
                   VALUES (%s, %s, %s, %s, %s)''',
                (
                    conv_id,
                    'assistant',
                    agent_response['response'],
                    json.dumps(agent_response['chunksUsed']),
                    json.dumps(agent_response['citations'])
                )
            )

            # Update conversation timestamp
            cursor.execute(
                'UPDATE conversations SET updated_at = NOW() WHERE id = %s',
                (conv_id,)
            )

            # Save to query history
            cursor.execute(
                '''INSERT INTO query_history (query_text, chunks_retrieved, chunk_ids, agent_response, response_time_ms, tokens_used)
                   VALUES (%s, %s, %s, %s, %s, %s)''',
                (
                    user_query,
                    len(formatted_chunks),
                    json.dumps(chunk_ids),
                    agent_response['response'],
                    agent_response['responseTimeMs'],
                    agent_response['tokensUsed']
                )
            )

        return jsonify({
            'conversationId': conv_id,
            'response': agent_response['response'],
            'citations': agent_response['citations'],
            'chunksUsed': formatted_chunks,
            'responseTimeMs': agent_response['responseTimeMs'],
            'tokensUsed': agent_response['tokensUsed']
        })

    except Exception as e:
        print(f"Agent chat error: {e}")
        return jsonify({'error': True, 'message': str(e)}), 500


@bp.route('/conversations', methods=['GET'])
def list_conversations():
    """List recent conversations"""
    try:
        limit = request.args.get('limit', 20, type=int)
        offset = request.args.get('offset', 0, type=int)

        with get_cursor() as cursor:
            cursor.execute(
                '''SELECT c.*,
                    (SELECT content FROM conversation_messages WHERE conversation_id = c.id AND role = 'user' ORDER BY created_at LIMIT 1) as first_message,
                    (SELECT COUNT(*) FROM conversation_messages WHERE conversation_id = c.id) as message_count
                   FROM conversations c
                   ORDER BY c.updated_at DESC
                   LIMIT %s OFFSET %s''',
                (limit, offset)
            )
            conversations = cursor.fetchall()

        return jsonify({'conversations': conversations})

    except Exception as e:
        print(f"Get conversations error: {e}")
        return jsonify({'error': True, 'message': str(e)}), 500


@bp.route('/conversations/<int:conv_id>', methods=['GET'])
def get_conversation(conv_id):
    """Get conversation history"""
    try:
        with get_cursor() as cursor:
            cursor.execute(
                'SELECT * FROM conversations WHERE id = %s',
                (conv_id,)
            )
            conversation = cursor.fetchone()

            if not conversation:
                return jsonify({'error': True, 'message': 'Conversation not found'}), 404

            cursor.execute(
                'SELECT * FROM conversation_messages WHERE conversation_id = %s ORDER BY created_at',
                (conv_id,)
            )
            messages = cursor.fetchall()

        return jsonify({
            'conversation': conversation,
            'messages': messages
        })

    except Exception as e:
        print(f"Get conversation error: {e}")
        return jsonify({'error': True, 'message': str(e)}), 500


@bp.route('/conversations/<int:conv_id>', methods=['DELETE'])
def delete_conversation(conv_id):
    """Delete a conversation"""
    try:
        with get_cursor() as cursor:
            cursor.execute(
                'DELETE FROM conversations WHERE id = %s',
                (conv_id,)
            )
            affected = cursor.rowcount

        if affected == 0:
            return jsonify({'error': True, 'message': 'Conversation not found'}), 404

        return jsonify({'success': True})

    except Exception as e:
        print(f"Delete conversation error: {e}")
        return jsonify({'error': True, 'message': str(e)}), 500


@bp.route('/history', methods=['GET'])
def query_history():
    """Get query history"""
    try:
        limit = request.args.get('limit', 50, type=int)
        offset = request.args.get('offset', 0, type=int)

        with get_cursor() as cursor:
            cursor.execute(
                'SELECT * FROM query_history ORDER BY created_at DESC LIMIT %s OFFSET %s',
                (limit, offset)
            )
            history = cursor.fetchall()

        return jsonify({'history': history})

    except Exception as e:
        print(f"Get history error: {e}")
        return jsonify({'error': True, 'message': str(e)}), 500


@bp.route('/feedback', methods=['POST'])
def submit_feedback():
    """Submit feedback for a query"""
    try:
        data = request.get_json()
        query_id = data.get('queryId')
        rating = data.get('rating')
        feedback = data.get('feedback')

        if not query_id:
            return jsonify({'error': True, 'message': 'queryId is required'}), 400

        with get_cursor() as cursor:
            cursor.execute(
                'UPDATE query_history SET user_rating = %s, user_feedback = %s WHERE id = %s',
                (rating, feedback, query_id)
            )

        return jsonify({'success': True})

    except Exception as e:
        print(f"Submit feedback error: {e}")
        return jsonify({'error': True, 'message': str(e)}), 500
