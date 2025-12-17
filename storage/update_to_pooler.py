import urllib.parse
password = W/u99u#Wt+ZGFyY
encoded = urllib.parse.quote(password, safe=")
# Session Pooler format: postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres
# Try us-east-1 first (most common)
conn = fpostgresql://postgres.djxssxhnmucmvfugvyta:{encoded}@aws-0-us-east-1.pooler.supabase.com:6543/postgres
with open(.env, w) as f:
 f.write(# Supabase Database Configuration\n)
 f.write(# Using Session Pooler (IPv4 compatible, port 6543)\n)
 f.write(fDATABASE_URL={conn}\n)
 f.write(\n# Walrus Configuration\n)
 f.write(WALRUS_CONFIG=~/.config/walrus/client_config.yaml\n)
 f.write(WALRUS_CONTEXT=mainnet\n)
 f.write(\n# Flask Configuration\n)
 f.write(FLASK_PORT=5000\n)
print(âœ“ Updated to Session Pooler)
