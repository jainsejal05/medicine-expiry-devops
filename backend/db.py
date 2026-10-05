import mysql.connector
from mysql.connector import Error
import os
from dotenv import load_dotenv

load_dotenv(override=True)  # reads variables from .env file, and overrides any
                             # system-level environment variables with the same name

def get_connection():
    """
    Creates and returns a new MySQL database connection
    using credentials from the .env file.
    """
    try:
        connection = mysql.connector.connect(
            host=os.getenv("DB_HOST", "localhost"),
            user=os.getenv("DB_USER", "root"),
            password=os.getenv("DB_PASSWORD", ""),
            database=os.getenv("DB_NAME", "medicine_db"),
            port=int(os.getenv("DB_PORT", 3306))
        )
        return connection
    except Error as e:
        print(f"Error connecting to MySQL: {e}")
        raise