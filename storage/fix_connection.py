import urllib.parse
password = W/u99u#Wt+ZGFyY
encoded = urllib.parse.quote(password, safe=")
conn = fpostgresql://postgres.djxssxhnmucmvfugvyta:{encoded}@aws-0-us-west-2.pooler.supabase.com:5432/postgres
with open(.env, w) as f:
 f.write(# Supabase Database Configuration\n)
 f.write(# Using Transaction Pooler (us-west-2, port 5432)\n)
 f.write(fDATABASE_URL={conn}\n)
 f.write(\n# Walrus Configuration\n)
 f.write(WALRUS_CONFIG=~/.config/walrus/client_config.yaml\n)
 f.write(WALRUS_CONTEXT=mainnet\n)
 f.write(\n# Flask Configuration\n)
 f.write(FLASK_PORT=5000\n)
print(âœ“ Updated .env with correct connection string (us-west-2))
