# walrus_service.py
import os
import subprocess
import json
import logging
import tempfile
from typing import Optional
from dotenv import load_dotenv
from functools import wraps
import time

load_dotenv()
logger = logging.getLogger(__name__)

def retry_walrus(max_retries=3, delay=1):
    """Decorator for retrying Walrus operations"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    if attempt == max_retries - 1:
                        raise
                    logger.warning(f"Attempt {attempt + 1} failed, retrying: {e}")
                    time.sleep(delay * (attempt + 1))
            return None
        return wrapper
    return decorator

class WalrusService:
    """Service for interacting with Walrus Protocol"""
    
    def __init__(self):
        self.config_path = os.path.expanduser(
            os.getenv('WALRUS_CONFIG', '~/.config/walrus/client_config.yaml')
        )
        self.context = os.getenv('WALRUS_CONTEXT', 'mainnet')  # Default to mainnet
        self.use_wsl = os.getenv('WALRUS_USE_WSL', 'false').lower() == 'true'
        
        # If using WSL, convert Windows path to WSL path
        if self.use_wsl and os.name == 'nt':
            # Convert Windows path to WSL path
            # C:\Users\... -> /mnt/c/Users/...
            if ':' in self.config_path:
                drive = self.config_path[0].lower()
                path = self.config_path[3:].replace('\\', '/')
                self.config_path = f'/mnt/{drive}{path}'
    
    @retry_walrus(max_retries=3, delay=1)
    def store_data(self, data: bytes) -> str:
        """
        Store data in Walrus Protocol
        
        Args:
            data: Bytes to store
            
        Returns:
            blob_id: The blob identifier for retrieval
        """
        tmp_file_path = None
        try:
            # Write to temporary file
            with tempfile.NamedTemporaryFile(delete=False, mode='wb') as tmp_file:
                tmp_file.write(data)
                tmp_file_path = tmp_file.name
            
            # Execute Walrus CLI (official command format)
            if self.use_wsl and os.name == 'nt':
                # On Windows, run through WSL
                # Convert temp file path to WSL path
                if ':' in tmp_file_path:
                    drive = tmp_file_path[0].lower()
                    wsl_tmp_path = tmp_file_path[3:].replace('\\', '/')
                    wsl_tmp_path = f'/mnt/{drive}{wsl_tmp_path}'
                else:
                    wsl_tmp_path = tmp_file_path.replace('\\', '/')
                
                # Official Walrus command: walrus store <file> --epochs <n> --context <env>
                cmd = [
                    'wsl',
                    'walrus',
                    'store', wsl_tmp_path,
                    '--epochs', '1',
                    '--context', self.context
                ]
            else:
                # Official Walrus command: walrus store <file> --epochs <n> --context <env>
                cmd = [
                    'walrus',
                    'store', tmp_file_path,
                    '--epochs', '1',
                    '--context', self.context
                ]
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=120  # Increased timeout for WSL
            )
            
            if result.returncode != 0:
                raise Exception(f"Walrus store failed: {result.stderr}")
            
            # Extract blob_id from output
            # Official format: "Blob ID: oehkoh0352bRGNPjuwcy0nye3OLKT649K62imdNAlXg"
            blob_id = None
            for line in result.stdout.strip().split('\n'):
                if 'Blob ID:' in line or 'blob ID:' in line:
                    # Extract the blob ID after the colon
                    parts = line.split(':', 1)
                    if len(parts) > 1:
                        blob_id = parts[1].strip()
                        break
            
            if not blob_id:
                # Try to find blob ID pattern (alphanumeric string, typically 40+ chars)
                import re
                # Blob IDs are alphanumeric strings, not hex (they don't start with 0x)
                blob_pattern = r'\b([a-zA-Z0-9]{40,})\b'
                matches = re.findall(blob_pattern, result.stdout)
                if matches:
                    # Take the longest match that's not a hex string
                    for match in sorted(matches, key=len, reverse=True):
                        if not match.startswith('0x') and len(match) >= 40:
                            blob_id = match
                            break
            
            if not blob_id:
                raise Exception(f"Could not extract blob_id from Walrus output: {result.stdout}")
            
            logger.info(f"Data stored to Walrus with blob_id: {blob_id}")
            return blob_id
                
        except Exception as e:
            logger.error(f"Failed to store data to Walrus: {e}")
            raise
        finally:
            # Clean up temporary file
            if tmp_file_path and os.path.exists(tmp_file_path):
                try:
                    os.unlink(tmp_file_path)
                except Exception as e:
                    logger.warning(f"Failed to delete temp file: {e}")
    
    def store_json(self, data: dict) -> str:
        """
        Store JSON data in Walrus (e.g., full Aave event)
        
        Args:
            data: Dictionary to store as JSON
            
        Returns:
            blob_id: The blob identifier
        """
        json_bytes = json.dumps(data, default=str).encode('utf-8')
        return self.store_data(json_bytes)
    
    @retry_walrus(max_retries=3, delay=1)
    def retrieve_data(self, blob_id: str) -> bytes:
        """
        Retrieve data from Walrus Protocol
        
        Args:
            blob_id: The blob identifier
            
        Returns:
            bytes: Retrieved data
        """
        try:
            # Official Walrus command: walrus retrieve --blob-id <id> --context <env>
            # Output goes to stdout, which we capture
            if self.use_wsl and os.name == 'nt':
                cmd = [
                    'wsl',
                    'walrus',
                    'retrieve',
                    '--blob-id', blob_id,
                    '--context', self.context
                ]
            else:
                cmd = [
                    'walrus',
                    'retrieve',
                    '--blob-id', blob_id,
                    '--context', self.context
                ]
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=120  # Increased timeout for WSL
            )
            
            if result.returncode != 0:
                raise Exception(f"Walrus retrieve failed: {result.stderr}")
            
            return result.stdout.encode('utf-8')
            
        except Exception as e:
            logger.error(f"Failed to retrieve data from Walrus: {e}")
            raise
    
    def retrieve_json(self, blob_id: str) -> dict:
        """
        Retrieve and parse JSON data from Walrus
        
        Args:
            blob_id: The blob identifier
            
        Returns:
            dict: Parsed JSON data
        """
        data_bytes = self.retrieve_data(blob_id)
        return json.loads(data_bytes.decode('utf-8'))

