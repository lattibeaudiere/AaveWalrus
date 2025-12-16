# Cloud Database Setup - CLI Commands

## Quick Setup (Copy & Paste)

### Step 1: Sign Up for Supabase

1. Go to: https://supabase.com
2. Click "Start your project"
3. Sign up (GitHub recommended)
4. Verify email

### Step 2: Create Project

1. Click "New Project"
2. Fill in:
   - **Name**: `aave-dataset`
   - **Database Password**: Create strong password (SAVE IT!)
   - **Region**: Choose closest
   - **Plan**: Free
3. Click "Create new project"
4. Wait 2-3 minutes

### Step 3: Get Connection String

1. In Supabase project → **Settings** → **Database**
2. Find **Connection string** → **URI**
3. Copy the connection string (looks like):
   ```
   postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres
   ```

### Step 4: Configure Environment

**Run these commands:**

```powershell
cd "C:\Users\R_Lat\Downloads\fusion vault\storage"

# Backup existing .env if it exists
if (Test-Path .env) { Copy-Item .env .env.backup }

# Create/update .env with connection string
# Replace YOUR_CONNECTION_STRING with your actual connection string
@"
DATABASE_URL=YOUR_CONNECTION_STRING_HERE
WALRUS_CONFIG=~/.config/walrus/client_config.yaml
WALRUS_CONTEXT=mainnet
FLASK_PORT=5000
ARBITRUM_RPC=https://arb1.arbitrum.io/rpc
REACTIVE_NETWORK_RPC=https://mainnet-rpc.rnk.dev
"@ | Out-File -FilePath .env -Encoding utf8

Write-Host "[OK] .env file created. Now edit it and add your connection string!" -ForegroundColor Green
```

**Then edit `.env` file and replace `YOUR_CONNECTION_STRING_HERE` with your actual connection string.**

### Step 5: Apply Schema

**Option A: Using Supabase SQL Editor (Easiest)**

1. In Supabase → **SQL Editor** → **New query**
2. Open file: `database\schema.sql`
3. Copy entire contents
4. Paste into SQL Editor
5. Click **Run** (or Ctrl+Enter)

**Option B: Using psql (if installed)**

```powershell
cd "C:\Users\R_Lat\Downloads\fusion vault"
# Replace with your connection string
psql "postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres" -f database\schema.sql
```

### Step 6: Test Connection

```powershell
cd "C:\Users\R_Lat\Downloads\fusion vault\storage"
python test_database.py
```

**Expected output:**
```
[OK] Database connected successfully!
[OK] Schema exists! Current event count: 0
```

---

## One-Line Setup (After Getting Connection String)

Once you have your Supabase connection string, run:

```powershell
cd "C:\Users\R_Lat\Downloads\fusion vault\storage"; $conn = Read-Host "Paste connection string"; @"
DATABASE_URL=$conn
WALRUS_CONFIG=~/.config/walrus/client_config.yaml
WALRUS_CONTEXT=mainnet
FLASK_PORT=5000
ARBITRUM_RPC=https://arb1.arbitrum.io/rpc
REACTIVE_NETWORK_RPC=https://mainnet-rpc.rnk.dev
"@ | Out-File -FilePath .env -Encoding utf8; Write-Host "[OK] .env configured!" -ForegroundColor Green; Write-Host "Next: Apply schema in Supabase SQL Editor, then run: python test_database.py" -ForegroundColor Yellow
```

---

## Verify Setup

```powershell
# Test database connection
cd "C:\Users\R_Lat\Downloads\fusion vault\storage"
python test_database.py

# Test full system
python test_dual_storage.py

# Start Flask API
python app.py
```

---

## Troubleshooting

**Connection failed:**
- Check connection string is correct
- Verify password is correct
- Make sure schema is applied

**Schema errors:**
- Apply schema in Supabase SQL Editor
- Check for error messages
- Verify tables were created

**SSL errors:**
- Code automatically handles SSL for cloud databases
- If issues, check firewall settings

