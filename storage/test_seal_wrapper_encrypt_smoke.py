import os
import time
import requests
import pytest


def test_seal_wrapper_encrypt_smoke():
    """Quick smoke test to ensure the /encrypt endpoint responds and returns ciphertext."""
    url = os.getenv('SEAL_WRAPPER_URL', 'http://127.0.0.1:3001').rstrip('/')
    encrypt_url = f"{url}/encrypt"
    payload = {'policy': {'name': 'smoke', 'type': 'public', 'definition': {}}, 'plaintext': 'hello'}

    # Try for a few seconds to account for startup delays
    for _ in range(10):
        try:
            r = requests.post(encrypt_url, json=payload, timeout=5)
            r.raise_for_status()
            j = r.json()
            assert 'ciphertext' in j
            return
        except Exception:
            time.sleep(1)

    pytest.fail(f"SEAL wrapper /encrypt smoke test failed at {encrypt_url}")
