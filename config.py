import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'change-me-in-production'
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
        'mysql+mysqlconnector://root:tiger@localhost/contract_management'
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    BASE_DIR    = os.path.abspath(os.path.dirname(__file__))
    UPLOAD_FOLDER    = os.path.join(BASE_DIR, 'app', 'static', 'uploads')
    SIGNATURE_FOLDER = os.path.join(BASE_DIR, 'app', 'static', 'signatures')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024   # 16 MB
