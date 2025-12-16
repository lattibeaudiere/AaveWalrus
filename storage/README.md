# Aave Dataset Storage Service

Dual storage system (PostgreSQL + Walrus Protocol) for storing Aave V3 ReserveDataUpdated events.

## Quick Start

1. **Set up PostgreSQL:**
   ```bash
   psql -U postgres
   CREATE DATABASE aave_dataset;
   CREATE USER aave_user WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE aave_dataset TO aave_user;
   \q
   psql -U aave_user -d aave_dataset -f ../database/schema.sql
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

4. **Test the system:**
   ```bash
   python test_database.py
   python test_walrus.py
   python test_dual_storage.py
   ```

5. **Start Flask API (optional):**
   ```bash
   python app.py
   ```

## Integration with server.js

See `integrate_with_server.js` for integration code and `DUAL_STORAGE_SETUP_GUIDE.md` for complete setup instructions.

## Files

- `database.py` - PostgreSQL connection and query execution
- `walrus_service.py` - Walrus Protocol storage and retrieval
- `dual_storage_service.py` - Combined storage service
- `app.py` - Flask API endpoints
- `store_aave_event.py` - CLI script for Node.js integration
- `test_*.py` - Test scripts

## API Endpoints (Flask)

- `POST /api/v1/aave-events` - Store new event
- `GET /api/v1/aave-events` - Query events
- `GET /api/v1/aave-events/<event_id>` - Get event by ID
- `POST /api/v1/aave-events/<event_id>/backup` - Backup event to Walrus

