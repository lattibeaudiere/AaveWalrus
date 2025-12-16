# dual_storage_service.py
import json
import logging
import sys
import os
from datetime import datetime
from typing import Dict, Optional, List

# Add current directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import Database
from walrus_service import WalrusService

logger = logging.getLogger(__name__)

class DualStorageService:
    """
    Service for managing Aave event data in both PostgreSQL and Walrus Protocol
    """
    
    def __init__(self):
        self.db = Database()
        self.walrus = WalrusService()
    
    def store_event(
        self,
        event_type: str,
        asset_address: str,
        supply_apy_ray: Optional[int] = None,
        borrow_apy_ray: Optional[int] = None,
        stable_borrow_rate_ray: Optional[int] = None,
        variable_borrow_rate_ray: Optional[int] = None,
        supply_apy_bps: Optional[int] = None,
        borrow_apy_bps: Optional[int] = None,
        stable_borrow_rate_bps: Optional[int] = None,
        variable_borrow_rate_bps: Optional[int] = None,
        supply_apy_percent: Optional[float] = None,
        borrow_apy_percent: Optional[float] = None,
        stable_borrow_rate_percent: Optional[float] = None,
        variable_borrow_rate_percent: Optional[float] = None,
        liquidity_index: Optional[int] = None,
        variable_borrow_index: Optional[int] = None,
        block_timestamp: Optional[datetime] = None,
        transaction_timestamp: Optional[int] = None,
        tx_hash: str = None,
        block_number: Optional[int] = None,
        transaction_number: Optional[str] = None,
        correlation_id: Optional[str] = None,
        aave_apy_bps: Optional[int] = None,
        compound_apy_bps: Optional[int] = None,
        spread_bps: Optional[int] = None,
        rebalanced: Optional[bool] = None,
        direction: Optional[str] = None,
        higher_apy: Optional[str] = None,
        full_data: Optional[Dict] = None,
        store_to_walrus: bool = True
    ) -> Dict:
        """
        Store Aave event in both PostgreSQL and Walrus
        
        Returns:
            Dictionary with event_id, walrus_blob_id, and success flags
        """
        event_id = None
        walrus_blob_id = None
        postgres_success = False
        walrus_success = False
        
        try:
            # Ensure full_data exists
            if full_data is None:
                full_data = {}
            
            # Step 1: Store in PostgreSQL (primary storage)
            query = """
                INSERT INTO aave_events (
                    event_type, asset_address, 
                    supply_apy_ray, borrow_apy_ray, stable_borrow_rate_ray, variable_borrow_rate_ray,
                    supply_apy_bps, borrow_apy_bps, stable_borrow_rate_bps, variable_borrow_rate_bps,
                    supply_apy_percent, borrow_apy_percent, stable_borrow_rate_percent, variable_borrow_rate_percent,
                    liquidity_index, variable_borrow_index,
                    block_timestamp, transaction_timestamp, tx_hash, block_number, transaction_number,
                    correlation_id, aave_apy_bps, compound_apy_bps, spread_bps, rebalanced, direction, higher_apy,
                    full_data
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                )
                RETURNING id
            """
            
            params = (
                event_type, asset_address,
                supply_apy_ray, borrow_apy_ray, stable_borrow_rate_ray, variable_borrow_rate_ray,
                supply_apy_bps, borrow_apy_bps, stable_borrow_rate_bps, variable_borrow_rate_bps,
                supply_apy_percent, borrow_apy_percent, stable_borrow_rate_percent, variable_borrow_rate_percent,
                liquidity_index, variable_borrow_index,
                block_timestamp, transaction_timestamp, tx_hash, block_number, transaction_number,
                correlation_id, aave_apy_bps, compound_apy_bps, spread_bps, rebalanced, direction, higher_apy,
                json.dumps(full_data)
            )
            
            result = self.db.execute_query(
                query,
                params=params,
                fetch=True
            )
            
            event_id = str(result[0]['id'])
            postgres_success = True
            logger.info(f"Event {event_id} stored in PostgreSQL")
            
            # Step 2: Store in Walrus (backup/archive)
            if store_to_walrus:
                try:
                    walrus_blob_id = self.walrus.store_json(full_data)
                    
                    # Update PostgreSQL with blob_id
                    update_query = """
                        UPDATE aave_events 
                        SET walrus_blob_id = %s, walrus_backed_up_at = NOW()
                        WHERE id = %s
                    """
                    self.db.execute_query(
                        update_query,
                        params=(walrus_blob_id, event_id),
                        fetch=False
                    )
                    walrus_success = True
                    logger.info(f"Event {event_id} backed up to Walrus: {walrus_blob_id}")
                    
                except Exception as e:
                    logger.warning(f"Failed to store event {event_id} to Walrus: {e}")
                    # Don't fail - PostgreSQL write succeeded
                    walrus_success = False
                    
        except Exception as e:
            logger.error(f"Failed to store event: {e}")
            raise
        
        return {
            'event_id': event_id,
            'walrus_blob_id': walrus_blob_id,
            'postgres_success': postgres_success,
            'walrus_success': walrus_success
        }
    
    def get_event(self, event_id: str, include_walrus_data: bool = False) -> Optional[Dict]:
        """
        Get event by ID
        
        Args:
            event_id: Event ID
            include_walrus_data: If True, also retrieves full data from Walrus
            
        Returns:
            Event data dictionary or None
        """
        query = """
            SELECT 
                id, event_type, asset_address, 
                supply_apy_ray, borrow_apy_ray, stable_borrow_rate_ray, variable_borrow_rate_ray,
                supply_apy_bps, borrow_apy_bps, stable_borrow_rate_bps, variable_borrow_rate_bps,
                supply_apy_percent, borrow_apy_percent, stable_borrow_rate_percent, variable_borrow_rate_percent,
                liquidity_index, variable_borrow_index,
                block_timestamp, server_timestamp, transaction_timestamp, tx_hash, block_number, transaction_number,
                correlation_id, aave_apy_bps, compound_apy_bps, spread_bps, rebalanced, direction, higher_apy,
                full_data, walrus_blob_id, walrus_backed_up_at
            FROM aave_events
            WHERE id = %s
        """
        
        results = self.db.execute_query(query, params=(event_id,))
        
        if not results:
            return None
        
        event = dict(results[0])
        
        # Optionally retrieve full data from Walrus
        if include_walrus_data and event.get('walrus_blob_id'):
            try:
                walrus_data = self.walrus.retrieve_json(event['walrus_blob_id'])
                event['walrus_data'] = walrus_data
            except Exception as e:
                logger.warning(f"Failed to retrieve Walrus data for {event_id}: {e}")
                event['walrus_data'] = None
        
        return event
    
    def query_events(
        self,
        asset_address: Optional[str] = None,
        event_type: Optional[str] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        min_supply_apy_percent: Optional[float] = None,
        limit: int = 100
    ) -> List[Dict]:
        """
        Query events from PostgreSQL (fast queries)
        
        Args:
            asset_address: Filter by asset address
            event_type: Filter by event type
            date_from: Filter from block_timestamp
            date_to: Filter to block_timestamp
            min_supply_apy_percent: Filter events with supply APY >= this
            limit: Maximum number of results
            
        Returns:
            List of event dictionaries
        """
        query = """
            SELECT id, event_type, asset_address, supply_apy_percent, borrow_apy_percent,
                   block_timestamp, tx_hash, block_number, walrus_blob_id, correlation_id
            FROM aave_events WHERE 1=1
        """
        params = []
        
        if asset_address:
            query += " AND asset_address = %s"
            params.append(asset_address)
        
        if event_type:
            query += " AND event_type = %s"
            params.append(event_type)
        
        if date_from:
            query += " AND block_timestamp >= %s"
            params.append(date_from)
        
        if date_to:
            query += " AND block_timestamp <= %s"
            params.append(date_to)
        
        if min_supply_apy_percent:
            query += " AND supply_apy_percent >= %s"
            params.append(min_supply_apy_percent)
        
        query += " ORDER BY block_timestamp DESC LIMIT %s"
        params.append(limit)
        
        results = self.db.execute_query(query, params=params)
        return [dict(row) for row in results]
    
    def backup_to_walrus(self, event_id: str) -> str:
        """
        Backup an existing event to Walrus
        
        Args:
            event_id: Event ID to backup
            
        Returns:
            walrus_blob_id
        """
        event = self.get_event(event_id, include_walrus_data=False)
        
        if not event:
            raise ValueError(f"Event {event_id} not found")
        
        if event.get('walrus_blob_id'):
            logger.info(f"Event {event_id} already backed up to Walrus")
            return event['walrus_blob_id']
        
        # Get full data
        if event.get('full_data'):
            full_data = event['full_data'] if isinstance(event['full_data'], dict) else json.loads(event['full_data'])
        else:
            raise ValueError(f"Event {event_id} has no full_data to backup")
        
        # Store to Walrus
        walrus_blob_id = self.walrus.store_json(full_data)
        
        # Update database
        update_query = """
            UPDATE aave_events 
            SET walrus_blob_id = %s, walrus_backed_up_at = NOW()
            WHERE id = %s
        """
        self.db.execute_query(update_query, params=(walrus_blob_id, event_id), fetch=False)
        
        logger.info(f"Event {event_id} backed up to Walrus: {walrus_blob_id}")
        return walrus_blob_id

