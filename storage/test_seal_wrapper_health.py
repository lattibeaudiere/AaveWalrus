import os
import time
import requests
import pytest


def test_seal_wrapper_health():
    """Poll the SEAL wrapper health endpoint until it responds OK or timeout."""
    url = os.getenv('SEAL_WRAPPER_URL', 'http://127.0.0.1:3001').rstrip('/')
    health_url = f"{url}/health"

    # Wait up to 20s for the wrapper to become healthy
    for _ in range(20):
        try:
            r = requests.get(health_url, timeout=2)
            r.raise_for_status()
            j = r.json()
            assert j.get('status') == 'ok'
            return
        except Exception:
            time.sleep(1)

    pytest.fail(f"SEAL wrapper health check failed at {health_url}")
