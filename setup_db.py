import mysql.connector
from config import Config

def init_db():
    # Parse URI
    # mysql+mysqlconnector://root:password@localhost/contract_management
    uri = Config.SQLALCHEMY_DATABASE_URI
    parts = uri.split('://')[1].split('@')
    user_pass = parts[0].split(':')
    host_db = parts[1].split('/')
    
    user = user_pass[0]
    password = user_pass[1] if len(user_pass) > 1 else ""
    host = host_db[0]
    db_name = host_db[1]

    try:
        conn = mysql.connector.connect(
            host=host,
            user=user,
            password=password
        )
        cursor = conn.cursor()
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS {db_name}")
        print(f"Database '{db_name}' ready.")
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"Error initializing database: {e}")
        print("Please ensure MySQL is running and credentials in config.py are correct.")

if __name__ == "__main__":
    init_db()
