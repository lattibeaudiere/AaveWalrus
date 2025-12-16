# Dual Storage System Setup Guide
## PostgreSQL + Walrus Protocol for Aave Dataset Storage

This guide will help you set up the dual storage system for your Aave dataset application.

---

## Prerequisites

1. **PostgreSQL** (local or cloud)
2. **Python 3.8+** with pip
3. **Walrus CLI** installed
4. **Sui wallet** configured for Walrus
5. **Node.js** (existing server.js)

---

## Step 1: Set Up PostgreSQL Database

### 1.1 Install PostgreSQL

**macOS:**
```bash
brew install postgresql
brew services start postgresql
```

**Ubuntu/Debian:**
```bash
sudo apt-get install postgresql-15
sudo systemctl start postgresql
```

**Windows:**
Download from [postgresql.org](https://www.postgresql.org/download/windows/)

### 1.2 Create Database and User

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE aave_dataset;

# Create user
CREATE USER aave_user WITH PASSWORD 'your_secure_password';

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE aave_dataset TO aave_user;

# Exit
\q
```

### 1.3 Apply Schema

```bash
psql -U aave_user -d aave_dataset -f database/schema.sql
```

---

## Step 2: Set Up Walrus Protocol

### 2.1 Install Walrus CLI

```bash
curl -sSf https://docs.wal.app/setup/walrus-install.sh | sh
export PATH="$HOME/.local/bin:$PATH"
```

### 2.2 Set Up Sui Wallet

```bash
# Install Sui CLI
suiup install sui --branch mainnet

# Create wallet
sui client new-address ed25519

# Get your address
sui client active-address

# Fund wallet (get SUI from faucet or exchange for mainnet)
```

### 2.3 Configure Walrus

```bash
# Create config directory
mkdir -p ~/.config/walrus

# Download mainnet config
curl https://docs.wal.app/setup/client_config.yaml -o ~/.config/walrus/client_config.yaml
```

Edit `~/.config/walrus/client_config.yaml`:

```yaml
contexts:
  mainnet:
    system_object: 0x2134d52768ea07e8c43570ef975eb3e4c27a39fa6396bef985b5abc58d03ddd2
    staking_object: 0x10b9d30c28448939ce6c4d6c6e0ffce4a7f8a4ada8248bdad09ef8b70e4a3904
    subsidies_object: 0xb606eb177899edc2130c93bf65985af7ec959a2755dc126c953755e59324209e
    exchange_objects: []
    wallet_config:
      path: ~/.sui/sui_config/client.yaml
      active_env: mainnet
      active_address: YOUR_SUI_ADDRESS_HERE  # Get from: sui client active-address
default_context: mainnet
```

### 2.4 Test Walrus Setup

```bash
# Test store
echo "test aave data" > /tmp/test.json
walrus --config ~/.config/walrus/client_config.yaml store /tmp/test.json --epochs 1 --context mainnet

# Note the blob ID, then test retrieve
walrus --config ~/.config/walrus/client_config.yaml retrieve --blob-id YOUR_BLOB_ID --context mainnet
```

---

## Step 3: Install Python Dependencies

```bash
cd storage
pip install -r requirements.txt
```

---

## Step 4: Configure Environment Variables

Copy the example environment file:

```bash
cp storage/.env.example storage/.env
```

Edit `storage/.env`:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=aave_dataset
DB_USER=aave_user
DB_PASSWORD=your_secure_password

# Walrus Configuration
WALRUS_CONFIG=~/.config/walrus/client_config.yaml
WALRUS_CONTEXT=mainnet

# Flask Configuration
FLASK_PORT=5000
```

---

## Step 5: Test the System

### 5.1 Test Database Connection

```bash
cd storage
python test_database.py
```

### 5.2 Test Walrus Service

```bash
python test_walrus.py
```

### 5.3 Test Dual Storage

```bash
python test_dual_storage.py
```

---

## Step 6: Start Flask API (Optional)

If you want to use the Flask API instead of CLI:

```bash
cd storage
python app.py
```

The API will run on `http://localhost:5000`

---

## Step 7: Integrate with server.js

### Option A: Use Flask API (Recommended)

1. Start Flask API:
```bash
cd storage
python app.py
```

2. Add to your `.env`:
```env
ENABLE_STORAGE=true
USE_STORAGE_API=true
STORAGE_API_URL=http://localhost:5000
```

3. Add integration code to `server.js`:

```javascript
// At the top of server.js
const { storeAaveEvent } = require('./storage/integrate_with_server.js');

// In your /api/rsc-events endpoint, after processing events:
if (process.env.ENABLE_STORAGE === 'true') {
  for (const eventData of events) {
    // Only store ReactHandled events with Aave data, or StrategyUpdate events
    if ((eventData.eventType === 'ReactHandled' && eventData.originEvent && eventData.originEvent.decoded) ||
        eventData.eventType === 'StrategyUpdate') {
      storeAaveEvent(eventData).catch(err => {
        console.error(`Failed to store event ${eventData.transactionHash}: ${err.message}`);
      });
    }
  }
}
```

### Option B: Use Python CLI Script

1. Add to your `.env`:
```env
ENABLE_STORAGE=true
USE_STORAGE_API=false
```

2. Install axios in Node.js:
```bash
npm install axios
```

3. Add integration code to `server.js` (same as Option A, but `USE_STORAGE_API=false`)

---

## Step 8: Verify Data Storage

### Query Events via API

```bash
# Get recent events
curl http://localhost:5000/api/v1/aave-events?limit=10

# Get events for specific asset
curl http://localhost:5000/api/v1/aave-events?asset_address=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48

# Get events by type
curl http://localhost:5000/api/v1/aave-events?event_type=ReactHandled
```

### Query Database Directly

```bash
psql -U aave_user -d aave_dataset

# Count events
SELECT COUNT(*) FROM aave_events;

# View recent events
SELECT event_type, asset_address, supply_apy_percent, block_timestamp, walrus_blob_id 
FROM aave_events 
ORDER BY block_timestamp DESC 
LIMIT 10;

# Check Walrus backups
SELECT COUNT(*) FROM aave_events WHERE walrus_blob_id IS NOT NULL;
```

---

## Troubleshooting

### Database Connection Issues

- Verify PostgreSQL is running: `pg_isready`
- Check credentials in `.env`
- Verify database exists: `psql -U aave_user -d aave_dataset -c "SELECT 1"`

### Walrus Issues

- Verify Walrus CLI is installed: `walrus --version`
- Check Sui wallet: `sui client active-address`
- Verify config file exists: `cat ~/.config/walrus/client_config.yaml`
- Test with simple file: `echo "test" > /tmp/test.txt && walrus store /tmp/test.txt --epochs 1`

### Python Import Issues

- Make sure you're in the `storage` directory or have added it to PYTHONPATH
- Verify dependencies: `pip list | grep -E "psycopg2|flask|dotenv"`

### Integration Issues

- Check environment variables are set correctly
- Verify Flask API is running (if using API mode)
- Check Python script path is correct (if using CLI mode)
- Review server.js logs for storage errors

---

## Next Steps

1. **Monitor Storage**: Set up logging to track storage success/failures
2. **Export Data**: Create export scripts for CSV/JSON/Parquet formats
3. **Analytics**: Build queries for APY trends, volatility analysis
4. **Scale**: Consider partitioning for high-volume data
5. **Backup Strategy**: Set up regular Walrus backups for critical events

---

## Architecture Overview

```
Aave Protocol (Arbitrum)
    ↓
Reactive Network
    ↓
server.js (Node.js)
    ↓
[Storage Integration]
    ├─→ Flask API (Python) ──┐
    └─→ CLI Script (Python) ─┘
            ↓
    DualStorageService
    ├─→ PostgreSQL (Primary Storage)
    └─→ Walrus Protocol (Decentralized Backup)
```

---

## Support

For issues or questions:
1. Check logs in `storage/` directory
2. Review PostgreSQL logs
3. Check Walrus CLI output
4. Review server.js console output

