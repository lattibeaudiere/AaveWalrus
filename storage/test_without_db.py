#!/usr/bin/env python3
# test_without_db.py - Test storage code without database connection
# Useful for verifying code structure before database setup

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_imports():
    """Test that all modules can be imported"""
    print("Testing imports...")
    try:
        from database import Database
        from walrus_service import WalrusService
        from dual_storage_service import DualStorageService
        print("[OK] All modules imported successfully")
        return True
    except Exception as e:
        print(f"[FAIL] Import failed: {e}")
        return False

def test_database_class():
    """Test Database class structure"""
    print("\nTesting Database class...")
    try:
        from database import Database
        db = Database()
        
        # Check configuration
        assert hasattr(db, 'config'), "Missing config attribute"
        assert db.config is not None, "Config is None"
        print(f"[OK] Database class initialized")
        print(f"     Config: host={db.config.get('host')}, db={db.config.get('database')}")
        return True
    except Exception as e:
        print(f"[FAIL] Database class test failed: {e}")
        return False

def test_walrus_class():
    """Test WalrusService class structure"""
    print("\nTesting WalrusService class...")
    try:
        from walrus_service import WalrusService
        walrus = WalrusService()
        
        assert hasattr(walrus, 'config_path'), "Missing config_path"
        assert hasattr(walrus, 'context'), "Missing context"
        print(f"[OK] WalrusService class initialized")
        print(f"     Config path: {walrus.config_path}")
        print(f"     Context: {walrus.context}")
        return True
    except Exception as e:
        print(f"[FAIL] WalrusService class test failed: {e}")
        return False

def test_dual_storage_class():
    """Test DualStorageService class structure"""
    print("\nTesting DualStorageService class...")
    try:
        from dual_storage_service import DualStorageService
        
        # This will fail to connect to DB, but we can test structure
        try:
            storage = DualStorageService()
            print("[OK] DualStorageService class initialized")
            print("     (Database connection will be tested when DB is available)")
            return True
        except Exception as e:
            # If it's a connection error, that's expected
            if "connection" in str(e).lower() or "password" in str(e).lower():
                print("[OK] DualStorageService class structure OK")
                print("     (Database not available - this is expected)")
                return True
            else:
                raise
    except Exception as e:
        print(f"[FAIL] DualStorageService class test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_env_file():
    """Test environment file exists"""
    print("\nTesting environment file...")
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    if os.path.exists(env_path):
        print(f"[OK] .env file exists: {env_path}")
        
        # Try to load it
        try:
            from dotenv import load_dotenv
            load_dotenv(env_path)
            print("[OK] .env file loaded successfully")
            
            # Check key variables
            db_host = os.getenv('DB_HOST', 'not set')
            db_name = os.getenv('DB_NAME', 'not set')
            print(f"     DB_HOST: {db_host}")
            print(f"     DB_NAME: {db_name}")
            return True
        except Exception as e:
            print(f"[WARN] Could not load .env: {e}")
            return False
    else:
        print(f"[WARN] .env file not found: {env_path}")
        print("     Create it from .env.example")
        return False

def main():
    print("=" * 60)
    print("Storage System Test (Without Database)")
    print("=" * 60)
    
    results = []
    results.append(("Imports", test_imports()))
    results.append(("Database Class", test_database_class()))
    results.append(("Walrus Class", test_walrus_class()))
    results.append(("Dual Storage Class", test_dual_storage_class()))
    results.append(("Environment File", test_env_file()))
    
    print("\n" + "=" * 60)
    print("Test Results Summary")
    print("=" * 60)
    
    for name, result in results:
        status = "[PASS]" if result else "[FAIL]"
        print(f"{status}: {name}")
    
    all_passed = all(result for _, result in results)
    
    if all_passed:
        print("\n[SUCCESS] All structure tests passed!")
        print("\nNext: Set up PostgreSQL database")
        print("  Option 1: Use Docker - run: ..\setup_with_docker.ps1")
        print("  Option 2: Install PostgreSQL manually - see NEXT_STEPS_GUIDE.md")
    else:
        print("\n[ERROR] Some tests failed. Please check the errors above.")
    
    return 0 if all_passed else 1

if __name__ == '__main__':
    sys.exit(main())

