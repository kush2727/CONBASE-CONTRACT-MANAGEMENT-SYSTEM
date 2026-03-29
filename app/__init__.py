import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from config import Config

db = SQLAlchemy()

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Enable CORS for all routes (allows any frontend origin)
    CORS(app, resources={r"/contracts/*": {"origins": "*"}})

    # Init extensions
    db.init_app(app)

    # Ensure upload/signature directories exist
    os.makedirs(app.config['UPLOAD_FOLDER'],    exist_ok=True)
    os.makedirs(app.config['SIGNATURE_FOLDER'], exist_ok=True)

    # Register blueprints
    from app.routes.contract_routes import contract_bp
    app.register_blueprint(contract_bp)

    return app
