import urllib.parse

password = W/u99u#Wt+ZGFyY
encoded_password = urllib.parse.quote(password, safe=")

connection_string = fpostgresql://postgres:{encoded_password}@db.djxssxhnmucmvfugvyta.supabase.co:5432/postgres

env_content = f"# Supabase Database Configuration
DATABASE_URL={connection_string}

# Walrus Configuration
WALRUS_CONFIG=~/.config/walrus/client_config.yaml
WALRUS_CONTEXT=mainnet

# Flask Configuration
FLASK_PORT=5000
"

with open(.env, w) as f:
 f.write(env_content)

print(âœ“ .env file updated with database password)
