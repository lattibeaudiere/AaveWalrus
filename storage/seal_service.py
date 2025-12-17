import os
import json
import base64
from typing import Tuple, Optional, Dict, Any


def _read_env_bool(path: str, key: str) -> Optional[bool]:
    try:
        with open(path, 'r') as f:
            for line in f:
                if line.strip().startswith(key + "="):
                    val = line.split('=', 1)[1].strip()
                    return val.lower() in ('1', 'true', 'yes')
    except Exception:
        return None


class SealService:
    """Minimal mock SEAL service for local testing.

    This provides the methods expected by `dual_storage_service.py`:
    - `enabled` boolean
    - `encrypt_data(bytes, policy) -> (encrypted_bytes, meta)`
    - `detect_seal_blob(bytes) -> bool`
    - `decrypt_data(bytes, user_id, user_role) -> (decrypted_bytes|None, allowed, reason)`

    The implementation is a simple JSON wrapper with base64-encoded payload so
    tests can exercise the codepath without requiring a real SEAL backend.
    """

    def __init__(self, env_path: str = None):
        env_path = env_path or os.path.join(os.path.dirname(__file__), '.env')
        enabled = os.environ.get('SEAL_ENABLED')
        if enabled is None:
            enabled_bool = _read_env_bool(env_path, 'SEAL_ENABLED')
            self.enabled = bool(enabled_bool)
        else:
            self.enabled = enabled.lower() in ('1', 'true', 'yes')

        # Attempt to read servers list (optional)
        self.key_servers = []
        try:
            raw = os.environ.get('SEAL_KEY_SERVERS')
            if not raw:
                # fallback to reading env file
                with open(env_path, 'r') as f:
                    for line in f:
                        if line.strip().startswith('SEAL_KEY_SERVERS='):
                            raw = line.split('=', 1)[1].strip()
                            break
            if raw:
                self.key_servers = json.loads(raw)
        except Exception:
            self.key_servers = []

    def encrypt_data(self, plaintext: bytes, policy: Dict[str, Any]) -> Tuple[bytes, Dict[str, Any]]:
        """Mock-encrypt data according to `policy`.

        Returns (encrypted_bytes, meta)
        """
        encoded = base64.b64encode(plaintext).decode('utf-8')
        wrapper = {
            'seal': True,
            'policy': policy,
            'ciphertext': encoded,
            'meta': {'method': 'mock', 'servers': self.key_servers}
        }
        return json.dumps(wrapper).encode('utf-8'), wrapper['meta']

    def detect_seal_blob(self, raw_bytes: bytes) -> bool:
        try:
            obj = json.loads(raw_bytes.decode('utf-8'))
            return bool(obj.get('seal'))
        except Exception:
            return False

    def decrypt_data(self, raw_bytes: bytes, user_id: Optional[str], user_role: Optional[str]) -> Tuple[Optional[bytes], bool, str]:
        try:
            obj = json.loads(raw_bytes.decode('utf-8'))
            policy = obj.get('policy') or {}
            # Simple policy enforcement: if policy type is 'public', allow any user_role 'public'
            ptype = policy.get('type')
            pname = policy.get('name')
            allowed = False
            reason = 'unknown_policy'
            if ptype == 'public':
                allowed = True
                reason = 'public_policy'
            elif pname and user_role and pname == user_role:
                allowed = True
                reason = 'role_match'

            if not allowed:
                return None, False, reason

            ciphertext = obj.get('ciphertext')
            if ciphertext is None:
                return None, False, 'no_ciphertext'

            decoded = base64.b64decode(ciphertext.encode('utf-8'))
            return decoded, True, reason

        except Exception as e:
            return None, False, f'decrypt_error:{e}'
