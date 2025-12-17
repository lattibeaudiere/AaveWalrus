## Integration tests (Mainnet / staging)

This project provides a gated integration workflow that runs end-to-end tests
against real SEAL and Walrus services. These tests are manual by design and
require repository secrets/environment protection to avoid accidental runs.

Required secrets (examples):
- `DATABASE_URL` – connection string for a staging Postgres/Supabase DB
- `SEAL_WRAPPER_URL` – URL to a running SEAL wrapper (or a wrapper you run in CI)
- `WALRUS_WALLET_KEY` (optional) – wallet/private key used by Walrus CLI if needed

How to run:
1. Configure a protected environment named `integration` in GitHub repository
   settings and require approvals for it.
2. Add the required secrets into repository secrets (or environment secrets).
3. Open the Actions tab, choose **Integration tests (gated)** and run it
   via the manual "Run workflow" button.

Notes:
- The job runs `storage/test_seal_integration.py` and will perform real Walrus
  storage operations (costs in WAL/SUI). Use a staging DB and a funded test
  wallet to avoid affecting production data or incurring unexpected charges.
- If you prefer the workflow to start a local wrapper instead of using
  `SEAL_WRAPPER_URL`, modify the job accordingly but **only** do so after
  reviewing security/credentials implications.
