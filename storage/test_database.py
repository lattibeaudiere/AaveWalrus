#!/usr/bin/env python3
# test_database.py - Test database connection

import sys
import os
from dotenv import load_dotenv

# Load .env from current directory
load_dotenv()

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import Database

def test_connection():
    """Test database connection"""
    try:
        db = Database()
        results = db.execute_query("SELECT version()")
        print("[OK] Database connected successfully!")
        print(f"PostgreSQL version: {results[0]['version']}")
        return True
    except Exception as e:
        print(f"[FAIL] Database connection failed: {e}")
        return False

def test_schema():
    """Test if schema exists"""
    try:
        db = Database()
        results = db.execute_query("SELECT COUNT(*) as count FROM aave_events")
        print(f"[OK] Schema exists! Current event count: {results[0]['count']}")
        return True
    except Exception as e:
        print(f"[FAIL] Schema test failed: {e}")
        print("   Make sure you've run: psql -U aave_user -d aave_dataset -f ../database/schema.sql")
        return False

if __name__ == '__main__':
    print("Testing database connection...")
    if test_connection():
        test_schema()

