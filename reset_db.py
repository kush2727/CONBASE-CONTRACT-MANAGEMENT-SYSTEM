import mysql.connector
from config import Config

def reset_db():
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
            password=password,
            database=db_name
        )
        cursor = conn.cursor()
        
        print("Dropping old contracts table...")
        cursor.execute("DROP TABLE IF EXISTS contracts")
        
        print("Creating new contracts table...")
        cursor.execute("""
            CREATE TABLE contracts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                contract_name VARCHAR(255) NOT NULL,
                party_name VARCHAR(255) NOT NULL,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                status VARCHAR(20) DEFAULT 'Active',
                file_path VARCHAR(512) NOT NULL,
                signature_path VARCHAR(512) NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        cursor.execute("CREATE INDEX idx_contract_name ON contracts(contract_name)")
        cursor.execute("CREATE INDEX idx_party_name ON contracts(party_name)")
        
        print("Database reset successfully.")
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"Error resetting database: {e}")

if __name__ == "__main__":
    reset_db()
