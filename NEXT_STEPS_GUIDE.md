# Next Steps Guide - Dual Storage System

## ✅ Completed Steps

1. ✅ **Code Structure** - All Python modules created and tested
2. ✅ **Dependencies** - Python packages installed (psycopg2, flask, dotenv)
3. ✅ **Integration Tests** - All tests passed
4. ✅ **Environment File** - `.env` file created (needs configuration)

## 🔧 Next Steps to Complete Setup

### Step 1: Install PostgreSQL

**Option A: Windows Installer (Recommended)**
1. Download PostgreSQL from: https://www.postgresql.org/download/windows/
2. Run the installer
3. Remember the password you set for the `postgres` user
4. Add PostgreSQL to PATH during installation

**Option B: Using Chocolatey**
```powershell
choco install postgresql
```

**Option C: Using WSL (Windows Subsystem for Linux)**
```powershell
wsl --install
# Then in WSL:
sudo apt-get update
sudo apt-get install postgresql-15
```

**Verify Installation:**
```powershell
psql --version
```

### Step 2: Set Up Database

**Run the setup script:**
```powershell
cd storage
.\setup_database.ps1
```

**Or manually:**

1. **Connect to PostgreSQL:**
   ```powershell
   psql -U postgres
   ```

2. **Create database and user:**
   ```sql
   CREATE DATABASE aave_dataset;
   CREATE USER aave_user WITH PASSWORD 'your_secure_password';
   GRANT ALL PRIVILEGES ON DATABASE aave_dataset TO aave_user;
   \q
   ```

3. **Apply schema:**
   ```powershell
   psql -U aave_user -d aave_dataset -f database/schema.sql
   ```

   Or from the project root:
   ```powershell
   psql -U aave_user -d aave_dataset -f "C:\Users\R_Lat\Downloads\fusion vault\database\schema.sql"
   ```

### Step 3: Configure Environment Variables

Edit `storage/.env` with your database credentials:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=aave_dataset
DB_USER=aave_user
DB_PASSWORD=your_secure_password  # Change this!
```

### Step 4: Test Database Connection

```powershell
cd storage
python test_database.py
```

Expected output:
```
Testing database connection...
[OK] Database connected successfully!
PostgreSQL version: PostgreSQL 15.x
[OK] Schema exists! Current event count: 0
```

### Step 5: (Optional) Set Up Walrus Protocol

Walrus is optional but recommended for decentralized backup.

**For Windows (requires WSL):**

1. **Install WSL:**
   ```powershell
   wsl --install
   ```

2. **In WSL, install Walrus:**
   ```bash
   curl -sSf https://docs.wal.app/setup/walrus-install.sh | sh
   export PATH="$HOME/.local/bin:$PATH"
   ```

3. **Install Sui CLI:**
   ```bash
   suiup install sui --branch mainnet
   ```

4. **Create Sui wallet:**
   ```bash
   sui client new-address ed25519
   sui client active-address
   ```

5. **Configure Walrus:**
   ```bash
   mkdir -p ~/.config/walrus
   curl https://docs.wal.app/setup/client_config.yaml -o ~/.config/walrus/client_config.yaml
   ```

6. **Test Walrus:**
   ```bash
   echo "test" > /tmp/test.txt
   walrus store /tmp/test.txt --epochs 1
   ```

**Or run the setup script:**
```powershell
cd storage
.\setup_walrus.ps1
```

### Step 6: Test Full System

```powershell
cd storage
python test_dual_storage.py
```

This will:
- Connect to PostgreSQL
- Store a test event
- Store to Walrus (if configured)
- Query events
- Verify data integrity

### Step 7: Start Flask API (Optional)

If you want to use the Flask API instead of CLI:

```powershell
cd storage
python app.py
```

The API will run on `http://localhost:5000`

**Test the API:**
```powershell
# Health check
curl http://localhost:5000/health

# Query events
curl http://localhost:5000/api/v1/aave-events?limit=10
```

### Step 8: Integrate with server.js

1. **Add environment variables to your main `.env` file:**
   ```env
   ENABLE_STORAGE=true
   USE_STORAGE_API=true
   STORAGE_API_URL=http://localhost:5000
   ```

2. **Add integration code to `server.js`:**

   At the top of `server.js`:
   ```javascript
   const { storeAaveEvent } = require('./storage/integrate_with_server.js');
   ```

   In your `/api/rsc-events` endpoint, after processing events:
   ```javascript
   // Store events to dual storage (PostgreSQL + Walrus)
   if (process.env.ENABLE_STORAGE === 'true') {
     for (const eventData of events) {
       // Only store ReactHandled events with Aave data, or StrategyUpdate events
       if ((eventData.eventType === 'ReactHandled' && eventData.originEvent?.decoded) ||
           eventData.eventType === 'StrategyUpdate') {
         storeAaveEvent(eventData).catch(err => {
           console.error(`Failed to store event ${eventData.transactionHash}: ${err.message}`);
         });
       }
     }
   }
   ```

3. **Install axios (if using API mode):**
   ```powershell
   npm install axios
   ```

4. **Start your server:**
   ```powershell
   node server.js
   ```

## 🧪 Testing Checklist

- [ ] PostgreSQL installed and running
- [ ] Database `aave_dataset` created
- [ ] User `aave_user` created with permissions
- [ ] Schema applied successfully
- [ ] `.env` file configured with correct credentials
- [ ] `python test_database.py` passes
- [ ] (Optional) Walrus CLI installed
- [ ] (Optional) `python test_walrus.py` passes
- [ ] `python test_dual_storage.py` passes
- [ ] Flask API starts without errors
- [ ] Integration with server.js works

## 📊 Verify Data Storage

**Query database directly:**
```powershell
psql -U aave_user -d aave_dataset
```

```sql
-- Count events
SELECT COUNT(*) FROM aave_events;

-- View recent events
SELECT event_type, asset_address, supply_apy_percent, block_timestamp 
FROM aave_events 
ORDER BY block_timestamp DESC 
LIMIT 10;

-- Check Walrus backups
SELECT COUNT(*) FROM aave_events WHERE walrus_blob_id IS NOT NULL;
```

**Query via API:**
```powershell
# Get recent events
curl http://localhost:5000/api/v1/aave-events?limit=10

# Filter by asset
curl http://localhost:5000/api/v1/aave-events?asset_address=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
```

## 🐛 Troubleshooting

### Database Connection Issues

**Error: "could not connect to server"**
- Check PostgreSQL is running: `Get-Service postgresql*`
- Verify host/port in `.env`
- Check firewall settings

**Error: "password authentication failed"**
- Verify password in `.env` matches database user password
- Check user exists: `psql -U postgres -c "\du"`

**Error: "database does not exist"**
- Create database: `CREATE DATABASE aave_dataset;`
- Grant permissions: `GRANT ALL PRIVILEGES ON DATABASE aave_dataset TO aave_user;`

### Walrus Issues

**Error: "walrus: command not found"**
- Install Walrus CLI (requires WSL or Linux)
- Add to PATH: `export PATH="$HOME/.local/bin:$PATH"`

**Error: "Sui wallet not configured"**
- Create wallet: `sui client new-address ed25519`
- Fund wallet with SUI tokens
- Update `client_config.yaml` with wallet path

### Python Import Issues

**Error: "No module named 'psycopg2'"**
- Install: `pip install -r requirements.txt`

**Error: "No module named 'flask'"**
- Install: `pip install flask`

## 📚 Additional Resources

- **Setup Guide**: `DUAL_STORAGE_SETUP_GUIDE.md`
- **Implementation Summary**: `DUAL_STORAGE_IMPLEMENTATION_SUMMARY.md`
- **Test Results**: `TEST_RESULTS.md`
- **Data Breakdown**: `AAVE_DATA_CAPTURE_DETAILED_BREAKDOWN.md`

## 🎯 Quick Start Commands

```powershell
# 1. Install dependencies
cd storage
pip install -r requirements.txt

# 2. Run setup
.\setup.ps1

# 3. Set up database
.\setup_database.ps1

# 4. Configure .env (edit manually)

# 5. Test database
python test_database.py

# 6. Test full system
python test_dual_storage.py

# 7. Start Flask API
python app.py

# 8. Integrate with server.js (add code)
```

---

**Status**: Ready for PostgreSQL setup  
**Next Action**: Install PostgreSQL and run `setup_database.ps1`

