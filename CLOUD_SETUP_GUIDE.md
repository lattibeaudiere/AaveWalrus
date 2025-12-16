# Cloud Database Setup Guide

## Recommended: Supabase (Easiest & Free)

### Why Supabase?
- ✅ **Free tier**: 500MB database, 2GB bandwidth
- ✅ **5-minute setup**
- ✅ **Automatic backups**
- ✅ **Web dashboard** for managing data
- ✅ **Connection pooling** included
- ✅ **PostgreSQL 15** (latest)

---

## Step 1: Create Supabase Account

1. Go to: https://supabase.com
2. Click **"Start your project"**
3. Sign up with GitHub (easiest) or email
4. Verify your email

---

## Step 2: Create New Project

1. Click **"New Project"**
2. Fill in:
   - **Name**: `aave-dataset` (or any name)
   - **Database Password**: Create a strong password (save it!)
   - **Region**: Choose closest to you
   - **Pricing Plan**: Free (for now)
3. Click **"Create new project"**
4. Wait 2-3 minutes for setup

---

## Step 3: Get Connection Details

1. In your Supabase project, go to **Settings** → **Database**
2. Find **Connection string** section
3. Copy the **URI** connection string
   - Format: `postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres`
4. Or note these details:
   - **Host**: `db.xxxxx.supabase.co`
   - **Port**: `5432`
   - **Database**: `postgres`
   - **User**: `postgres`
   - **Password**: (the one you created)

---

## Step 4: Apply Database Schema

### Option A: Using Supabase SQL Editor (Easiest)

1. In Supabase, go to **SQL Editor**
2. Click **"New query"**
3. Copy the contents of `database/schema.sql`
4. Paste into the editor
5. Click **"Run"** (or press Ctrl+Enter)
6. Verify success message

### Option B: Using psql Command Line

```powershell
# Install psql if needed (comes with PostgreSQL)
# Or use Supabase CLI

# Connect to Supabase
psql "postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres" -f database/schema.sql
```

---

## Step 5: Configure Environment

Edit `storage/.env`:

```env
# Supabase Database Configuration
DB_HOST=db.xxxxx.supabase.co
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=your_supabase_password_here

# Or use connection string (if your code supports it)
# DATABASE_URL=postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres

# Walrus Configuration (optional)
WALRUS_CONFIG=~/.config/walrus/client_config.yaml
WALRUS_CONTEXT=mainnet

# Flask Configuration
FLASK_PORT=5000
```

---

## Step 6: Test Connection

```powershell
cd storage
python test_database.py
```

Expected output:
```
[OK] Database connected successfully!
[OK] Schema exists! Current event count: 0
```

---

## Step 7: Test Full System

```powershell
python test_dual_storage.py
```

---

## Alternative: Neon (Serverless PostgreSQL)

### Why Neon?
- ✅ **Free tier**: 0.5GB storage
- ✅ **Serverless** (scales automatically)
- ✅ **Branching** (like Git for databases)
- ✅ **Very fast**

### Setup Steps:

1. Go to: https://neon.tech
2. Sign up with GitHub
3. Create new project
4. Copy connection string
5. Update `storage/.env` with connection details
6. Apply schema (same as Supabase)

---

## Alternative: Railway

### Why Railway?
- ✅ **$5 free credit/month**
- ✅ **Very easy setup**
- ✅ **One-click PostgreSQL**

### Setup Steps:

1. Go to: https://railway.app
2. Sign up with GitHub
3. Click **"New Project"**
4. Click **"Add PostgreSQL"**
5. Copy connection string
6. Update `storage/.env`
7. Apply schema

---

## Security Best Practices

### For Cloud Databases:

1. **Use connection pooling** (Supabase provides this)
2. **Enable SSL/TLS** (most cloud providers do this by default)
3. **Use environment variables** (never commit passwords)
4. **Restrict IP access** (if possible)
5. **Use strong passwords**
6. **Enable automatic backups**

### Update database.py for SSL:

```python
# In storage/database.py, update connection:
self.config = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': int(os.getenv('DB_PORT', 5432)),
    'database': os.getenv('DB_NAME', 'aave_dataset'),
    'user': os.getenv('DB_USER', 'aave_user'),
    'password': os.getenv('DB_PASSWORD'),
    'sslmode': 'require'  # Add this for cloud databases
}
```

---

## Cost Comparison

| Provider | Free Tier | Paid Plans Start At |
|----------|-----------|---------------------|
| **Supabase** | 500MB, 2GB bandwidth | $25/month |
| **Neon** | 0.5GB storage | $19/month |
| **Railway** | $5 credit/month | Pay-as-you-go |
| **AWS RDS** | 750 hours/month (12 months) | ~$15/month |
| **Azure** | Limited | ~$15/month |

**For your use case** (~6,480 events/day):
- **Supabase free tier** should last months
- Each event is ~1-2KB, so ~13MB/day
- 500MB = ~38 days of data
- You can upgrade when needed

---

## Migration from Local to Cloud

If you already have local data:

1. **Export from local database:**
   ```powershell
   pg_dump -U aave_user -d aave_dataset > backup.sql
   ```

2. **Import to cloud database:**
   ```powershell
   psql "postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres" < backup.sql
   ```

---

## Troubleshooting

### Connection Timeout
- Check firewall settings
- Verify host/port are correct
- Try from different network

### Authentication Failed
- Verify password is correct
- Check username (usually `postgres`)
- Ensure IP is allowed (if IP restrictions enabled)

### SSL Required
- Add `sslmode=require` to connection string
- Update `database.py` to include SSL config

---

## Next Steps After Cloud Setup

1. ✅ Test connection: `python test_database.py`
2. ✅ Test full system: `python test_dual_storage.py`
3. ✅ Start Flask API: `python app.py`
4. ✅ Integrate with server.js
5. ✅ Monitor usage in Supabase dashboard
6. ✅ Set up alerts for storage limits

---

## Recommended: Supabase Setup Script

I'll create an automated setup script for Supabase. See `setup_supabase.ps1` for one-command setup.

