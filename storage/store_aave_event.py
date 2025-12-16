#!/usr/bin/env python3
# store_aave_event.py - CLI script to store Aave events
# Can be called from Node.js server.js via child_process

import sys
import json
import logging
import os

# Add current directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dual_storage_service import DualStorageService
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def main():
    if len(sys.argv) < 2:
        print("Usage: python store_aave_event.py '<json_event_data>'", file=sys.stderr)
        sys.exit(1)
    
    try:
        # Parse JSON from command line argument
        event_data = json.loads(sys.argv[1])
        
        # Initialize storage service
        storage = DualStorageService()
        
        # Parse block_timestamp if provided
        block_timestamp = None
        if event_data.get('block_timestamp'):
            if isinstance(event_data['block_timestamp'], (int, float)):
                block_timestamp = datetime.fromtimestamp(event_data['block_timestamp'])
            elif isinstance(event_data['block_timestamp'], str):
                block_timestamp = datetime.fromisoformat(event_data['block_timestamp'].replace('Z', '+00:00'))
        
        # Store event
        result = storage.store_event(
            event_type=event_data.get('event_type', 'ReactHandled'),
            asset_address=event_data['asset_address'],
            supply_apy_ray=event_data.get('supply_apy_ray'),
            borrow_apy_ray=event_data.get('borrow_apy_ray'),
            stable_borrow_rate_ray=event_data.get('stable_borrow_rate_ray'),
            variable_borrow_rate_ray=event_data.get('variable_borrow_rate_ray'),
            supply_apy_bps=event_data.get('supply_apy_bps'),
            borrow_apy_bps=event_data.get('borrow_apy_bps'),
            stable_borrow_rate_bps=event_data.get('stable_borrow_rate_bps'),
            variable_borrow_rate_bps=event_data.get('variable_borrow_rate_bps'),
            supply_apy_percent=event_data.get('supply_apy_percent'),
            borrow_apy_percent=event_data.get('borrow_apy_percent'),
            stable_borrow_rate_percent=event_data.get('stable_borrow_rate_percent'),
            variable_borrow_rate_percent=event_data.get('variable_borrow_rate_percent'),
            liquidity_index=event_data.get('liquidity_index'),
            variable_borrow_index=event_data.get('variable_borrow_index'),
            block_timestamp=block_timestamp,
            transaction_timestamp=event_data.get('transaction_timestamp'),
            tx_hash=event_data['tx_hash'],
            block_number=event_data.get('block_number'),
            transaction_number=event_data.get('transaction_number'),
            correlation_id=event_data.get('correlation_id'),
            aave_apy_bps=event_data.get('aave_apy_bps'),
            compound_apy_bps=event_data.get('compound_apy_bps'),
            spread_bps=event_data.get('spread_bps'),
            rebalanced=event_data.get('rebalanced'),
            direction=event_data.get('direction'),
            higher_apy=event_data.get('higher_apy'),
            full_data=event_data.get('full_data', {}),
            store_to_walrus=event_data.get('store_to_walrus', True)
        )
        
        # Output result as JSON
        print(json.dumps({
            'success': True,
            'event_id': result['event_id'],
            'walrus_blob_id': result['walrus_blob_id'],
            'postgres_success': result['postgres_success'],
            'walrus_success': result['walrus_success']
        }))
        
    except Exception as e:
        logger.error(f"Failed to store event: {e}", exc_info=True)
        print(json.dumps({
            'success': False,
            'error': str(e)
        }), file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()

