const { Pool } = require('pg');

// Connection string must come from env. Never hardcode credentials.
// Example (Supabase pooler):
//   PowerShell:  $env:DATABASE_URL="postgresql://USER:PASS@HOST:PORT/DB"; node scripts/db_add_indexes.js
//   bash:        DATABASE_URL="postgresql://USER:PASS@HOST:PORT/DB" node scripts/db_add_indexes.js
const DB_URL = process.env.DATABASE_URL || process.env.DB_URL;
if (!DB_URL) {
  console.error('ERROR: DATABASE_URL (or DB_URL) env var is required.');
  console.error('Set it to your Postgres connection string and re-run.');
  process.exit(1);
}
const pool = new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });

(async () => {
  const indexes = [
    {
      name: 'idx_enriched_events_explorer',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_enriched_events_explorer
            ON enriched_events (event_timestamp DESC)
            WHERE action_type IS NOT NULL
              AND action_type NOT IN ('UNKNOWN','RESERVE_DATA_UPDATED','TRANSFER','APPROVE','WRAP','UNWRAP')
              AND protocol_name IS NOT NULL
              AND protocol_name != 'Unknown'`
    },
    {
      name: 'idx_enriched_enriched_at',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_enriched_enriched_at
            ON enriched_events (enriched_at DESC)
            WHERE action_type IS NOT NULL`
    },
    {
      // Mirrors the ORDER BY / WHERE expression used in /api/explorer/events.
      // Without this, Postgres has to sort the entire filtered set instead of
      // walking an index, which dominates the cold-query latency.
      name: 'idx_enriched_events_explorer_coalesce',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_enriched_events_explorer_coalesce
            ON enriched_events ((COALESCE(event_timestamp, enriched_at)) DESC)
            WHERE action_type IS NOT NULL
              AND action_type NOT IN ('UNKNOWN','RESERVE_DATA_UPDATED','TRANSFER','APPROVE','WRAP','UNWRAP')
              AND protocol_name IS NOT NULL
              AND protocol_name != 'Unknown'`
    }
  ];

  for (const { name, sql } of indexes) {
    console.log(`Creating ${name}...`);
    const t0 = Date.now();
    try {
      await pool.query(sql);
      console.log(`  Done in ${Date.now() - t0}ms`);
    } catch (err) {
      console.log(`  Error: ${err.message}`);
    }
  }

  // Verify
  console.log('\nVerifying indexes:');
  const result = await pool.query(`SELECT indexname FROM pg_indexes WHERE tablename = 'enriched_events' ORDER BY indexname`);
  result.rows.forEach(r => console.log(`  ${r.indexname}`));

  await pool.end();
})();
