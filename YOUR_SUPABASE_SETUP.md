# Your Supabase Setup - Quick Guide

## Your Project Details

**Project ID:** `djxssxhnmucmvfugvyta`  
**Project URL:** https://djxssxhnmucmvfugvyta.supabase.co

---

## Step 1: Get Connection String

1. Go to: **https://supabase.com/dashboard/project/djxssxhnmucmvfugvyta/settings/database**
2. Scroll to **"Connection string"** section
3. Find **"URI"** connection string
4. Copy the entire string

It should look like:
```
postgresql://postgres:[YOUR-PASSWORD]@db.djxssxhnmucmvfugvyta.supabase.co:5432/postgres
```

---

## Step 2: Configure Environment

Run this command (replace with your actual connection string):

```powershell
.\setup_supabase_project.ps1 -ConnectionString 'postgresql://postgres:your_password@db.djxssxhnmucmvfugvyta.supabase.co:5432/postgres'
```

This will:
- ✅ Create/update `storage/.env` file
- ✅ Configure database connection
- ✅ Backup existing .env if it exists

---

## Step 3: Apply Database Schema

1. Go to: **https://supabase.com/dashboard/project/djxssxhnmucmvfugvyta/sql/new**
2. Open file: `database\schema.sql`
3. Copy **entire contents**
4. Paste into Supabase SQL Editor
5. Click **"Run"** (or press Ctrl+Enter)
6. Verify success message

---

## Step 4: Test Connection

```powershell
cd storage
python test_database.py
```

**Expected output:**
```
[OK] Database connected successfully!
[OK] Schema exists! Current event count: 0
```

---

## Step 5: Test Full System

```powershell
python test_dual_storage.py
```

---

## Quick Links

- **Dashboard:** https://supabase.com/dashboard/project/djxssxhnmucmvfugvyta
- **Database Settings:** https://supabase.com/dashboard/project/djxssxhnmucmvfugvyta/settings/database
- **SQL Editor:** https://supabase.com/dashboard/project/djxssxhnmucmvfugvyta/sql/new
- **Table Editor:** https://supabase.com/dashboard/project/djxssxhnmucmvfugvyta/editor

---

## Troubleshooting

**Connection failed:**
- Verify connection string is correct
- Check password is correct
- Make sure schema is applied

**Schema errors:**
- Apply schema in SQL Editor
- Check for error messages
- Verify tables were created (check Table Editor)

**SSL errors:**
- Code automatically handles SSL
- If issues persist, check firewall

---

## Next Steps After Setup

1. ✅ Test connection: `python test_database.py`
2. ✅ Test full system: `python test_dual_storage.py`
3. ✅ Start Flask API: `python app.py`
4. ✅ Integrate with server.js
5. ✅ Monitor usage in Supabase dashboard

---

**Ready to start capturing Aave events!** 🚀

