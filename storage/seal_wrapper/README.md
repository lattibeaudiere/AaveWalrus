Seal wrapper
=============

Small Node.js wrapper that exposes `/encrypt` and `/decrypt` endpoints for use by `storage/seal_service.py`.

Usage:

1. Install dependencies:

```bash
cd storage/seal_wrapper
npm install
```

2. Start the server:

```bash
SEAL_WRAPPER_PORT=3001 node index.js
```

3. Configure Python service to use it by setting in `storage/.env`:

```
SEAL_WRAPPER_URL=http://localhost:3001
```

The current implementation uses a mock encrypt/decrypt behavior. If you want to wire the real SEAL SDK, replace the mock functions in `index.js` with SDK calls.
