# Fix .env file with properly encoded connection string

$password = "W/u99u#Wt+ZGFyY"
$encodedPassword = [System.Web.HttpUtility]::UrlEncode($password)

# Alternative: Use Python to encode
$pythonScript = @"
import urllib.parse
password = 'W/u99u#Wt+ZGFyY'
encoded = urllib.parse.quote(password, safe='')
print(encoded)
"@

$encoded = python -c $pythonScript

$connectionString = "postgresql://postgres:$encoded@db.djxssxhnmucmvfugvyta.supabase.co:5432/postgres"

$envContent = @"
# Supabase Cloud Database Configuration
# Project: djxssxhnmucmvfugvyta
DATABASE_URL=$connectionString

# Walrus Configuration (optional)
WALRUS_CONFIG=~/.config/walrus/client_config.yaml
WALRUS_CONTEXT=mainnet

# Flask Configuration
FLASK_PORT=5000

# Aave Integration
ARBITRUM_RPC=https://arb1.arbitrum.io/rpc
REACTIVE_NETWORK_RPC=https://mainnet-rpc.rnk.dev
"@

Set-Content -Path .env -Value $envContent -Encoding utf8
Write-Host "[OK] .env file fixed with properly encoded connection string" -ForegroundColor Green
Write-Host "Connection string: $connectionString" -ForegroundColor Gray

