# database.py
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
import logging

# Load .env but don't unescape values
load_dotenv()
logger = logging.getLogger(__name__)

class Database:
    def __init__(self):
        # Support connection string (for cloud databases like Supabase)
        # Read DATABASE_URL directly from .env file to avoid dotenv unescaping
        database_url = None
        env_file = os.path.join(os.path.dirname(__file__), '.env')
        if os.path.exists(env_file):
            try:
                with open(env_file, 'r', encoding='utf-8') as f:
                    for line in f:
                        if line.startswith('DATABASE_URL='):
                            database_url = line.split('=', 1)[1].strip()
                            break
            except Exception as e:
                logger.warning(f"Could not read .env file: {e}")
        
        # Fallback to environment variable
        if not database_url:
            database_url = os.getenv('DATABASE_URL')
        
        if database_url:
            # Parse connection string and extract individual parameters
            # This avoids issues with special characters in passwords
            import urllib.parse
            try:
                parsed = urllib.parse.urlparse(database_url)
                # Extract password (may be URL-encoded or plain)
                password = parsed.password
                if password:
                    # If password contains % but looks URL-encoded, decode it
                    # Otherwise use as-is (dotenv may have already decoded it)
                    if '%' in password:
                        password = urllib.parse.unquote(password)
                
                self.config = {
                    'host': parsed.hostname,
                    'port': parsed.port or 5432,
                    'database': parsed.path.lstrip('/') or 'postgres',
                    'user': parsed.username or 'postgres',
                    'password': password,
                    'sslmode': 'require'  # Cloud databases require SSL
                }
                self.connection_string = None  # Use individual config instead
            except Exception as e:
                logger.error(f"Could not parse connection string: {e}")
                # Fallback: use individual env vars
                self.config = {
                    'host': os.getenv('DB_HOST', 'localhost'),
                    'port': int(os.getenv('DB_PORT', 5432)),
                    'database': os.getenv('DB_NAME', 'aave_dataset'),
                    'user': os.getenv('DB_USER', 'aave_user'),
                    'password': os.getenv('DB_PASSWORD')
                }
                self.connection_string = None
        else:
            # Use individual environment variables
            self.config = {
                'host': os.getenv('DB_HOST', 'localhost'),
                'port': int(os.getenv('DB_PORT', 5432)),
                'database': os.getenv('DB_NAME', 'aave_dataset'),
                'user': os.getenv('DB_USER', 'aave_user'),
                'password': os.getenv('DB_PASSWORD')
            }
            # Add SSL for cloud databases if host is not localhost
            if self.config['host'] != 'localhost' and self.config['host'] != '127.0.0.1':
                self.config['sslmode'] = 'require'
            self.connection_string = None
    
    def get_connection(self):
        """Get database connection"""
        try:
            # Use individual config (more reliable with special characters)
            if self.config:
                conn = psycopg2.connect(**self.config)
            elif self.connection_string:
                # Fallback to connection string
                conn = psycopg2.connect(self.connection_string)
            else:
                raise ValueError("No database configuration found")
            return conn
        except Exception as e:
            logger.error(f"Database connection failed: {e}")
            raise
    
    def execute_query(self, query, params=None, fetch=True):
        """Execute a query and return results"""
        conn = self.get_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(query, params)
                # If fetching results (SELECT or INSERT ... RETURNING), fetch them
                # and commit the transaction so returned rows are persisted.
                if fetch:
                    if cursor.description:
                        results = cursor.fetchall()
                    else:
                        results = None
                    conn.commit()
                    return results

                # For non-fetching queries (e.g., INSERT/UPDATE without RETURNING),
                # commit and return the affected rowcount.
                conn.commit()
                return cursor.rowcount
        except Exception as e:
            conn.rollback()
            logger.error(f"Query execution failed: {e}")
            raise
        finally:
            conn.close()
    
    def execute_many(self, query, params_list):
        """Execute query with multiple parameter sets"""
        conn = self.get_connection()
        try:
            with conn.cursor() as cursor:
                cursor.executemany(query, params_list)
                conn.commit()
                return cursor.rowcount
        except Exception as e:
            conn.rollback()
            logger.error(f"Batch execution failed: {e}")
            raise
        finally:
            conn.close()

