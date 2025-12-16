#!/usr/bin/env python3
# test_walrus.py - Test Walrus service

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from walrus_service import WalrusService

def test_walrus():
    """Test Walrus storage and retrieval"""
    try:
        walrus = WalrusService()
        
        # Test data
        test_data = {
            "asset_address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            "supply_apy_percent": 3.22,
            "timestamp": "2025-12-15T10:00:00Z",
            "test": True
        }
        
        print("Storing test data to Walrus...")
        blob_id = walrus.store_json(test_data)
        print(f"✅ Stored with blob_id: {blob_id}")
        
        print("Retrieving data from Walrus...")
        retrieved = walrus.retrieve_json(blob_id)
        print(f"✅ Retrieved: {retrieved}")
        
        # Verify data matches
        if retrieved['asset_address'] == test_data['asset_address']:
            print("✅ Walrus test passed! Data matches.")
            return True
        else:
            print("❌ Walrus test failed! Data mismatch.")
            return False
            
    except Exception as e:
        print(f"❌ Walrus test failed: {e}")
        print("\nMake sure:")
        print("1. Walrus CLI is installed: curl -sSf https://docs.wal.app/setup/walrus-install.sh | sh")
        print("2. Sui wallet is configured: sui client active-address")
        print("3. Walrus config exists: ~/.config/walrus/client_config.yaml")
        return False

if __name__ == '__main__':
    test_walrus()

