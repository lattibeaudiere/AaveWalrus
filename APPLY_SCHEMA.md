# Apply Database Schema - Quick Guide

## ✅ Connection Successful!

Your Supabase database is connected and ready!

## Apply Schema

### Step 1: Open Supabase SQL Editor

Go to: **https://supabase.com/dashboard/project/gaeauxyyfqavpqythore/sql/new**

### Step 2: Copy Schema

Open the file: `database\schema.sql`

Copy **ALL** contents (the entire file).

### Step 3: Paste and Run

1. Paste into Supabase SQL Editor
2. Click **"Run"** (or press Ctrl+Enter)
3. Wait for success message

### Step 4: Verify

Run this command:
```powershell
cd storage
python test_database.py
```

You should see:
```
[OK] Database connected successfully!
[OK] Schema exists! Current event count: 0
```

## Schema File Location

The schema file is at:
```
C:\Users\R_Lat\Downloads\fusion vault\database\schema.sql
```

## What the Schema Creates

- `assets` table - For asset references (USDC, WETH, etc.)
- `aave_events` table - Main table for storing Aave events
- Indexes for fast queries
- Walrus integration fields

## After Schema is Applied

1. ✅ Test connection: `python test_database.py`
2. ✅ Test full system: `python test_dual_storage.py`
3. ✅ Start Flask API: `python app.py`
4. ✅ Integrate with server.js

---

**Quick Link:** https://supabase.com/dashboard/project/gaeauxyyfqavpqythore/sql/new

