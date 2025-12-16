# app.py - Flask API for Aave Event Storage
from flask import Flask, request, jsonify
from datetime import datetime
import logging
import sys
import os

# Add current directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dual_storage_service import DualStorageService

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
app = Flask(__name__)

# Initialize dual storage service
storage = DualStorageService()

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'service': 'aave-storage'}), 200

@app.route('/api/v1/aave-events', methods=['POST'])
def create_event():
    """Store a new Aave event with dual storage (call from your server.js)"""
    try:
        data = request.json
        
        # Parse block_timestamp if provided
        block_timestamp = None
        if data.get('block_timestamp'):
            if isinstance(data['block_timestamp'], (int, float)):
                block_timestamp = datetime.fromtimestamp(data['block_timestamp'])
            elif isinstance(data['block_timestamp'], str):
                block_timestamp = datetime.fromisoformat(data['block_timestamp'].replace('Z', '+00:00'))
        
        result = storage.store_event(
            event_type=data.get('event_type', 'ReactHandled'),
            asset_address=data['asset_address'],
            supply_apy_ray=data.get('supply_apy_ray'),
            borrow_apy_ray=data.get('borrow_apy_ray'),
            stable_borrow_rate_ray=data.get('stable_borrow_rate_ray'),
            variable_borrow_rate_ray=data.get('variable_borrow_rate_ray'),
            supply_apy_bps=data.get('supply_apy_bps'),
            borrow_apy_bps=data.get('borrow_apy_bps'),
            stable_borrow_rate_bps=data.get('stable_borrow_rate_bps'),
            variable_borrow_rate_bps=data.get('variable_borrow_rate_bps'),
            supply_apy_percent=data.get('supply_apy_percent'),
            borrow_apy_percent=data.get('borrow_apy_percent'),
            stable_borrow_rate_percent=data.get('stable_borrow_rate_percent'),
            variable_borrow_rate_percent=data.get('variable_borrow_rate_percent'),
            liquidity_index=data.get('liquidity_index'),
            variable_borrow_index=data.get('variable_borrow_index'),
            block_timestamp=block_timestamp,
            transaction_timestamp=data.get('transaction_timestamp'),
            tx_hash=data['tx_hash'],
            block_number=data.get('block_number'),
            transaction_number=data.get('transaction_number'),
            correlation_id=data.get('correlation_id'),
            aave_apy_bps=data.get('aave_apy_bps'),
            compound_apy_bps=data.get('compound_apy_bps'),
            spread_bps=data.get('spread_bps'),
            rebalanced=data.get('rebalanced'),
            direction=data.get('direction'),
            higher_apy=data.get('higher_apy'),
            full_data=data.get('full_data', {}),
            store_to_walrus=data.get('store_to_walrus', True)
        )
        
        return jsonify({
            'success': True,
            'event_id': result['event_id'],
            'walrus_blob_id': result['walrus_blob_id'],
            'storage_status': {
                'postgres': result['postgres_success'],
                'walrus': result['walrus_success']
            }
        }), 201
        
    except Exception as e:
        logging.error(f"Error storing event: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/api/v1/aave-events/<event_id>', methods=['GET'])
def get_event(event_id):
    """Get event by ID"""
    include_walrus = request.args.get('include_walrus', 'false').lower() == 'true'
    
    try:
        event = storage.get_event(event_id, include_walrus_data=include_walrus)
        
        if not event:
            return jsonify({'error': 'Event not found'}), 404
        
        return jsonify(event), 200
    except Exception as e:
        logging.error(f"Error getting event: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/api/v1/aave-events', methods=['GET'])
def list_events():
    """Query events (fast PostgreSQL queries, for frontend or analysis)"""
    try:
        asset_address = request.args.get('asset_address')
        event_type = request.args.get('event_type')
        
        date_from = None
        if request.args.get('date_from'):
            date_from = datetime.fromisoformat(request.args.get('date_from'))
        
        date_to = None
        if request.args.get('date_to'):
            date_to = datetime.fromisoformat(request.args.get('date_to'))
        
        min_supply_apy_percent = None
        if request.args.get('min_supply_apy_percent'):
            min_supply_apy_percent = float(request.args.get('min_supply_apy_percent'))
        
        limit = int(request.args.get('limit', 100))
        
        results = storage.query_events(
            asset_address=asset_address,
            event_type=event_type,
            date_from=date_from,
            date_to=date_to,
            min_supply_apy_percent=min_supply_apy_percent,
            limit=limit
        )
        
        return jsonify({
            'count': len(results),
            'results': results
        }), 200
    except Exception as e:
        logging.error(f"Error querying events: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/api/v1/aave-events/<event_id>/backup', methods=['POST'])
def backup_event(event_id):
    """Manually backup an event to Walrus"""
    try:
        blob_id = storage.backup_to_walrus(event_id)
        return jsonify({
            'success': True,
            'event_id': event_id,
            'walrus_blob_id': blob_id
        }), 200
    except Exception as e:
        logging.error(f"Error backing up event: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 400

if __name__ == '__main__':
    port = int(os.getenv('FLASK_PORT', 5000))
    app.run(debug=True, host='0.0.0.0', port=port)

