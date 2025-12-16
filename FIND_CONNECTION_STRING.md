# How to Find Your Database Connection String

## You Have:
- ✅ Project URL: `https://djxssxhnmucmvfugvyta.supabase.co`
- ✅ API Key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

## You Need:
- ⚠️ **Database Connection String** (PostgreSQL connection, not API key)

---

## Step-by-Step: Find Connection String

### 1. Go to Database Settings

**Direct Link:** https://supabase.com/dashboard/project/djxssxhnmucmvfugvyta/settings/database

Or navigate:
1. Go to your Supabase dashboard
2. Select your project
3. Click **Settings** (gear icon) in left sidebar
4. Click **Database** in settings menu

### 2. Find Connection String Section

Scroll down to **"Connection string"** section.

You'll see several options:
- **URI** ← **This is what we need!**
- Connection pooling
- Direct connection
- Session mode

### 3. Copy the URI Connection String

Click the **copy icon** next to **"URI"**

It will look like:
```
postgresql://postgres:[YOUR-PASSWORD]@db.djxssxhnmucmvfugvyta.supabase.co:5432/postgres
```

**Important:** The `[YOUR-PASSWORD]` part is the password you set when creating the Supabase project. If you forgot it, you'll need to reset it.

---

## If You Forgot Your Database Password

1. Go to: https://supabase.com/dashboard/project/djxssxhnmucmvfugvyta/settings/database
2. Scroll to **"Database password"** section
3. Click **"Reset database password"**
4. Set a new password (save it!)
5. Get the new connection string with the new password

---

## Once You Have the Connection String

Run this command:

```powershell
.\setup_supabase_project.ps1 -ConnectionString 'postgresql://postgres:YOUR_PASSWORD@db.djxssxhnmucmvfugvyta.supabase.co:5432/postgres'
```

Replace `YOUR_PASSWORD` with your actual database password.

---

## Visual Guide

In Supabase Dashboard:
```
Settings → Database
  ↓
Scroll to "Connection string"
  ↓
Find "URI" (not "Connection pooling")
  ↓
Copy the string
```

---

## Quick Links

- **Database Settings:** https://supabase.com/dashboard/project/djxssxhnmucmvfugvyta/settings/database
- **Reset Password:** Same page, scroll to "Database password" section

---

**Note:** The API key you have is different - that's for Supabase's REST API. We need the PostgreSQL connection string for direct database access.

