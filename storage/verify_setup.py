#!/usr/bin/env python3
# Verify database setup

import sys
sys.stdout.reconfigure(encoding='utf-8')

from database import Database

print("=" * 60)
print("Database Setup Verification")
print("=" * 60)
print("")

try:
    db = Database()
    print("[OK] Database connected")
    
    # Check events
    result = db.execute_query("SELECT COUNT(*) as count FROM aave_events")
    event_count = result[0]['count']
    print(f"[OK] aave_events table: {event_count} events")
    
    # Check assets
    result = db.execute_query("SELECT COUNT(*) as count FROM assets")
    asset_count = result[0]['count']
    print(f"[OK] assets table: {asset_count} assets")
    
    # Show latest event if any
    if event_count > 0:
        result = db.execute_query("""
            SELECT id, asset_address, supply_apy_percent, borrow_apy_percent, server_timestamp
            FROM aave_events 
            ORDER BY server_timestamp DESC 
            LIMIT 1
        """)
        if result:
            event = result[0]
            print(f"\n[OK] Latest event:")
            print(f"  ID: {event['id']}")
            print(f"  Asset: {event['asset_address']}")
            print(f"  Supply APY: {event['supply_apy_percent']}%")
            print(f"  Borrow APY: {event['borrow_apy_percent']}%")
            print(f"  Timestamp: {event['server_timestamp']}")
    
    # Check column types
    result = db.execute_query("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'aave_events' 
        AND column_name LIKE '%ray'
        ORDER BY column_name
    """)
    print(f"\n[OK] RAY column types:")
    for row in result:
        print(f"  {row['column_name']}: {row['data_type']}")
    
    print("\n" + "=" * 60)
    print("[SUCCESS] Database setup verified!")
    print("=" * 60)
    
except Exception as e:
    print(f"[ERROR] Verification failed: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

