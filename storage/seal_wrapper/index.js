import express from 'express';
import bodyParser from 'body-parser';
import { SealClient } from '@mysten/seal';

// Try to dynamically import Sui utilities; fall back to minimal implementations
let SuiClientImport = null;
let getFullnodeUrl = (network) => {
  if (network === 'mainnet') return 'https://fullnode.mainnet.sui.io:443';
  if (network === 'testnet') return 'https://fullnode.testnet.sui.io:443';
  return 'https://fullnode.mainnet.sui.io:443';
};

async function tryImportSui() {
  if (SuiClientImport) return SuiClientImport;
  try {
    const mod = await import('@mysten/sui/client');
    SuiClientImport = { SuiClient: mod.SuiClient, getFullnodeUrl: mod.getFullnodeUrl };
    getFullnodeUrl = SuiClientImport.getFullnodeUrl;
    return SuiClientImport;
  } catch (e) {
    try {
      const mod = await import('@mysten/sui');
      SuiClientImport = { SuiClient: mod.SuiClient, getFullnodeUrl: mod.getFullnodeUrl };
      getFullnodeUrl = SuiClientImport.getFullnodeUrl;
      return SuiClientImport;
    } catch (e2) {
      SuiClientImport = null;
      return null;
    }
  }
}

const app = express();
app.use(bodyParser.json({ limit: '10mb' }));

const NETWORK = process.env.SEAL_NETWORK || 'mainnet';
const PORT = process.env.SEAL_WRAPPER_PORT || 3001;
const THRESHOLD = parseInt(process.env.SEAL_THRESHOLD || '2', 10);

// Initialize Sui & SEAL clients lazily (to avoid startup error if env not set during tests)
let sealClient = null;
let suiClient = null;
let keyServerObjectIds = null;

async function initSeal() {
  if (sealClient) return;
  const imported = await tryImportSui();
  if (imported && imported.SuiClient) {
    suiClient = new imported.SuiClient({ url: getFullnodeUrl(NETWORK) });
  } else {
    const fullnode = getFullnodeUrl(NETWORK);
    suiClient = {
      async getLatestSuiSystemState() {
        try {
          const resp = await fetch(fullnode, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'sui_getLatestSuiSystemState', params: [] })
          });
          const j = await resp.json();
          return j.result || { epoch: 0 };
        } catch (e) {
          return { epoch: 0 };
        }
      }
    };
  }

  // Try to obtain allowlisted key server object IDs from the SDK if available
  try {
    const mod = await import('@mysten/seal');
    if (mod.getAllowlistedKeyServers) {
      keyServerObjectIds = mod.getAllowlistedKeyServers(NETWORK);
    }
  } catch (e) {
    // ignore
  }
  // Fallback to environment variable `SEAL_KEY_SERVERS` if SDK helper not available
  if (!keyServerObjectIds || keyServerObjectIds.length === 0) {
    try {
      const raw = process.env.SEAL_KEY_SERVERS;
      if (raw) {
        // Expect JSON array of objects with name/url/public_key
        const arr = JSON.parse(raw);
        // The SealClient expects identifiers; map to either object ids or use URLs as identifiers
        keyServerObjectIds = arr.map((s) => s.object_id || s.name || s.url);
      }
    } catch (e) {
      keyServerObjectIds = [];
    }
  }
  sealClient = new SealClient({
    suiClient,
    keyServerObjectIds: keyServerObjectIds.slice(0, Math.max(THRESHOLD + 3, 5)),
  });
}

app.get('/health', async (req, res) => {
  try {
    initSeal();
    const state = await suiClient.getLatestSuiSystemState();
    return res.json({ status: 'ok', network: NETWORK, keyServers: keyServerObjectIds.length, epoch: state.epoch });
  } catch (e) {
    return res.status(500).json({ status: 'error', error: e.toString() });
  }
});

app.post('/encrypt', async (req, res) => {
  try {
    initSeal();
    const { policy, plaintext } = req.body;
    if (!plaintext) return res.status(400).json({ error: 'missing plaintext' });

    const data = typeof plaintext === 'string' ? new TextEncoder().encode(plaintext) : Uint8Array.from(plaintext);
    const result = await sealClient.encrypt({ data, policy });
    // ciphertext is Uint8Array; metadata is JSON-serializable
    const ciphertext_b64 = Buffer.from(result.ciphertext).toString('base64');
    return res.json({ ciphertext: ciphertext_b64, meta: result.metadata });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.toString() });
  }
});

app.post('/decrypt', async (req, res) => {
  try {
    initSeal();
    const { ciphertext, metadata, user_address } = req.body;
    if (!ciphertext || !metadata) return res.status(400).json({ error: 'missing ciphertext or metadata' });

    const ciphertext_bytes = Buffer.from(ciphertext, 'base64');
    try {
      const decrypted = await sealClient.decrypt({ ciphertext: ciphertext_bytes, metadata, userAddress: user_address });
      const plaintext_b64 = Buffer.from(decrypted).toString('base64');
      return res.json({ allowed: true, reason: 'ok', plaintext: plaintext_b64 });
    } catch (err) {
      return res.json({ allowed: false, reason: err.message || 'access_denied' });
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.toString() });
  }
});

app.listen(PORT, () => console.log(`Seal wrapper listening on ${PORT} (network=${NETWORK})`));
