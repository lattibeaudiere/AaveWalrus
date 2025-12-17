import json
import logging
import sys
import os
from datetime import datetime
from typing import Dict, Optional, List

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import Database
from walrus_service import WalrusService
from seal_service import SealService

logger = logging.getLogger(__name__)

class DualStorageService:
    """
    Service for managing Aave event data in both PostgreSQL and Walrus Protocol
    with optional SEAL-based encryption.
    """

    def __init__(self):
        self.db = Database()
        self.walrus = WalrusService()
        self.seal = SealService()

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
        store_to_walrus: bool = True,
        encryption_policy: Optional[Dict] = None,
        seal_enabled: Optional[bool] = None,
        user_context: Optional[Dict] = None,
    ) -> Dict:
        event_id = None
        walrus_blob_id = None
        postgres_success = False
        walrus_success = False

        try:
            if full_data is None:
                full_data = {}

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

            # Step 2: Store in Walrus (backup/archive), optionally with SEAL
            if store_to_walrus:
                try:
                    blob_payload = json.dumps(full_data, default=str).encode("utf-8")
                    use_seal = seal_enabled if seal_enabled is not None else self.seal.enabled

                    seal_meta = None
                    if use_seal and encryption_policy:
                        encrypted_bytes, seal_meta = self.seal.encrypt_data(blob_payload, encryption_policy)
                        walrus_blob_id = self.walrus.store_data(encrypted_bytes)
                    else:
                        walrus_blob_id = self.walrus.store_data(blob_payload)

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
                    logger.info(f"Event {event_id} backed up to Walrus: {walrus_blob_id} (seal={bool(seal_meta)})")

                except Exception as e:
                    logger.warning(f"Failed to store event {event_id} to Walrus: {e}")
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

    def get_event(
        self,
        event_id: str,
        include_walrus_data: bool = False,
        decrypt_walrus: bool = False,
        user_id: Optional[str] = None,
        user_role: Optional[str] = None,
    ) -> Optional[Dict]:
        """
        Get event by ID.
        If include_walrus_data=True, also fetches the blob from Walrus.
        If decrypt_walrus=True and the blob is SEAL-encrypted, attempts SEAL decryption.
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

        # Optionally retrieve full data from Walrus (with SEAL detection/decrypt)
        if include_walrus_data and event.get('walrus_blob_id'):
            try:
                raw_bytes = self.walrus.retrieve_data(event['walrus_blob_id'])
                if decrypt_walrus and self.seal.detect_seal_blob(raw_bytes):
                    decrypted_bytes, allowed, reason = self.seal.decrypt_data(raw_bytes, user_id, user_role)
                    if not allowed or decrypted_bytes is None:
                        event['walrus_data'] = None
                        event['walrus_decrypt_error'] = reason
                    else:
                        event['walrus_data'] = json.loads(decrypted_bytes.decode('utf-8'))
                        event['walrus_decrypt_reason'] = reason
                else:
                    event['walrus_data'] = json.loads(raw_bytes.decode('utf-8'))
            except Exception as e:
                logger.warning(f"Failed to retrieve Walrus data for {event_id}: {e}")
                event['walrus_data'] = None

        return event

    def query_events(
        self,
        asset_address: Optional[str] = None,
        event_type: Optional[str] = None,
        limit: int = 100,
        since: Optional[datetime] = None,
        until: Optional[datetime] = None,
    ) -> List[Dict]:
        """Query events with simple filters. Returns list of event dicts."""
        clauses = []
        params = []

        if asset_address:
            clauses.append("asset_address = %s")
            params.append(asset_address)
        if event_type:
            clauses.append("event_type = %s")
            params.append(event_type)
        if since:
            clauses.append("block_timestamp >= %s")
            params.append(since)
        if until:
            clauses.append("block_timestamp <= %s")
            params.append(until)

        where_clause = ""
        if clauses:
            where_clause = "WHERE " + " AND ".join(clauses)

        query = f"""
            SELECT id, event_type, asset_address, block_timestamp, tx_hash, block_number, full_data, walrus_blob_id
            FROM aave_events
            {where_clause}
            ORDER BY block_timestamp DESC
            LIMIT %s
        """
        params.append(limit)

        results = self.db.execute_query(query, params=tuple(params))
        return [dict(r) for r in results] if results else []
