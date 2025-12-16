# Supabase CLI Setup - Complete Guide

## ✅ Supabase CLI Installed!

Version: 2.65.5

---

## Setup Methods

### Method 1: Using Access Token (Recommended for CLI)

1. **Get your Supabase Access Token:**
   - Go to: https://supabase.com/dashboard/account/tokens
   - Click "Generate new token"
   - Copy the token

2. **Set environment variable:**
   ```powershell
   $env:SUPABASE_ACCESS_TOKEN = "your_token_here"
   ```

3. **Link project:**
   ```powershell
   supabase link --project-ref djxssxhnmucmvfugvyta
   ```

4. **Run setup:**
   ```powershell
   .\setup_with_supabase_cli.ps1
   ```

---

### Method 2: Using Password (Simpler - Recommended!)

Since CLI login requires interactive browser, use the password-based setup instead:

```powershell
.\setup_cli_simple.ps1 -Password 'your_database_password'
```

This is actually **faster and simpler** than the full CLI setup!

---

### Method 3: Manual CLI Login (If you can run interactively)

If you can run PowerShell interactively (not through this tool):

```powershell
# This will open a browser
supabase login

# Then link project
supabase link --project-ref djxssxhnmucmvfugvyta

# Then run setup
.\setup_with_supabase_cli.ps1
```

---

## Recommended: Use Password Method

Since we're in a non-interactive environment, the **simplest approach** is:

```powershell
.\setup_cli_simple.ps1 -Password 'your_database_password'
```

This will:
- ✅ Construct connection string automatically
- ✅ Configure .env file
- ✅ Work immediately without login

Then apply schema in Supabase SQL Editor.

---

## After Setup

1. **Apply schema:**
   - Go to: https://supabase.com/dashboard/project/djxssxhnmucmvfugvyta/sql/new
   - Paste `database\schema.sql`
   - Click "Run"

2. **Test:**
   ```powershell
   cd storage
   python test_database.py
   ```

---

**Quick Command:**
```powershell
.\setup_cli_simple.ps1 -Password 'your_password'
```

