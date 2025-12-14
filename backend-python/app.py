"""
Main Flask application
"""
from flask import Flask, jsonify
from flask_cors import CORS
from config import Config
from routes.documents import bp as documents_bp
from routes.chunks import bp as chunks_bp
from routes.search import bp as search_bp
from routes.agent import bp as agent_bp


def create_app():
    """Create and configure the Flask application"""
    app = Flask(__name__)

    # Configure CORS
    CORS(app, origins=Config.CORS_ORIGIN.split(',') if Config.CORS_ORIGIN else ['*'])

    # Register blueprints
    app.register_blueprint(documents_bp)
    app.register_blueprint(chunks_bp)
    app.register_blueprint(search_bp)
    app.register_blueprint(agent_bp)

    # Health check endpoint
    @app.route('/api/health')
    def health_check():
        return jsonify({
            'status': 'ok',
            'service': 'bfnai-backend',
            'version': '1.0.0'
        })

    # Error handlers
    @app.errorhandler(404)
    def not_found(e):
        return jsonify({'error': True, 'message': 'Not found'}), 404

    @app.errorhandler(500)
    def server_error(e):
        return jsonify({'error': True, 'message': 'Internal server error'}), 500

    return app


# Create the application instance
app = create_app()


if __name__ == '__main__':
    print(f"Starting server on port {Config.PORT}...")
    print(f"Debug mode: {Config.DEBUG}")
    print(f"Database: {Config.DB_HOST}:{Config.DB_PORT}/{Config.DB_NAME}")

    app.run(
        host='0.0.0.0',
        port=Config.PORT,
        debug=Config.DEBUG
    )
