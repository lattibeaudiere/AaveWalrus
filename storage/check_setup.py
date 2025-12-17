import sys
sys.path.insert(0, .)
sys.stdout.reconfigure(encoding=utf-8)

print(=== Checking Database Connection ===)
try:
    from database import Database
    db = Database()
    result = db.execute_query(SELECT version())
    print(âœ“ Database connected:, result[0][version][:50] + ...)
    
    tables = db.execute_query("
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = "public" 
        AND table_name IN (" assets\, \aave_events\)
 ")
 table_names = [row[table_name] for row in tables]
 print(âœ“ Tables found:, table_names)
 
 if aave_events in table_names:
 columns = db.execute_query("
 SELECT column_name 
 FROM information_schema.columns 
 WHERE table_name = \aave_events\ 
 AND column_name IN (\walrus_blob_id\, \walrus_backed_up_at\)
 ")
 col_names = [row[column_name] for row in columns]
 print(âœ“ Walrus columns:, col_names)
 
 print(\n=== Checking Walrus ===)
 from walrus_service import WalrusService
 ws = WalrusService()
 print(âœ“ Walrus context:, ws.context)
 
 print(\n=== Dual Storage Ready ===)
 from dual_storage_service import DualStorageService
 storage = DualStorageService()
 print(âœ“ Dual storage service initialized)
 
except Exception as e:
 print(âœ— Error:, e)
 import traceback
 traceback.print_exc()
 sys.exit(1)
