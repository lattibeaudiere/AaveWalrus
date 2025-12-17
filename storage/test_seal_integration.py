#!/usr/bin/env python3
"""Integration test: start seal_wrapper, run SEAL store/get via DualStorageService."""
import os
import subprocess
import time
import signal
import requests
from datetime import datetime, timezone

WRAPPER_DIR = os.path.join(os.path.dirname(__file__), 'seal_wrapper')
WRAPPER_URL = 'http://localhost:3001'


def start_wrapper():
    env = os.environ.copy()
    env['SEAL_WRAPPER_PORT'] = '3001'
    # keep mock behavior if no Sui/Seal SDK available; set network to mainnet by default
    env.setdefault('SEAL_NETWORK', 'mainnet')
    proc = subprocess.Popen(['node', 'index.js'], cwd=WRAPPER_DIR, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    # Wait up to 10s for health
    for _ in range(20):
        try:
            r = requests.get(f"{WRAPPER_URL}/health", timeout=1)
            if r.status_code == 200:
                return proc
        except Exception:
            pass
        if proc.poll() is not None:
            break
        time.sleep(0.5)
    # In case it failed to start, terminate and raise
    proc.terminate()
    raise RuntimeError('Seal wrapper failed to start')


def stop_wrapper(proc: subprocess.Popen):
    try:
        proc.send_signal(signal.SIGINT)
        proc.wait(timeout=3)
    except Exception:
        proc.kill()


def test_seal_store_and_retrieve():
    proc = start_wrapper()
    try:
        os.environ['SEAL_WRAPPER_URL'] = WRAPPER_URL
        os.environ['WALRUS_FAKE'] = 'true'
        os.environ['SEAL_ENABLED'] = 'true'

        from dual_storage_service import DualStorageService

        svc = DualStorageService()
        policy = {"name": "public", "type": "public", "definition": {}}
        res = svc.store_event(
            event_type="SEALTest",
            asset_address="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            supply_apy_percent=1.23,
            borrow_apy_percent=0.45,
            tx_hash="0x" + "1"*64,
            block_number=1,
            block_timestamp=datetime.now(timezone.utc),
            full_data={"hello": "seal", "ts": datetime.now(timezone.utc).isoformat()},
            encryption_policy=policy,
            seal_enabled=True,
            store_to_walrus=True,
        )
        assert res.get('walrus_blob_id')

        event = svc.get_event(
            res['event_id'], include_walrus_data=True, decrypt_walrus=True, user_id='u1', user_role='public'
        )

        assert event is not None
        assert 'walrus_data' in event
        assert event['walrus_data'] is not None
        print('Integration test passed: walrus_data:', event['walrus_data'])

    finally:
        stop_wrapper(proc)


if __name__ == '__main__':
    try:
        test_seal_store_and_retrieve()
    except AssertionError as e:
        print('Test failed:', e)
        raise
    except Exception as e:
        print('Error:', e)
        raise
