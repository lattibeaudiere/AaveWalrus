# Quick Start - Dual Storage System

## 🚀 Fastest Path to Running

### Prerequisites Check
```powershell
# Check Python
python --version  # Should be 3.8+

# Check if dependencies installed
cd storage
python -c "import psycopg2, flask, dotenv; print('OK')"
```

### 1. Install PostgreSQL (5 minutes)

**Windows:**
1. Download: https://www.postgresql.org/download/windows/
2. Install with default settings
3. Remember the `postgres` user password

**Or use Chocolatey:**
```powershell
choco install postgresql
```

### 2. Create Database (2 minutes)

```powershell
# Connect to PostgreSQL
psql -U postgres

# Run these commands:
CREATE DATABASE aave_dataset;
CREATE USER aave_user WITH PASSWORD 'your_password_here';
GRANT ALL PRIVILEGES ON DATABASE aave_dataset TO aave_user;
\q

# Apply schema
psql -U aave_user -d aave_dataset -f database\schema.sql
```

### 3. Configure Environment (1 minute)

Edit `storage/.env`:
```env
DB_PASSWORD=your_password_here  # Change this!
```

### 4. Test (30 seconds)

```powershell
cd storage
python test_database.py
```

**Expected output:**
```
[OK] Database connected successfully!
[OK] Schema exists! Current event count: 0
```

### 5. Start Capturing Data

**Option A: Use Flask API**
```powershell
cd storage
python app.py
```

**Option B: Integrate with server.js**
1. Add to `.env`:
   ```env
   ENABLE_STORAGE=true
   USE_STORAGE_API=true
   STORAGE_API_URL=http://localhost:5000
   ```

2. Add to `server.js`:
   ```javascript
   const { storeAaveEvent } = require('./storage/integrate_with_server.js');
   
   // In /api/rsc-events endpoint:
   if (process.env.ENABLE_STORAGE === 'true') {
     for (const eventData of events) {
       if (eventData.eventType === 'ReactHandled' && eventData.originEvent?.decoded) {
         storeAaveEvent(eventData).catch(console.error);
       }
     }
   }
   ```

3. Start server:
   ```powershell
   node server.js
   ```

## ✅ Done!

Your Aave events are now being stored in PostgreSQL!

### Verify It's Working

```powershell
# Query database
psql -U aave_user -d aave_dataset -c "SELECT COUNT(*) FROM aave_events;"

# Or via API
curl http://localhost:5000/api/v1/aave-events?limit=5
```

## 🎯 Next Steps (Optional)

- Set up Walrus for decentralized backup
- Build analytics queries
- Export data for analysis
- Scale for production

See `NEXT_STEPS_GUIDE.md` for detailed instructions.
