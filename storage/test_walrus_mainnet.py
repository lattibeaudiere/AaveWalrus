from walrus_service import WalrusService
import sys

sys.stdout.reconfigure(encoding=utf-8)

ws = WalrusService()
print(Walrus context:, ws.context)
print(Config path:, ws.config_path)

test_data = {test: Aave event data, timestamp: 2025-12-16}
print(\nStoring test data:, test_data)

try:
    blob_id = ws.store_json(test_data)
    print(Successfully stored! Blob ID:, blob_id)
    
    retrieved = ws.retrieve_json(blob_id)
    print(Retrieved data:, retrieved)
    
    assert retrieved == test_data
    print(\nTest passed! Walrus Mainnet is working!)
except Exception as e:
    print(\nError:, e)
    import traceback
    traceback.print_exc()
    sys.exit(1)
