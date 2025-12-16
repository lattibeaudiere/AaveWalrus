# Quick Docker Setup Guide

## Step 1: Start Docker Desktop

1. **Open Docker Desktop** from your Start menu or system tray
2. **Wait for Docker to start** (you'll see "Docker Desktop is running" in the system tray)
3. **Verify Docker is running:**
   ```powershell
   docker ps
   ```
   Should show an empty list (no error)

## Step 2: Run Setup Script

```powershell
cd "C:\Users\R_Lat\Downloads\fusion vault"
.\setup_with_docker.ps1
```

This will:
- Start PostgreSQL container
- Apply database schema automatically
- Configure environment variables
- Test the connection

## Step 3: Verify Setup

```powershell
cd storage
python test_database.py
```

Expected output:
```
[OK] Database connected successfully!
[OK] Schema exists! Current event count: 0
```

## Alternative: Manual Docker Commands

If the script doesn't work, run these manually:

```powershell
# Start PostgreSQL container
docker-compose up -d postgres

# Wait a few seconds for it to start
Start-Sleep -Seconds 10

# Check if it's running
docker ps

# View logs if needed
docker logs aave_dataset_db

# Test connection
cd storage
python test_database.py
```

## Troubleshooting

**Docker daemon not running:**
- Start Docker Desktop
- Wait for it to fully start
- Try `docker ps` to verify

**Container won't start:**
- Check logs: `docker logs aave_dataset_db`
- Port 5432 might be in use
- Try: `docker-compose down` then `docker-compose up -d postgres`

**Connection refused:**
- Wait longer for PostgreSQL to initialize (30-60 seconds)
- Check container status: `docker ps`
- Verify port: `netstat -an | findstr 5432`

## Useful Commands

```powershell
# View running containers
docker ps

# View all containers (including stopped)
docker ps -a

# Stop container
docker stop aave_dataset_db

# Start container
docker start aave_dataset_db

# Remove container and volumes
docker-compose down -v

# View container logs
docker logs aave_dataset_db

# Connect to database directly
docker exec -it aave_dataset_db psql -U aave_user -d aave_dataset
```

