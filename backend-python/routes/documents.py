"""
Documents API routes
"""
import os
import uuid
from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename
from config import Config
from models.document import (
    create_document, get_document_by_id, get_all_documents,
    update_document_status, delete_document, get_document_stats,
    save_document_styles, get_document_styles, update_document_style_config,
    DocumentStatus
)
from models.chunk import (
    create_chunk, get_chunk_count_by_document, delete_chunks_by_document_id,
    update_chunk_vector
)
from services.document_parser import parse_document_structured, analyze_document_styles
from services.chunker import chunk_document, get_chunking_stats
from services.embeddings import generate_embeddings_batched, get_embedding_info
from services.vector_store import upsert_vectors, delete_by_document_id, is_qdrant_available

bp = Blueprint('documents', __name__, url_prefix='/api/documents')


def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() == 'docx'


@bp.route('/upload', methods=['POST'])
def upload_documents():
    """Upload one or more documents"""
    try:
        if 'files' not in request.files:
            return jsonify({'error': True, 'message': 'No files uploaded'}), 400

        files = request.files.getlist('files')
        if not files or files[0].filename == '':
            return jsonify({'error': True, 'message': 'No files uploaded'}), 400

        documents = []

        for file in files:
            if not allowed_file(file.filename):
                return jsonify({'error': True, 'message': 'Only .docx files are allowed'}), 400

            # Generate unique filename
            original_name = secure_filename(file.filename)
            ext = os.path.splitext(original_name)[1]
            unique_name = f"{uuid.uuid4()}{ext}"
            file_path = Config.UPLOADS_DIR / unique_name

            # Save file
            file.save(str(file_path))
            file_size = os.path.getsize(str(file_path))

            # Create document record
            doc_id = create_document(unique_name, original_name, file_size)

            documents.append({
                'id': doc_id,
                'filename': unique_name,
                'originalName': original_name,
                'size': file_size
            })

        return jsonify({'success': True, 'documents': documents})

    except Exception as e:
        print(f"Upload error: {e}")
        return jsonify({'error': True, 'message': str(e)}), 500


@bp.route('/', methods=['GET'])
def list_documents():
    """List all documents"""
    try:
        status = request.args.get('status')
        limit = int(request.args.get('limit', 100))
        offset = int(request.args.get('offset', 0))

        documents = get_all_documents(status, limit, offset)

        # Get chunk counts for each document
        docs_with_counts = []
        for doc in documents:
            chunk_count = get_chunk_count_by_document(doc['id'])
            doc['chunkCount'] = chunk_count
            docs_with_counts.append(doc)

        return jsonify({'documents': docs_with_counts})

    except Exception as e:
        print(f"Get documents error: {e}")
        return jsonify({'error': True, 'message': str(e)}), 500


@bp.route('/stats', methods=['GET'])
def document_stats():
    """Get document statistics"""
    try:
        stats = get_document_stats()
        return jsonify(stats)
    except Exception as e:
        print(f"Get stats error: {e}")
        return jsonify({'error': True, 'message': str(e)}), 500


@bp.route('/<int:doc_id>', methods=['GET'])
def get_document(doc_id):
    """Get document by ID"""
    try:
        doc = get_document_by_id(doc_id)

        if not doc:
            return jsonify({'error': True, 'message': 'Document not found'}), 404

        chunk_count = get_chunk_count_by_document(doc['id'])
        styles = get_document_styles(doc['id'])

        return jsonify({
            **doc,
            'chunkCount': chunk_count,
            'styles': styles
        })

    except Exception as e:
        print(f"Get document error: {e}")
        return jsonify({'error': True, 'message': str(e)}), 500


@bp.route('/<int:doc_id>/analyze-styles', methods=['POST'])
def analyze_styles(doc_id):
    """Analyze and detect styles in a document"""
    try:
        doc = get_document_by_id(doc_id)

        if not doc:
            return jsonify({'error': True, 'message': 'Document not found'}), 404

        file_path = Config.UPLOADS_DIR / doc['filename']
        detected_styles = analyze_document_styles(str(file_path))

        # Save styles to database
        save_document_styles(doc_id, detected_styles)

        # Re-fetch from database to return consistent format
        styles = get_document_styles(doc_id)

        return jsonify({'success': True, 'styles': styles})

    except Exception as e:
        print(f"Analyze styles error: {e}")
        return jsonify({'error': True, 'message': str(e)}), 500


@bp.route('/<int:doc_id>/styles', methods=['GET'])
def get_styles(doc_id):
    """Get detected styles for a document"""
    try:
        styles = get_document_styles(doc_id)
        return jsonify({'styles': styles})
    except Exception as e:
        print(f"Get styles error: {e}")
        return jsonify({'error': True, 'message': str(e)}), 500


@bp.route('/<int:doc_id>/styles', methods=['PUT'])
def update_styles(doc_id):
    """Update style mappings for a document"""
    try:
        data = request.get_json()
        styles = data.get('styles', [])

        if not isinstance(styles, list):
            return jsonify({'error': True, 'message': 'styles must be an array'}), 400

        for style in styles:
            update_document_style_config(
                doc_id,
                style.get('styleName'),
                style.get('headingLevel')
            )

        return jsonify({'success': True})

    except Exception as e:
        print(f"Update styles error: {e}")
        return jsonify({'error': True, 'message': str(e)}), 500


@bp.route('/<int:doc_id>/process', methods=['POST'])
def process_document(doc_id):
    """Process document: parse, chunk, embed, and store"""
    try:
        doc = get_document_by_id(doc_id)

        if not doc:
            return jsonify({'error': True, 'message': 'Document not found'}), 404

        data = request.get_json() or {}
        style_mapping = data.get('styleMapping', {})
        chunk_size = data.get('chunkSize', 500)
        chunk_overlap = data.get('chunkOverlap', 1)

        # Update status to processing
        update_document_status(doc_id, DocumentStatus.PROCESSING)

        file_path = Config.UPLOADS_DIR / doc['filename']

        # Parse document
        parsed_doc = parse_document_structured(str(file_path))

        # Build style mapping from request or database
        final_style_mapping = style_mapping
        if not style_mapping:
            db_styles = get_document_styles(doc_id)
            for style in db_styles:
                if style.get('is_configured'):
                    if style.get('heading_level') == -1:
                        # Style marked as "ignore"
                        final_style_mapping[style['style_name']] = {
                            'headingLevel': None,
                            'isBodyText': False,
                            'isIgnored': True
                        }
                    elif style.get('heading_level') and style['heading_level'] > 0:
                        # Heading style
                        final_style_mapping[style['style_name']] = {
                            'headingLevel': style['heading_level'],
                            'isBodyText': False
                        }

        # Chunk document
        chunks = chunk_document(parsed_doc, final_style_mapping, {
            'maxChunkTokens': chunk_size,
            'overlapParagraphs': chunk_overlap
        })

        # Delete existing chunks for this document
        delete_chunks_by_document_id(doc_id)
        delete_by_document_id(doc_id)

        # Save chunks to database
        chunk_ids = []
        for chunk in chunks:
            chunk_id = create_chunk(
                document_id=doc_id,
                chunk_index=chunk['chunkIndex'],
                content=chunk['content'],
                content_length=chunk['contentLength'],
                token_estimate=chunk['tokenEstimate'],
                chunk_hash=chunk.get('chunkHash'),
                hierarchy_path=chunk.get('hierarchyPath'),
                hierarchy_json=chunk.get('hierarchyJson'),
                hierarchy_level=chunk.get('hierarchyLevel'),
                paragraph_start=chunk.get('paragraphStart'),
                paragraph_end=chunk.get('paragraphEnd')
            )
            chunk_ids.append(chunk_id)

        # Generate embeddings and store vectors
        vectors_created = False
        qdrant_available = is_qdrant_available()

        if qdrant_available:
            try:
                embedding_info = get_embedding_info()
                texts = [c['content'] for c in chunks]
                embeddings = generate_embeddings_batched(texts)

                if embeddings:
                    print(f"Generated {len(embeddings)} embeddings, dimension: {len(embeddings[0])}, expected: {embedding_info['dimension']}")

                # Store in vector database
                vector_points = []
                for idx, chunk in enumerate(chunks):
                    vector_points.append({
                        'id': chunk_ids[idx],
                        'vector': embeddings[idx],
                        'payload': {
                            'chunk_id': chunk_ids[idx],
                            'document_id': doc_id,
                            'document_name': doc['original_name'],
                            'hierarchy_path': chunk.get('hierarchyPath'),
                            'text_preview': chunk['content'][:200],
                            'token_count': chunk['tokenEstimate']
                        }
                    })

                vector_ids = upsert_vectors(vector_points)

                # Update chunks with vector IDs
                for i, chunk_id in enumerate(chunk_ids):
                    update_chunk_vector(chunk_id, vector_ids[i], embedding_info['model'])

                vectors_created = True

            except Exception as embedding_error:
                print(f"Failed to create embeddings: {embedding_error}")
        else:
            print("Qdrant not available, skipping embeddings")

        # Update document status
        update_document_status(doc_id, DocumentStatus.COMPLETED)

        stats = get_chunking_stats(chunks)

        return jsonify({
            'success': True,
            'documentId': doc_id,
            'chunksCreated': len(chunks),
            'vectorsCreated': vectors_created,
            'stats': stats
        })

    except Exception as e:
        print(f"Process document error: {e}")
        update_document_status(doc_id, DocumentStatus.ERROR, str(e))
        return jsonify({'error': True, 'message': str(e)}), 500


@bp.route('/<int:doc_id>/process-stream', methods=['POST'])
def process_document_stream(doc_id):
    """Process document with SSE progress updates"""
    from flask import Response
    import json

    def generate():
        def send_progress(stage, progress, message):
            data = json.dumps({'stage': stage, 'progress': progress, 'message': message})
            yield f"data: {data}\n\n"

        try:
            doc = get_document_by_id(doc_id)

            if not doc:
                yield f"data: {json.dumps({'stage': 'error', 'progress': 0, 'message': 'Document not found'})}\n\n"
                return

            data = request.get_json() or {}
            chunk_size = data.get('chunkSize', 500)
            chunk_overlap = data.get('chunkOverlap', 1)

            yield from send_progress('parsing', 5, 'Parsing document...')
            update_document_status(doc_id, DocumentStatus.PROCESSING)

            file_path = Config.UPLOADS_DIR / doc['filename']
            parsed_doc = parse_document_structured(str(file_path))

            yield from send_progress('parsing', 10, 'Building style mappings...')

            # Build style mapping from database
            final_style_mapping = {}
            db_styles = get_document_styles(doc_id)
            for style in db_styles:
                if style.get('is_configured'):
                    if style.get('heading_level') == -1:
                        final_style_mapping[style['style_name']] = {
                            'headingLevel': None,
                            'isBodyText': False,
                            'isIgnored': True
                        }
                    elif style.get('heading_level') and style['heading_level'] > 0:
                        final_style_mapping[style['style_name']] = {
                            'headingLevel': style['heading_level'],
                            'isBodyText': False
                        }

            yield from send_progress('chunking', 15, 'Chunking document...')

            chunks = chunk_document(parsed_doc, final_style_mapping, {
                'maxChunkTokens': chunk_size,
                'overlapParagraphs': chunk_overlap
            })

            yield from send_progress('chunking', 20, f'Created {len(chunks)} chunks')

            # Delete existing chunks
            delete_chunks_by_document_id(doc_id)
            delete_by_document_id(doc_id)

            yield from send_progress('saving', 25, 'Saving chunks to database...')

            # Save chunks to database
            chunk_ids = []
            for i, chunk in enumerate(chunks):
                chunk_id = create_chunk(
                    document_id=doc_id,
                    chunk_index=chunk['chunkIndex'],
                    content=chunk['content'],
                    content_length=chunk['contentLength'],
                    token_estimate=chunk['tokenEstimate'],
                    chunk_hash=chunk.get('chunkHash'),
                    hierarchy_path=chunk.get('hierarchyPath'),
                    hierarchy_json=chunk.get('hierarchyJson'),
                    hierarchy_level=chunk.get('hierarchyLevel'),
                    paragraph_start=chunk.get('paragraphStart'),
                    paragraph_end=chunk.get('paragraphEnd')
                )
                chunk_ids.append(chunk_id)

                if i % 10 == 0:
                    save_progress = 25 + int((i / len(chunks)) * 5)
                    yield from send_progress('saving', save_progress, f'Saved {i + 1}/{len(chunks)} chunks')

            yield from send_progress('saving', 30, 'Chunks saved to database')

            # Generate embeddings and store vectors
            vectors_created = False
            qdrant_available = is_qdrant_available()

            if qdrant_available:
                try:
                    embedding_info = get_embedding_info()
                    texts = [c['content'] for c in chunks]

                    yield from send_progress('embedding', 30, 'Generating embeddings...')

                    def on_embedding_progress(batch_num, total_batches):
                        embedding_progress = 30 + int((batch_num / total_batches) * 55)
                        # Note: Can't yield from callback, progress will be approximate

                    embeddings = generate_embeddings_batched(texts, 10, on_embedding_progress)

                    if embeddings:
                        print(f"Generated {len(embeddings)} embeddings, dimension: {len(embeddings[0])}")

                    yield from send_progress('storing', 85, 'Storing vectors in Qdrant...')

                    # Store in vector database
                    vector_points = []
                    for idx, chunk in enumerate(chunks):
                        vector_points.append({
                            'id': chunk_ids[idx],
                            'vector': embeddings[idx],
                            'payload': {
                                'chunk_id': chunk_ids[idx],
                                'document_id': doc_id,
                                'document_name': doc['original_name'],
                                'hierarchy_path': chunk.get('hierarchyPath'),
                                'text_preview': chunk['content'][:200],
                                'token_count': chunk['tokenEstimate']
                            }
                        })

                    vector_ids = upsert_vectors(vector_points)

                    yield from send_progress('storing', 95, 'Updating chunk records...')

                    # Update chunks with vector IDs
                    for i, chunk_id in enumerate(chunk_ids):
                        update_chunk_vector(chunk_id, vector_ids[i], embedding_info['model'])

                    vectors_created = True

                except Exception as embedding_error:
                    print(f"Failed to create embeddings: {embedding_error}")
                    yield from send_progress('warning', 90, f'Embeddings failed: {embedding_error}')
            else:
                yield from send_progress('warning', 90, 'Qdrant not available, skipping embeddings')

            update_document_status(doc_id, DocumentStatus.COMPLETED)

            stats = get_chunking_stats(chunks)

            yield from send_progress('complete', 100, 'Processing complete!')

            # Send final result
            result = {
                'stage': 'done',
                'progress': 100,
                'result': {
                    'success': True,
                    'documentId': doc_id,
                    'chunksCreated': len(chunks),
                    'vectorsCreated': vectors_created,
                    'stats': stats
                }
            }
            yield f"data: {json.dumps(result)}\n\n"

        except Exception as e:
            print(f"Process document error: {e}")
            update_document_status(doc_id, DocumentStatus.ERROR, str(e))
            yield f"data: {json.dumps({'stage': 'error', 'progress': 0, 'message': str(e)})}\n\n"

    return Response(generate(), mimetype='text/event-stream')


@bp.route('/<int:doc_id>', methods=['DELETE'])
def delete_doc(doc_id):
    """Delete a document and its chunks"""
    try:
        doc = get_document_by_id(doc_id)

        if not doc:
            return jsonify({'error': True, 'message': 'Document not found'}), 404

        # Delete from vector store
        delete_by_document_id(doc_id)

        # Delete document (chunks cascade delete)
        delete_document(doc_id)

        # Delete file
        try:
            file_path = Config.UPLOADS_DIR / doc['filename']
            if file_path.exists():
                file_path.unlink()
        except Exception:
            pass  # File might not exist

        return jsonify({'success': True})

    except Exception as e:
        print(f"Delete document error: {e}")
        return jsonify({'error': True, 'message': str(e)}), 500
