import os
import pytest

# Skip mainnet-only test by default; set WALRUS_MAINNET=1 to enable
if os.getenv('WALRUS_MAINNET', '').lower() not in ('1', 'true', 'yes'):
    pytest.skip('Mainnet walrus test skipped by default', allow_module_level=True)

from walrus_service import WalrusService


def test_walrus_mainnet_store_and_retrieve():
    ws = WalrusService()
    # Simple synthetic payload
    test_data = {"test": "Aave event data", "timestamp": "2025-12-16"}

    blob_id = ws.store_json(test_data)
    assert blob_id

    retrieved = ws.retrieve_json(blob_id)
    assert retrieved == test_data
