#!/usr/bin/env python3
# test_integration.py - Comprehensive integration test

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_imports():
    """Test that all modules can be imported"""
    print("Testing imports...")
    try:
        from database import Database
        print("[OK] database.py imported")
        
        from walrus_service import WalrusService
        print("[OK] walrus_service.py imported")
        
        from dual_storage_service import DualStorageService
        print("[OK] dual_storage_service.py imported")
        
        return True
    except Exception as e:
        print(f"[FAIL] Import failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_database_structure():
    """Test database class structure"""
    print("\nTesting database structure...")
    try:
        from database import Database
        db = Database()
        
        # Check if methods exist
        assert hasattr(db, 'get_connection'), "Missing get_connection method"
        assert hasattr(db, 'execute_query'), "Missing execute_query method"
        print("[OK] Database class structure OK")
        return True
    except Exception as e:
        print(f"[FAIL] Database structure test failed: {e}")
        return False

def test_walrus_structure():
    """Test Walrus service structure"""
    print("\nTesting Walrus service structure...")
    try:
        from walrus_service import WalrusService
        walrus = WalrusService()
        
        # Check if methods exist
        assert hasattr(walrus, 'store_data'), "Missing store_data method"
        assert hasattr(walrus, 'store_json'), "Missing store_json method"
        assert hasattr(walrus, 'retrieve_data'), "Missing retrieve_data method"
        assert hasattr(walrus, 'retrieve_json'), "Missing retrieve_json method"
        print("[OK] WalrusService class structure OK")
        return True
    except Exception as e:
        print(f"[FAIL] Walrus structure test failed: {e}")
        return False

def test_dual_storage_structure():
    """Test dual storage service structure"""
    print("\nTesting dual storage structure...")
    try:
        from dual_storage_service import DualStorageService
        storage = DualStorageService()
        
        # Check if methods exist
        assert hasattr(storage, 'store_event'), "Missing store_event method"
        assert hasattr(storage, 'get_event'), "Missing get_event method"
        assert hasattr(storage, 'query_events'), "Missing query_events method"
        assert hasattr(storage, 'backup_to_walrus'), "Missing backup_to_walrus method"
        print("[OK] DualStorageService class structure OK")
        return True
    except Exception as e:
        print(f"[FAIL] Dual storage structure test failed: {e}")
        return False

def test_flask_app():
    """Test Flask app can be imported"""
    print("\nTesting Flask app...")
    try:
        import app
        assert hasattr(app, 'app'), "Missing Flask app instance"
        print("[OK] Flask app structure OK")
        return True
    except Exception as e:
        print(f"[FAIL] Flask app test failed: {e}")
        return False

def main():
    print("=" * 60)
    print("Dual Storage System Integration Test")
    print("=" * 60)
    
    results = []
    
    results.append(("Imports", test_imports()))
    results.append(("Database Structure", test_database_structure()))
    results.append(("Walrus Structure", test_walrus_structure()))
    results.append(("Dual Storage Structure", test_dual_storage_structure()))
    results.append(("Flask App", test_flask_app()))
    
    print("\n" + "=" * 60)
    print("Test Results Summary")
    print("=" * 60)
    
    for name, result in results:
        status = "[PASS]" if result else "[FAIL]"
        print(f"{status}: {name}")
    
    all_passed = all(result for _, result in results)
    
    if all_passed:
        print("\n[SUCCESS] All integration tests passed!")
        print("\nNext steps:")
        print("1. Set up PostgreSQL database")
        print("2. Configure .env file")
        print("3. Run: python test_database.py")
        print("4. Run: python test_walrus.py")
        print("5. Run: python test_dual_storage.py")
    else:
        print("\n[ERROR] Some tests failed. Please check the errors above.")
    
    return 0 if all_passed else 1

if __name__ == '__main__':
    sys.exit(main())

