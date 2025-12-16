#!/usr/bin/env python3
# test_dual_storage.py - Test dual storage service

import sys
import os
from datetime import datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dual_storage_service import DualStorageService

def test_dual_storage():
    """Test storing event to both PostgreSQL and Walrus"""
    try:
        storage = DualStorageService()
        
        # Create test event
        print("Storing test event to PostgreSQL and Walrus...")
        result = storage.store_event(
            event_type="ReactHandled",
            asset_address="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",  # USDC
            supply_apy_ray=3220000000000000000000000000,  # Example RAY value
            borrow_apy_ray=1720000000000000000000000000,
            supply_apy_bps=322,
            borrow_apy_bps=172,
            supply_apy_percent=3.22,
            borrow_apy_percent=1.72,
            block_timestamp=datetime.now(),
            tx_hash="0x" + "0" * 64,  # Test hash
            block_number=123456789,
            correlation_id="test-correlation-123",
            full_data={
                "test": True,
                "asset": "USDC",
                "apy": 3.22
            },
            store_to_walrus=True
        )
        
        print(f"✅ Created event: {result['event_id']}")
        print(f"✅ PostgreSQL success: {result['postgres_success']}")
        print(f"✅ Walrus blob_id: {result['walrus_blob_id']}")
        print(f"✅ Walrus success: {result['walrus_success']}")
        
        # Query events
        print("\nQuerying events...")
        events = storage.query_events(
            asset_address="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            limit=10
        )
        print(f"✅ Found {len(events)} events")
        
        # Get event with Walrus data
        if result['event_id']:
            print("\nRetrieving event with Walrus data...")
            event = storage.get_event(result['event_id'], include_walrus_data=True)
            if event:
                print(f"✅ Event asset: {event['asset_address']}")
                print(f"✅ Has Walrus data: {'walrus_data' in event}")
                if 'walrus_data' in event and event['walrus_data']:
                    print(f"✅ Walrus data retrieved successfully")
        
        print("\n✅ Dual storage test passed!")
        return True
        
    except Exception as e:
        print(f"❌ Dual storage test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    test_dual_storage()

