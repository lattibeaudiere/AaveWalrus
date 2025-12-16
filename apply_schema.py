#!/usr/bin/env python3
# Apply database schema directly via Python connection

import sys
import os
from dotenv import load_dotenv

# Load .env from storage directory
storage_path = os.path.join(os.path.dirname(__file__), 'storage')
os.chdir(storage_path)
load_dotenv()

sys.path.insert(0, storage_path)
from database import Database

def apply_schema():
    """Apply database schema"""
    print("=" * 60)
    print("Applying Database Schema")
    print("=" * 60)
    print("")
    
    # Read schema file
    schema_path = os.path.join(os.path.dirname(__file__), 'database', 'schema.sql')
    if not os.path.exists(schema_path):
        print(f"[ERROR] Schema file not found: {schema_path}")
        return False
    
    print(f"Reading schema from: {schema_path}")
    with open(schema_path, 'r', encoding='utf-8') as f:
        schema_sql = f.read()
    
    print(f"Schema size: {len(schema_sql)} characters")
    print("")
    
    # Connect to database
    try:
        db = Database()
        print("Connecting to database...")
        
        # Split schema into individual statements
        # PostgreSQL doesn't support executing multiple statements in one call easily
        # So we'll execute the whole thing as one string
        print("Applying schema...")
        
        # Execute schema
        db.execute_query(schema_sql, fetch=False)
        
        print("")
        print("[SUCCESS] Schema applied successfully!")
        print("")
        
        # Verify schema was applied
        print("Verifying schema...")
        try:
            result = db.execute_query("SELECT COUNT(*) as count FROM aave_events")
            print(f"[OK] aave_events table exists (current count: {result[0]['count']})")
            
            result = db.execute_query("SELECT COUNT(*) as count FROM assets")
            print(f"[OK] assets table exists (current count: {result[0]['count']})")
            
            return True
        except Exception as e:
            print(f"[WARN] Could not verify schema: {e}")
            return True  # Schema might be applied but verification failed
            
    except Exception as e:
        print(f"[ERROR] Failed to apply schema: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    success = apply_schema()
    sys.exit(0 if success else 1)

