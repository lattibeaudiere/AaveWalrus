# CLI Setup Guide - Supabase Database

## Quickest Method (Just Need Password)

If you know your database password, run:

```powershell
.\setup_cli_simple.ps1 -Password 'your_database_password'
```

This will:
- ✅ Construct the connection string automatically
- ✅ Configure `storage/.env` file
- ✅ Backup existing .env if it exists

**That's it!** Then just apply the schema.

---

## Method 1: Simple CLI Setup

**Requirements:** Just your database password

```powershell
.\setup_cli_simple.ps1 -Password 'your_password_here'
```

**What it does:**
- Constructs connection string: `postgresql://postgres:password@db.djxssxhnmucmvfugvyta.supabase.co:5432/postgres`
- Creates/updates `storage/.env`
- Backs up existing .env

---

## Method 2: Full CLI Setup (With Supabase CLI)

**Requirements:** Supabase CLI installed (optional)

### Install Supabase CLI:
```powershell
npm install -g supabase
```

### Login and Link:
```powershell
supabase login
supabase link --project-ref djxssxhnmucmvfugvyta
```

### Run Setup:
```powershell
.\setup_via_cli.ps1 -DatabasePassword 'your_password'
```

Or if Supabase CLI is configured:
```powershell
.\setup_via_cli.ps1
```

---

## Method 3: Manual Connection String

If you have the full connection string:

```powershell
.\setup_supabase_project.ps1 -ConnectionString 'postgresql://postgres:password@db.djxssxhnmucmvfugvyta.supabase.co:5432/postgres'
```

---

## After Setup: Apply Schema

### Option A: Supabase SQL Editor (Easiest)

1. Go to: https://supabase.com/dashboard/project/djxssxhnmucmvfugvyta/sql/new
2. Open `database\schema.sql`
3. Copy all contents
4. Paste into SQL Editor
5. Click "Run"

### Option B: Supabase CLI (If Installed)

```powershell
supabase db push
```

Or manually:
```powershell
# If you have psql installed
psql "postgresql://postgres:password@db.djxssxhnmucmvfugvyta.supabase.co:5432/postgres" -f database\schema.sql
```

---

## Test Connection

```powershell
cd storage
python test_database.py
```

**Expected:**
```
[OK] Database connected successfully!
[OK] Schema exists! Current event count: 0
```

---

## If You Forgot Your Password

1. Go to: https://supabase.com/dashboard/project/djxssxhnmucmvfugvyta/settings/database
2. Scroll to "Database password"
3. Click "Reset database password"
4. Set new password
5. Use new password in setup command

---

## Complete Example

```powershell
# Step 1: Setup (replace with your password)
.\setup_cli_simple.ps1 -Password 'MySecurePassword123'

# Step 2: Apply schema in Supabase SQL Editor
# (Go to SQL Editor, paste schema.sql, run)

# Step 3: Test
cd storage
python test_database.py

# Step 4: Test full system
python test_dual_storage.py
```

---

## Troubleshooting

**"Password authentication failed"**
- Verify password is correct
- Reset password in Supabase dashboard if needed

**"Connection refused"**
- Check firewall settings
- Verify project is active in Supabase

**"Schema not found"**
- Make sure you applied schema in SQL Editor
- Check for errors in SQL Editor

---

**Quickest Path:** Just run `.\setup_cli_simple.ps1 -Password 'your_password'` and you're done! 🚀

