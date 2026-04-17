// Defeyes Payment API - Vercel Serverless Function
const { Pool } = require('pg');
const crypto = require('crypto');
const Stripe = require('stripe');
const ethers = require('ethers'); // ethers v5 - no destructuring

// =========================================================================
// CORS CONFIGURATION
// =========================================================================
const ALLOWED_ORIGINS = [
  'https://defeyes.com',
  'https://www.defeyes.com',
  'https://defeyes-frontend.vercel.app',
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5500'
];

function getCorsOrigin(req) {
  const origin = req.headers?.origin || req.headers?.Origin || '';
  // Allow listed origins, or requests with no origin (e.g. server-to-server API calls)
  if (!origin || ALLOWED_ORIGINS.includes(origin)) {
    return origin || '*';
  }
  // For API key-authenticated requests (programmatic access), allow any origin
  if (req.headers?.['x-api-key']) {
    return origin;
  }
  return ALLOWED_ORIGINS[0]; // Default to main domain
}
const WebhookService = require('./services/webhookService');
const x402Standard = require('./services/x402Standard');

// =========================================================================
// SIMPLE RATE LIMITER FOR PUBLIC ENDPOINTS
// =========================================================================
const publicRateLimits = new Map(); // ip -> { count, resetAt }
const PUBLIC_RATE_LIMIT = 60;       // max requests per window
const PUBLIC_RATE_WINDOW = 60000;   // 1 minute window

function checkPublicRateLimit(ip) {
  const now = Date.now();
  const entry = publicRateLimits.get(ip);
  if (!entry || now > entry.resetAt) {
    publicRateLimits.set(ip, { count: 1, resetAt: now + PUBLIC_RATE_WINDOW });
    return true;
  }
  entry.count++;
  if (entry.count > PUBLIC_RATE_LIMIT) return false;
  return true;
}

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of publicRateLimits) {
    if (now > entry.resetAt) publicRateLimits.delete(ip);
  }
}, 300000);

// Initialize Stripe with your secret key from environment variable
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY environment variable is required');
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// =========================================================================
// X402 PAY-PER-REQUEST CONFIGURATION
// =========================================================================
const X402_CONFIG = {
  // Wallet to receive USDC payments
  paymentWallet: process.env.X402_WALLET || '0xB0EfBb7Bb1d85A0ebd3D71c623560560b1FD8941',
  
  // Supported networks with RPC endpoints and USDC contract addresses
  networks: {
    base: {
      chainId: 8453,
      name: 'Base',
      rpc: 'https://mainnet.base.org',
      usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      blockExplorer: 'https://basescan.org'
    },
    arbitrum: {
      chainId: 42161,
      name: 'Arbitrum One',
      rpc: 'https://arb1.arbitrum.io/rpc',
      usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      blockExplorer: 'https://arbiscan.io'
    }
  },
  
  // Tiered pricing by endpoint (in USDC)
  pricing: {
    '/api/stats': 0.0005,           // $0.0005 - cheap aggregate data
    '/api/events': 0.001,           // $0.001 - standard event queries
    '/api/events/export': 0.01,     // $0.01 - bulk export
    '/api/analytics': 0.005,        // $0.005 - premium analytics (future)
    '/api/tts/speak': 0.001,       // $0.001 - TTS audio generation
    'default': 0.001                // $0.001 - default for unlisted endpoints
  },
  
  // Payment cache TTL (prevent double-spending, allow retries)
  paymentCacheTTL: 300000,  // 5 minutes
  
  // Confirmation requirements (safety for reorgs)
  confirmations: {
    '/api/stats': 1,              // 1 block for cheap endpoints
    '/api/events': 1,             // 1 block for standard queries
    '/api/events/export': 3,      // 3 blocks for high-value exports
    '/api/analytics': 2,          // 2 blocks for premium analytics
    'default': 1                  // Default: 1 block
  }
};

// In-memory cache for verified payments (in production, use Redis)
const verifiedPayments = new Map();

// USDC ERC20 ABI (minimal - just Transfer event)
const USDC_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'function decimals() view returns (uint8)'
];

// Get price for an endpoint
function getEndpointPrice(endpoint) {
  // Check for exact match first
  if (X402_CONFIG.pricing[endpoint]) {
    return X402_CONFIG.pricing[endpoint];
  }
  // Check for prefix match
  for (const [path, price] of Object.entries(X402_CONFIG.pricing)) {
    if (endpoint.startsWith(path)) {
      return price;
    }
  }
  return X402_CONFIG.pricing.default;
}

// =========================================================================
// TTS HELPERS (Kokoro + pronunciation preprocessing)
// =========================================================================
const TTS_PRONUNCIATION = {
  stETH: 'staked eeth', steth: 'staked eeth', StETH: 'staked eeth',
  Aave: 'Ah-vay', aave: 'Ah-vay', AAVE: 'Ah-vay',
  WETH: 'Wrapped eeth', weth: 'Wrapped eeth', Weth: 'Wrapped eeth',
  ETH: 'eeth', Eth: 'eeth',
  DeFi: 'Dee-Fi', defi: 'Dee-Fi', DEFI: 'Dee-Fi',
};
const TTS_ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const TTS_TEENS = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TTS_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function ttsNumberToWords(n) {
  if (n === 0) return 'zero';
  if (n < 0) return 'negative ' + ttsNumberToWords(-n);
  let out = '';
  if (n >= 1000000) { out += ttsNumberToWords(Math.floor(n / 1000000)) + ' million '; n %= 1000000; }
  if (n >= 1000) { out += ttsNumberToWords(Math.floor(n / 1000)) + ' thousand '; n %= 1000; }
  if (n >= 100) { out += TTS_ONES[Math.floor(n / 100)] + ' hundred '; n %= 100; }
  if (n >= 20) { out += TTS_TENS[Math.floor(n / 10)] + (n % 10 ? '-' : '') + TTS_ONES[n % 10]; }
  else if (n >= 10) out += TTS_TEENS[n - 10];
  else if (n > 0) out += TTS_ONES[n];
  return out.trim();
}

function ttsExpandDollar(match) {
  const trimmed = match.replace(/~|\s/g, '').replace(/,/g, '');
  const m = trimmed.match(/^\$(\d+(?:\.\d+)?)([kKmMbB])?$/);
  if (!m) return match;
  const suffix = (m[2] || '').toLowerCase();
  const multiplier = suffix === 'k' ? 1_000 : suffix === 'm' ? 1_000_000 : suffix === 'b' ? 1_000_000_000 : 1;
  const numeric = parseFloat(m[1]);
  if (!Number.isFinite(numeric)) return match;
  const scaled = numeric * multiplier;
  const whole = Math.floor(scaled);
  const cents = multiplier === 1 ? Math.round((scaled - whole) * 100) : 0;
  let words = ttsNumberToWords(whole) + ' dollar' + (whole === 1 ? '' : 's');
  if (cents > 0) words += ' and ' + ttsNumberToWords(cents) + ' cent' + (cents === 1 ? '' : 's');
  return words;
}

function ttsPreprocess(text) {
  let out = String(text || '');
  out = out.replace(/(?:~\s*)?\$[\d,]+(?:\.\d+)?\s*[kKmMbB]?\b/g, ttsExpandDollar);
  // Force "COW Protocol" to be spoken like the word "cow".
  out = out.replace(/\bCOW\s+Protocol\b/gi, 'cow protocol');
  // Replace "Wallet 0x1234...5678" with "this wallet" (address already visible on page)
  out = out.replace(/\b[Ww]allet\s+0x[a-fA-F0-9]{4,8}\.\.\.[a-fA-F0-9]{4}\b/g, 'this wallet');
  // Round long APY decimals for TTS (e.g. 1.8172298259859% -> 1.82%)
  out = out.replace(/(\d+\.\d{3,})\s*%/g, (_, num) => parseFloat(num).toFixed(2) + '%');
  // Add pause after sentence-ending punctuation (ellipsis creates natural breath for TTS)
  // Only at real boundaries (punctuation + space + capital) to avoid "U.S." or "e.g."
  out = out.replace(/([.!?])\s+(?=[A-Z])/g, '$1 ... ');
  for (const [word, replacement] of Object.entries(TTS_PRONUNCIATION)) {
    const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
    out = out.replace(re, replacement);
  }
  return out;
}

function normalizeInsightText(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return clean;
  const sentences = clean
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, 6);
  if (sentences.length <= 3) return sentences.join(' ');
  return `${sentences.slice(0, 3).join(' ')}\n\n${sentences.slice(3, 6).join(' ')}`;
}

async function generateTTS(text, db) {
  const processed = ttsPreprocess(text);
  const contentHash = crypto.createHash('sha256').update(processed).digest('hex');
  const KOKORO_URL = 'https://chutes-kokoro.chutes.ai/speak';
  const token = process.env.CHUTES_API_TOKEN;

  if (!token) return null;

  // Check cache
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS tts_audio_cache (
        content_hash VARCHAR(64) PRIMARY KEY,
        audio_data BYTEA NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    const cached = await db.query('SELECT audio_data FROM tts_audio_cache WHERE content_hash = $1', [contentHash]);
    if (cached.rows.length > 0 && cached.rows[0].audio_data) {
      return cached.rows[0].audio_data;
    }
  } catch (e) { /* ignore */ }

  try {
    const r = await fetch(KOKORO_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: processed, speed: 1.2, voice: 'af_heart' })
    });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    await db.query('INSERT INTO tts_audio_cache (content_hash, audio_data) VALUES ($1, $2) ON CONFLICT (content_hash) DO NOTHING', [contentHash, buf]).catch(() => {});
    return buf;
  } catch (e) {
    console.error('Kokoro TTS error:', e.message);
    return null;
  }
}

// =========================================================================
// METERED PRICING (Premium SKUs)
// =========================================================================
function parseTimeRangeToSeconds(timeRange) {
  if (!timeRange) return null;
  const v = String(timeRange).trim().toLowerCase();
  if (v === 'all') return null;
  if (v === '1h') return 60 * 60;
  if (v === '24h') return 24 * 60 * 60;
  if (v === '7d') return 7 * 24 * 60 * 60;
  // Support "60s", "5m", "10m", "2h", "3d"
  const m = v.match(/^(\d+)\s*([smhd])$/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = m[2];
  if (unit === 's') return n;
  if (unit === 'm') return n * 60;
  if (unit === 'h') return n * 60 * 60;
  if (unit === 'd') return n * 24 * 60 * 60;
  return null;
}

function computeEventsPrice({ timeRange, limit }) {
  // Base /api/events price
  const base = getEndpointPrice('/api/events'); // default: 0.001
  const seconds = parseTimeRangeToSeconds(timeRange) ?? (24 * 60 * 60);
  const lim = Math.min(Math.max(parseInt(limit || '100', 10) || 100, 1), 1000);

  // Premium SKU #1 (recommended): freshness-based pricing
  // - last 5m: premium
  // - last 1h: mid-tier
  // - 24h+: base
  let price = base;
  if (seconds <= 5 * 60) price = 0.005;
  else if (seconds <= 60 * 60) price = 0.003;

  // Meter by workload (limit)
  if (lim > 100 && lim <= 500) price += 0.002;
  if (lim > 500) price += 0.01;

  // Keep reasonable precision for USDC (6 decimals)
  return Math.round(price * 1e6) / 1e6;
}

function computeEventsExportPrice({ limit }) {
  const lim = Math.min(Math.max(parseInt(limit || '50', 10) || 50, 1), 500);

  // Keep the existing behavior: small exports are a free sample.
  // Premium SKU #2 (bulk): larger exports require payment.
  if (lim <= 100) return 0;

  // Base paid export price
  let price = getEndpointPrice('/api/events/export'); // default: 0.01

  // Meter by workload (bigger export = more DB + bandwidth)
  if (lim > 200) price += 0.01; // 201-500 => $0.02

  return Math.round(price * 1e6) / 1e6;
}

function computeRequestPrice({ endpoint, url }) {
  // endpoint here should be the PATH only (e.g. "/api/events")
  if (!endpoint) return getEndpointPrice('default');
  if (endpoint === '/api/events') {
    const urlParams = new URL(url || endpoint, 'http://localhost').searchParams;
    const timeRange = urlParams.get('time_range') || '24h';
    const limit = urlParams.get('limit') || '100';
    return computeEventsPrice({ timeRange, limit });
  }
  if (endpoint === '/api/events/export') {
    const urlParams = new URL(url || endpoint, 'http://localhost').searchParams;
    const limit = urlParams.get('limit') || '50';
    return computeEventsExportPrice({ limit });
  }
  // Default to static per-endpoint pricing
  return getEndpointPrice(endpoint);
}

// Verify X402 payment on-chain
async function verifyX402Payment(txHash, network, expectedAmount, endpoint) {
  const cacheKey = `${txHash}-${network}`;
  
  // Check cache first
  if (verifiedPayments.has(cacheKey)) {
    const cached = verifiedPayments.get(cacheKey);
    if (Date.now() - cached.timestamp < X402_CONFIG.paymentCacheTTL) {
      return cached.valid ? { valid: true, cached: true } : { valid: false, error: 'Previously invalid payment' };
    }
  }
  
  try {
    const networkConfig = X402_CONFIG.networks[network];
    if (!networkConfig) {
      return { valid: false, error: `Unsupported network: ${network}` };
    }
    
    const provider = new ethers.providers.JsonRpcProvider(networkConfig.rpc);
    const tx = await provider.getTransaction(txHash);
    
    if (!tx) {
      return { valid: false, error: 'Transaction not found' };
    }
    
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt || receipt.status !== 1) {
      return { valid: false, error: 'Transaction failed or pending' };
    }
    
    // Check confirmation count (safety for reorgs)
    const requiredConfirmations = X402_CONFIG.confirmations[endpoint] || X402_CONFIG.confirmations.default;
    const currentBlock = await provider.getBlockNumber();
    const confirmations = currentBlock - receipt.blockNumber;
    
    if (confirmations < requiredConfirmations) {
      return { 
        valid: false, 
        error: `Transaction needs ${requiredConfirmations} confirmations (currently has ${confirmations})`,
        confirmations: confirmations,
        required: requiredConfirmations
      };
    }
    
    // Parse USDC transfer logs
    const usdcContract = new ethers.Contract(networkConfig.usdc, USDC_ABI, provider);
    const transferLogs = receipt.logs
      .filter(log => log.address.toLowerCase() === networkConfig.usdc.toLowerCase())
      .map(log => {
        try {
          return usdcContract.interface.parseLog({ topics: log.topics, data: log.data });
        } catch {
          return null;
        }
      })
      .filter(Boolean);
    
    // Find transfer to our wallet
    const validTransfer = transferLogs.find(log => 
      log.name === 'Transfer' && 
      log.args.to.toLowerCase() === X402_CONFIG.paymentWallet.toLowerCase()
    );
    
    if (!validTransfer) {
      verifiedPayments.set(cacheKey, { valid: false, timestamp: Date.now() });
      return { valid: false, error: 'No USDC transfer to payment wallet found' };
    }
    
    // USDC has 6 decimals
    const amountPaid = Number(validTransfer.args.value) / 1e6;
    
    if (amountPaid < expectedAmount) {
      verifiedPayments.set(cacheKey, { valid: false, timestamp: Date.now() });
      return { valid: false, error: `Insufficient payment: paid $${amountPaid}, required $${expectedAmount}` };
    }
    
    // Valid payment!
    verifiedPayments.set(cacheKey, { valid: true, timestamp: Date.now(), amount: amountPaid, confirmations });
    return { valid: true, amount: amountPaid, from: validTransfer.args.from, confirmations };
    
  } catch (error) {
    console.error('X402 verification error:', error);
    return { valid: false, error: error.message };
  }
}

// Generate 402 Payment Required response (standard x402 v2 + legacy headers)
function generate402Response(endpoint, res, opts = {}) {
  const price = typeof opts.price === 'number' ? opts.price : getEndpointPrice(endpoint);
  const networks = Object.keys(X402_CONFIG.networks);
  
  // Standard x402 v2 PAYMENT-REQUIRED header (for Coinbase SDK clients)
  try {
    const standardPaymentRequired = {
      x402Version: 2,
      accepts: [{
        scheme: 'exact',
        price: `$${price}`,
        network: x402Standard.CAIP2_NETWORKS.base,
        payTo: X402_CONFIG.paymentWallet
      }],
      resource: {
        endpoint,
        description: opts.description || `DeFi transaction data - ${endpoint}`,
        mimeType: 'application/json'
      },
      extensions: {
        bazaar: {
          discoverable: true,
          category: 'defi-data',
          tags: ['DeFi', 'transactions', 'Arbitrum', 'Aave', 'lending', 'swaps']
        }
      }
    };
    res.setHeader('PAYMENT-REQUIRED', JSON.stringify(standardPaymentRequired));
  } catch (e) {
    console.warn('[x402] Could not set standard PAYMENT-REQUIRED header:', e.message);
  }

  // Legacy headers (for existing custom clients)
  res.setHeader('X-Payment-Required', 'true');
  res.setHeader('X-Price-Amount', price.toString());
  res.setHeader('X-Price-Currency', 'USDC');
  res.setHeader('X-Accepted-Networks', networks.join(','));
  res.setHeader('X-Payment-Wallet', X402_CONFIG.paymentWallet);
  
  return res.status(402).json({
    error: 'Payment Required',
    message: 'This endpoint requires payment. Use x402 protocol (PAYMENT-SIGNATURE header) or legacy flow (X-Payment-Proof header).',
    x402Version: 2,
    x402: {
      endpoint,
      params: opts.params || null,
      price: price,
      currency: 'USDC',
      wallet: X402_CONFIG.paymentWallet,
      network: x402Standard.CAIP2_NETWORKS.base,
      networks: Object.entries(X402_CONFIG.networks).map(([key, net]) => ({
        id: key,
        caip2: x402Standard.CAIP2_NETWORKS[key] || key,
        name: net.name,
        chainId: net.chainId,
        usdcContract: net.usdc
      })),
      quote: {
        endpoint: '/api/x402/quote',
        description: 'Get an exact price quote for a specific request (recommended for agents).'
      },
      standardFlow: 'Sign payment authorization and include in PAYMENT-SIGNATURE header (Coinbase x402 SDK)',
      legacyFlow: 'Send USDC on-chain, then retry with X-Payment-Proof and X-Payment-Network headers'
    },
    upgrade: {
      developer: { price: 49, requests: 500, url: 'https://defeyes.com/payment?plan=developer' },
      pro: { price: 199, requests: 5000, url: 'https://defeyes.com/payment?plan=pro' }
    }
  });
}

// Database connection using explicit parameters
let pool;

function getPool() {
  if (!pool) {
    // Prefer explicit Supabase pooler config when DB_PASSWORD exists (Vercel/prod),
    // otherwise fall back to DATABASE_URL (local/dev environments).
    if (process.env.DB_PASSWORD) {
      pool = new Pool({
        host: 'aws-1-us-east-2.pooler.supabase.com',
        port: 6543,  // Transaction mode for serverless
        database: 'postgres',
        user: 'postgres.gaeauxyyfqavpqythore',
        password: process.env.DB_PASSWORD,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 30000,
        statement_timeout: 120000,
        query_timeout: 120000,
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
      });
    } else if (process.env.DATABASE_URL) {
      const cs = process.env.DATABASE_URL;
      pool = new Pool({
        connectionString: cs,
        ssl: cs.includes('supabase') ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 30000,
        statement_timeout: 120000,
        query_timeout: 120000,
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
      });
    } else {
      throw new Error('Database not configured: set DB_PASSWORD or DATABASE_URL');
    }
    
    pool.on('connect', (client) => {
      client.on('error', (err) => {
        console.error('Database client error:', err);
      });
    });
  }
  return pool;
}

// Recency decay: weight events by age. Last 30d=1, 90d=0.5, 365d=0.2, older=0.1
function recencyWeight(eventTs) {
  if (!eventTs) return 1;
  const daysAgo = (Date.now() - new Date(eventTs)) / (1000 * 60 * 60 * 24);
  if (daysAgo <= 30) return 1;
  if (daysAgo <= 90) return 0.6;
  if (daysAgo <= 180) return 0.4;
  if (daysAgo <= 365) return 0.2;
  return 0.1;
}

// Random sample without replacement (Fisher-Yates shuffle, take first n)
function randomSample(arr, n) {
  if (!arr.length || n <= 0) return [];
  const copy = [...arr];
  const size = Math.min(n, copy.length);
  for (let i = 0; i < size; i++) {
    const j = i + Math.floor(Math.random() * (copy.length - i));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, size);
}

// Dust filter: exclude events with value < 5% of 30-day average (removes protocol-listing noise)
function filterDustEvents(events) {
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentWithValue = events
    .filter(e => e.event_timestamp && new Date(e.event_timestamp) >= thirtyDaysAgo)
    .map(e => ({ ...e, vol: (e.value_eth && !isNaN(parseFloat(e.value_eth))) ? parseFloat(e.value_eth) : 0 }))
    .filter(e => e.vol > 0);
  const count = recentWithValue.length;
  const sum = recentWithValue.reduce((s, e) => s + e.vol, 0);
  const avg = count > 0 ? sum / count : 0;
  const threshold = avg * 0.05;
  if (threshold <= 0) return events;
  return events.filter(e => {
    const v = (e.value_eth && !isNaN(parseFloat(e.value_eth))) ? parseFloat(e.value_eth) : 0;
    return v === 0 || v >= threshold;
  });
}

const marketPulseCache = { timestamp: 0, data: null };
const MARKET_PULSE_TTL_MS = 15000;
const MARKET_PULSE_ETH_PRICE_USD = 3000;
const MARKET_PULSE_STABLES = new Set(['USDC', 'USDT', 'DAI', 'USDC.E', 'USDCN', 'USDT0', 'USDE', 'GHO']);
const MARKET_PULSE_SUPPLY_ACTIONS = new Set(['SUPPLY', 'DEPOSIT', 'DELEGATED_SUPPLY']);
const MARKET_PULSE_BORROW_ACTIONS = new Set(['BORROW', 'DELEGATED_BORROW']);
const MARKET_PULSE_WITHDRAW_ACTIONS = new Set(['WITHDRAW', 'DELEGATED_WITHDRAW']);
const MARKET_PULSE_REPAY_ACTIONS = new Set(['REPAY', 'DELEGATED_REPAY']);
const MARKET_PULSE_WINDOW_HOURS = 4;
const MARKET_PULSE_WINDOW_MINUTES = MARKET_PULSE_WINDOW_HOURS * 60;
const MARKET_PULSE_RECENT_HOURS = 24;
const MARKET_PULSE_RECENT_ROWS_LIMIT = 12000;
const EXPLORER_VOLUME_LOOKBACK_HOURS = 72;
const EXPLORER_VOLUME_ROWS_LIMIT = 36000;
const EXPLORER_VOLUME_TTL_MS = 5 * 60 * 1000;
const explorerVolumeCache = { timestamp: 0, data: null };
const tickerDataCache = { timestamp: 0, data: null };
const TICKER_DATA_TTL_MS = 2 * 60 * 1000;
const explorerEventsCache = { timestamp: 0, data: null, key: '' };
const EXPLORER_EVENTS_TTL_MS = 10 * 1000;
const TOKEN_PRICE_CACHE_TABLE = 'token_price_cache';
const TOKEN_PRICE_MEM_TTL_MS = 2 * 60 * 1000;
const TOKEN_PRICE_STALE_MAX_MINUTES = 180;
const tokenPriceMemCache = { timestamp: 0, map: null };
const TOKEN_PRICE_CHAIN = 'arbitrum';
const COINGECKO_SYMBOL_MAP = {
  WETH: 'ethereum',
  WBTC: 'bitcoin',
  CBBTC: 'bitcoin',
  ARB: 'arbitrum',
  AAVE: 'aave',
  LINK: 'chainlink',
  CRV: 'curve-dao-token',
  GMX: 'gmx',
  DAI: 'dai',
  GHO: 'gho',
  USDE: 'ethena-usde',
  WSTETH: 'wrapped-steth',
  WEETH: 'wrapped-eeth',
  TBTC: 'tbtc',
  RETH: 'rocket-pool-eth',
  EZETH: 'renzo-restaked-eth',
  PENDLE: 'pendle',
  FRAX: 'frax',
  MAGIC: 'magic',
  LUSD: 'liquity-usd',
  RSETH: 'kelp-dao-restaked-eth'
};
const TOKEN_PRICE_SYMBOL_ALIASES = {
  CBBTC: 'WBTC',
  'USDC.E': 'USDC',
  USDCN: 'USDC',

  // Aave aToken receipts → underlying
  AUSDCN: 'USDC',
  AARBUSDCN: 'USDC',
  AUSDC: 'USDC',
  AARBUSDC: 'USDC',
  AUSDT: 'USDT',
  AARBUSDT: 'USDT',
  AWETH: 'WETH',
  AARBWETH: 'WETH',
  AWBTC: 'WBTC',
  AARBWBTC: 'WBTC',
  ADAI: 'DAI',
  AARBDAI: 'DAI',
  ALINK: 'LINK',
  AARBLINK: 'LINK',
  AAAVE: 'AAVE',
  AARBAAVE: 'AAVE',
  AARBGHO: 'GHO',
  ARBGHO: 'GHO',
  WAARBGHO: 'GHO',
  AARBARB: 'ARB',
  AARB: 'ARB',

  // Debt tokens → underlying
  'USDCN DEBT': 'USDC',
  'USDC DEBT': 'USDC',
  VARIABLEDEBTARBUSDCN: 'USDC',
  WAARBUSDCN: 'USDC',
  WAARBWETH: 'WETH',

  // Stable aliases
  USDAI: 'DAI'
};

const MARKET_PULSE_INSIGHT_CACHE_KEY = 'global:4h:v1';
const MARKET_PULSE_INSIGHT_VERSION = 'v1';
const MARKET_PULSE_INSIGHT_TTL_MS = Math.max(60000, parseInt(process.env.MARKET_PULSE_INSIGHT_TTL_MS || '3600000', 10) || 3600000);
const MARKET_PULSE_INSIGHT_MAX_HEADLINE = 44;
const MARKET_PULSE_INSIGHT_MAX_SUMMARY = 420;
const MARKET_PULSE_INSIGHT_MAX_RIBBON_LINE = 34;
const MARKET_PULSE_ALLOWED_PULSE_MODES = new Set([
  'risk_on', 'risk_off', 'defensive', 'rotation', 'whale_accumulation', 'retail_chase', 'mixed', 'unclear'
]);
const MARKET_PULSE_ALLOWED_RISK_LEVELS = new Set(['low', 'medium', 'high']);

const MARKET_PULSE_SWAP_ACTIONS = new Set(['SWAP', 'COLLATERAL_SWAP', 'REBALANCE', 'RISK_ROTATION']);
const MARKET_PULSE_BRIDGE_ACTIONS = new Set(['BRIDGE']);
let marketPulseInsightTableEnsured = false;
let tokenPriceTableEnsured = false;
let marketPulseInsightRefreshPromise = null;

function normalizePulseSymbol(symbol) {
  return String(symbol || '').trim().toUpperCase();
}

function canonicalPriceSymbol(symbol) {
  const u = normalizePulseSymbol(symbol);
  if (!u) return u;
  const alias = TOKEN_PRICE_SYMBOL_ALIASES[u];
  return alias ? String(alias).trim().toUpperCase() : u;
}

function fallbackPriceUsdForSymbol(symbol, ethPrice = MARKET_PULSE_ETH_PRICE_USD) {
  const sym = canonicalPriceSymbol(symbol);
  if (!sym) return 0;
  if (MARKET_PULSE_STABLES.has(sym)) return 1;
  if (sym === 'WETH') return ethPrice;
  if (sym === 'WBTC') return 95000;
  return 0;
}

function usdFromToken(symbol, amount, priceMap = null, ethPrice = MARKET_PULSE_ETH_PRICE_USD) {
  const sym = canonicalPriceSymbol(symbol);
  const num = Number(amount);
  if (!Number.isFinite(num) || num <= 0) return 0;
  const mappedPrice = priceMap && Number.isFinite(Number(priceMap[sym])) ? Number(priceMap[sym]) : 0;
  const fallbackPrice = fallbackPriceUsdForSymbol(sym, ethPrice);
  const price = mappedPrice > 0 ? mappedPrice : fallbackPrice;
  if (price > 0) return num * price;
  return 0;
}

function estimateUsdValueFromEvent(event, priceMap = null, ethPrice = MARKET_PULSE_ETH_PRICE_USD) {
  const action = String(event.action_type || '').toUpperCase();
  const inUsd = usdFromToken(event.token_in_symbol, event.token_in_amount, priceMap, ethPrice);
  const outUsd = usdFromToken(event.token_out_symbol, event.token_out_amount, priceMap, ethPrice);
  const ethUsd = Number.isFinite(Number(event.value_eth)) && Number(event.value_eth) > 0
    ? Number(event.value_eth) * ethPrice
    : 0;

  if (MARKET_PULSE_SUPPLY_ACTIONS.has(action)) return inUsd || outUsd || ethUsd;
  if (MARKET_PULSE_BORROW_ACTIONS.has(action)) return outUsd || inUsd || ethUsd;
  if (MARKET_PULSE_WITHDRAW_ACTIONS.has(action)) return outUsd || inUsd || ethUsd;
  if (MARKET_PULSE_REPAY_ACTIONS.has(action)) return inUsd || outUsd || ethUsd;
  return Math.max(inUsd, outUsd, ethUsd);
}

function marketPulseTs(row) {
  return new Date(row.event_timestamp || row.enriched_at || 0).getTime();
}

function dedupeMarketPulseRows(rows) {
  const now = Date.now();
  const unique = [];
  const seen = new Set();

  rows.forEach((row, index) => {
    const key = row.ref_tx_hash || `${row.event_timestamp || row.enriched_at || 'row'}-${index}`;
    if (seen.has(key)) return;
    seen.add(key);
    unique.push(row);
  });

  return unique.filter(row => {
    const ts = marketPulseTs(row);
    return Number.isFinite(ts) && ts > 0 && ts <= now + 5 * 60 * 1000;
  });
}

function pctDelta(current, previous) {
  const cur = Number(current) || 0;
  const prev = Number(previous) || 0;
  if (prev <= 0) return cur > 0 ? 100 : 0;
  return ((cur - prev) / prev) * 100;
}

function primaryPulseSymbol(row, actionType) {
  const action = String(actionType || '').toUpperCase();
  const inSym = normalizePulseSymbol(row.token_in_symbol);
  const outSym = normalizePulseSymbol(row.token_out_symbol);
  if (MARKET_PULSE_SUPPLY_ACTIONS.has(action)) return inSym || outSym || 'UNKNOWN';
  if (MARKET_PULSE_BORROW_ACTIONS.has(action)) return outSym || inSym || 'UNKNOWN';
  if (MARKET_PULSE_WITHDRAW_ACTIONS.has(action)) return outSym || inSym || 'UNKNOWN';
  if (MARKET_PULSE_REPAY_ACTIONS.has(action)) return inSym || outSym || 'UNKNOWN';
  return inSym || outSym || 'UNKNOWN';
}

function summarizePulseWindow(rows, priceMap = null) {
  const protocolCounts = {};
  const protocolUsd = {};
  const assetCounts = {};
  const assetUsd = {};
  let pricedCount = 0;
  let whaleCount = 0;
  let retailCount = 0;
  let totalUsd = 0;
  let supplyEvents = 0;
  let borrowEvents = 0;
  let withdrawEvents = 0;
  let repayEvents = 0;
  let supplyUsd = 0;
  let borrowUsd = 0;
  let withdrawUsd = 0;
  let repayUsd = 0;
  let swapUsd = 0;
  let bridgeUsd = 0;

  rows.forEach((row) => {
    const action = String(row.action_type || '').toUpperCase();
    const protocol = String(row.protocol_name || 'Unknown');
    const usd = estimateUsdValueFromEvent(row, priceMap);
    const symbol = primaryPulseSymbol(row, action);

    protocolCounts[protocol] = (protocolCounts[protocol] || 0) + 1;
    assetCounts[symbol] = (assetCounts[symbol] || 0) + 1;

    if (usd > 0) {
      totalUsd += usd;
      pricedCount += 1;
      protocolUsd[protocol] = (protocolUsd[protocol] || 0) + usd;
      assetUsd[symbol] = (assetUsd[symbol] || 0) + usd;
      if (usd >= 50000) whaleCount += 1;
      else retailCount += 1;
    }

    if (MARKET_PULSE_SUPPLY_ACTIONS.has(action)) {
      supplyUsd += usd;
      supplyEvents += 1;
    }
    if (MARKET_PULSE_BORROW_ACTIONS.has(action)) {
      borrowUsd += usd;
      borrowEvents += 1;
    }
    if (MARKET_PULSE_WITHDRAW_ACTIONS.has(action)) {
      withdrawUsd += usd;
      withdrawEvents += 1;
    }
    if (MARKET_PULSE_REPAY_ACTIONS.has(action)) {
      repayUsd += usd;
      repayEvents += 1;
    }
    if (MARKET_PULSE_SWAP_ACTIONS.has(action)) swapUsd += usd;
    if (MARKET_PULSE_BRIDGE_ACTIONS.has(action)) bridgeUsd += usd;
  });

  return {
    rowsCount: rows.length,
    protocolCounts,
    protocolUsd,
    assetCounts,
    assetUsd,
    totalUsd,
    pricedCount,
    whaleCount,
    retailCount,
    supplyEvents,
    borrowEvents,
    withdrawEvents,
    repayEvents,
    supplyUsd,
    borrowUsd,
    withdrawUsd,
    repayUsd,
    swapUsd,
    bridgeUsd
  };
}

function topPulseShares(mapData, totalValue, keyName, maxItems = 3) {
  const entries = Object.entries(mapData || {}).filter(([, value]) => Number(value) > 0);
  if (!entries.length || totalValue <= 0) return [];
  return entries
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, maxItems)
    .map(([name, value]) => ({
      [keyName]: name,
      share: Number((Number(value) / totalValue).toFixed(4))
    }));
}

function buildMarketPulseSnapshot(rows, priceMap = null) {
  const now = Date.now();
  const currentWindowAgo = now - (MARKET_PULSE_WINDOW_MINUTES * 60 * 1000);
  const previousWindowAgo = now - (MARKET_PULSE_WINDOW_MINUTES * 2 * 60 * 1000);
  const oneHourAgo = now - (60 * 60 * 1000);
  const unique = dedupeMarketPulseRows(rows);

  const recent = unique.filter(row => marketPulseTs(row) >= currentWindowAgo);
  const previousWindow = unique.filter(row => {
    const ts = marketPulseTs(row);
    return ts >= previousWindowAgo && ts < currentWindowAgo;
  });
  const recent1h = unique.filter(row => marketPulseTs(row) >= oneHourAgo);

  const baselineEventsForWindow = unique.length * (MARKET_PULSE_WINDOW_HOURS / 24);
  const currentEvents = recent.length;
  const baselinePerHour24h = unique.length / 24;
  const currentPerHour = recent.length / MARKET_PULSE_WINDOW_HOURS;
  const activityRatio = baselineEventsForWindow > 0 ? currentEvents / baselineEventsForWindow : 0;
  const heatIndex = Math.max(0, Math.min(100, Math.round(activityRatio * 50)));

  const recentSummary = summarizePulseWindow(recent, priceMap);
  const previousSummary = summarizePulseWindow(previousWindow, priceMap);
  const actionTotal = recentSummary.supplyEvents + recentSummary.borrowEvents + recentSummary.withdrawEvents + recentSummary.repayEvents;
  const shareOf = (value) => actionTotal > 0 ? Number((value / actionTotal).toFixed(4)) : 0;

  const supplyUsd = recentSummary.supplyUsd;
  const borrowUsd = recentSummary.borrowUsd;
  const withdrawUsd = recentSummary.withdrawUsd;
  const repayUsd = recentSummary.repayUsd;
  const whaleCount = recentSummary.whaleCount;
  const retailCount = recentSummary.retailCount;

  const sentimentBase = supplyUsd + borrowUsd;
  const sentimentDeg = sentimentBase > 0
    ? Math.round(((supplyUsd - borrowUsd) / sentimentBase) * 90)
    : 0;
  const whaleTotal = whaleCount + retailCount;
  const whaleRatio = whaleTotal > 0 ? whaleCount / whaleTotal : 0.5;

  const protocolShares = topPulseShares(
    Object.keys(recentSummary.protocolUsd).length ? recentSummary.protocolUsd : recentSummary.protocolCounts,
    Object.keys(recentSummary.protocolUsd).length ? recentSummary.totalUsd : recentSummary.rowsCount,
    'name'
  );
  const assetShares = topPulseShares(
    Object.keys(recentSummary.assetUsd).length ? recentSummary.assetUsd : recentSummary.assetCounts,
    Object.keys(recentSummary.assetUsd).length ? recentSummary.totalUsd : recentSummary.rowsCount,
    'symbol'
  );

  const anomalies = [];
  const activityDeltaPct = pctDelta(currentEvents, baselineEventsForWindow);
  if (activityDeltaPct >= 80) anomalies.push('activity_spike');
  if (borrowUsd > 0 && borrowUsd >= supplyUsd * 1.5) anomalies.push('borrow_dominance');
  if (supplyUsd > 0 && supplyUsd >= borrowUsd * 1.5) anomalies.push('supply_dominance');
  if (withdrawUsd > 0 && withdrawUsd >= Math.max(supplyUsd, borrowUsd, repayUsd, 1) * 1.15) anomalies.push('withdraw_pressure');
  if (repayUsd > 0 && repayUsd >= Math.max(supplyUsd, borrowUsd, withdrawUsd, 1) * 1.15) anomalies.push('repay_pressure');
  if (whaleRatio >= 0.6) anomalies.push('whale_dominance');
  if (whaleRatio <= 0.25) anomalies.push('retail_dominance');
  if ((protocolShares[0]?.share || 0) >= 0.55) anomalies.push('protocol_concentration');

  return {
    as_of: new Date().toISOString(),
    window: '4h',
    market_pulse: {
      heat_index: heatIndex,
      sentiment_deg: Math.max(-90, Math.min(90, sentimentDeg)),
      whale_ratio: Number(whaleRatio.toFixed(4))
    },
    activity: {
      current_events_4h: currentEvents,
      baseline_events_4h: Number(baselineEventsForWindow.toFixed(1)),
      current_per_hour: Number(currentPerHour.toFixed(2)),
      baseline_per_hour_24h: Number(baselinePerHour24h.toFixed(2)),
      change_vs_baseline_pct: Number(activityDeltaPct.toFixed(2)),
      events_1h: recent1h.length
    },
    flow: {
      supply_usd: Number(supplyUsd.toFixed(2)),
      borrow_usd: Number(borrowUsd.toFixed(2)),
      withdraw_usd: Number(withdrawUsd.toFixed(2)),
      repay_usd: Number(repayUsd.toFixed(2)),
      swap_usd: Number(recentSummary.swapUsd.toFixed(2)),
      bridge_usd: Number(recentSummary.bridgeUsd.toFixed(2))
    },
    participants: {
      whale_count: whaleCount,
      retail_count: retailCount,
      whale_share_priced_flow: Number(whaleRatio.toFixed(4))
    },
    concentration: {
      top_protocols: protocolShares,
      top_assets: assetShares
    },
    action_mix: {
      total_events: actionTotal,
      supply_events: recentSummary.supplyEvents,
      borrow_events: recentSummary.borrowEvents,
      withdraw_events: recentSummary.withdrawEvents,
      repay_events: recentSummary.repayEvents,
      supply_share: shareOf(recentSummary.supplyEvents),
      borrow_share: shareOf(recentSummary.borrowEvents),
      withdraw_share: shareOf(recentSummary.withdrawEvents),
      repay_share: shareOf(recentSummary.repayEvents)
    },
    deltas: {
      borrow_vs_prev_4h_pct: Number(pctDelta(recentSummary.borrowUsd, previousSummary.borrowUsd).toFixed(2)),
      supply_vs_prev_4h_pct: Number(pctDelta(recentSummary.supplyUsd, previousSummary.supplyUsd).toFixed(2)),
      withdraw_vs_prev_4h_pct: Number(pctDelta(recentSummary.withdrawUsd, previousSummary.withdrawUsd).toFixed(2)),
      repay_vs_prev_4h_pct: Number(pctDelta(recentSummary.repayUsd, previousSummary.repayUsd).toFixed(2)),
      whale_ratio_vs_prev_4h: Number((whaleRatio - (previousSummary.whaleCount + previousSummary.retailCount > 0
        ? previousSummary.whaleCount / (previousSummary.whaleCount + previousSummary.retailCount)
        : 0.5)).toFixed(4))
    },
    anomalies
  };
}

function buildMarketPulse(rows, priceMap = null) {
  const snapshot = buildMarketPulseSnapshot(rows, priceMap);
  return {
    ...snapshot.market_pulse,
    current_events: snapshot.activity.current_events_4h,
    baseline_events: snapshot.activity.baseline_events_4h,
    current_per_hour: snapshot.activity.current_per_hour,
    baseline_per_hour: snapshot.activity.baseline_per_hour_24h,
    supply_usd: snapshot.flow.supply_usd,
    borrow_usd: snapshot.flow.borrow_usd,
    withdraw_usd: snapshot.flow.withdraw_usd,
    repay_usd: snapshot.flow.repay_usd,
    action_total_events: snapshot.action_mix.total_events,
    supply_events: snapshot.action_mix.supply_events,
    borrow_events: snapshot.action_mix.borrow_events,
    withdraw_events: snapshot.action_mix.withdraw_events,
    repay_events: snapshot.action_mix.repay_events,
    supply_share: snapshot.action_mix.supply_share,
    borrow_share: snapshot.action_mix.borrow_share,
    withdraw_share: snapshot.action_mix.withdraw_share,
    repay_share: snapshot.action_mix.repay_share,
    whale_count: snapshot.participants.whale_count,
    retail_count: snapshot.participants.retail_count,
    window: snapshot.window,
    updated_at: snapshot.as_of
  };
}

async function fetchMarketPulseRows(db) {
  const result = await db.query(`
    SELECT ref_tx_hash, action_type, protocol_name, token_in_symbol, token_in_amount,
           token_out_symbol, token_out_amount, value_eth, event_timestamp, enriched_at
    FROM enriched_events
    WHERE action_type IS NOT NULL
      AND action_type NOT IN ('UNKNOWN', 'RESERVE_DATA_UPDATED', 'TRANSFER', 'APPROVE', 'WRAP', 'UNWRAP')
      AND COALESCE(event_timestamp, enriched_at) >= NOW() - INTERVAL '${MARKET_PULSE_RECENT_HOURS} hours'
    ORDER BY COALESCE(event_timestamp, enriched_at) DESC
    LIMIT $1
  `, [MARKET_PULSE_RECENT_ROWS_LIMIT]);
  return result.rows || [];
}

async function ensureTokenPriceTable(db) {
  if (tokenPriceTableEnsured) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS ${TOKEN_PRICE_CACHE_TABLE} (
      chain TEXT NOT NULL,
      symbol TEXT NOT NULL,
      coingecko_id TEXT,
      price_usd NUMERIC NOT NULL,
      source TEXT NOT NULL DEFAULT 'coingecko',
      fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (chain, symbol)
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_${TOKEN_PRICE_CACHE_TABLE}_fetched_at
    ON ${TOKEN_PRICE_CACHE_TABLE}(fetched_at DESC)
  `).catch(() => null);
  tokenPriceTableEnsured = true;
}

async function fetchTokenPriceMap(db) {
  if (tokenPriceMemCache.map && (Date.now() - tokenPriceMemCache.timestamp) < TOKEN_PRICE_MEM_TTL_MS) {
    return tokenPriceMemCache.map;
  }

  await ensureTokenPriceTable(db).catch(() => null);
  const rows = await db.query(`
    SELECT symbol, price_usd
    FROM ${TOKEN_PRICE_CACHE_TABLE}
    WHERE chain = $1
      AND fetched_at >= NOW() - INTERVAL '${TOKEN_PRICE_STALE_MAX_MINUTES} minutes'
      AND price_usd > 0
  `, [TOKEN_PRICE_CHAIN]).catch(() => ({ rows: [] }));

  const map = {};
  (rows.rows || []).forEach((row) => {
    const sym = normalizePulseSymbol(row.symbol);
    const px = Number(row.price_usd);
    if (!sym || !Number.isFinite(px) || px <= 0) return;
    map[sym] = px;
    const canon = canonicalPriceSymbol(sym);
    if (canon && canon !== sym) map[canon] = px;
  });

  tokenPriceMemCache.timestamp = Date.now();
  tokenPriceMemCache.map = map;
  return map;
}

async function refreshTokenPriceCacheFromCoinGecko(db) {
  await ensureTokenPriceTable(db);
  const uniqueIds = [...new Set(Object.values(COINGECKO_SYMBOL_MAP))];
  const idsParam = uniqueIds.join(',');
  const apiKey = String(process.env.COINGECKO_API_KEY || '').trim();
  const headers = { Accept: 'application/json' };
  let url;
  if (apiKey) {
    url = `https://pro-api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(idsParam)}&vs_currencies=usd&include_24hr_change=true`;
    headers['x-cg-pro-api-key'] = apiKey;
  } else {
    url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(idsParam)}&vs_currencies=usd&include_24hr_change=true`;
  }

  const res = await fetch(url, { headers });
  const bodyText = await res.text();
  if (!res.ok) {
    throw new Error(`CoinGecko HTTP ${res.status}: ${bodyText.slice(0, 500)}`);
  }
  let data;
  try {
    data = JSON.parse(bodyText);
  } catch (e) {
    throw new Error(`CoinGecko invalid JSON: ${e.message}`);
  }

  const upsertSql = `
    INSERT INTO ${TOKEN_PRICE_CACHE_TABLE} (chain, symbol, coingecko_id, price_usd, change_24h_pct, source, fetched_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
    ON CONFLICT (chain, symbol) DO UPDATE SET
      coingecko_id = EXCLUDED.coingecko_id,
      price_usd = EXCLUDED.price_usd,
      change_24h_pct = EXCLUDED.change_24h_pct,
      source = EXCLUDED.source,
      fetched_at = NOW(),
      updated_at = NOW()
  `;

  const updatedFromApi = new Set();
  let symbolsUpdated = 0;
  for (const [rawSym, cgId] of Object.entries(COINGECKO_SYMBOL_MAP)) {
    const sym = normalizePulseSymbol(rawSym);
    const usd = data[cgId]?.usd;
    const px = Number(usd);
    if (!sym || !Number.isFinite(px) || px <= 0) continue;
    const change24h = data[cgId]?.usd_24h_change;
    const changePct = Number.isFinite(Number(change24h)) ? Number(Number(change24h).toFixed(4)) : null;
    await db.query(upsertSql, [TOKEN_PRICE_CHAIN, sym, cgId, px, changePct, 'coingecko']);
    updatedFromApi.add(sym);
    symbolsUpdated += 1;
  }

  const stableUpsertSql = `
    INSERT INTO ${TOKEN_PRICE_CACHE_TABLE} (chain, symbol, coingecko_id, price_usd, source, fetched_at, updated_at)
    VALUES ($1, $2, NULL, 1.0, 'stable-fallback', NOW(), NOW())
    ON CONFLICT (chain, symbol) DO UPDATE SET
      price_usd = EXCLUDED.price_usd,
      source = EXCLUDED.source,
      fetched_at = NOW(),
      updated_at = NOW()
  `;
  const stableSymbols = ['USDC', 'USDT', 'DAI', 'USDC.E', 'USDCE', 'USDT0'];
  let stableFallbackUpserts = 0;
  for (const s of stableSymbols) {
    const sym = normalizePulseSymbol(s);
    if (!sym || updatedFromApi.has(sym)) continue;
    await db.query(stableUpsertSql, [TOKEN_PRICE_CHAIN, sym]);
    stableFallbackUpserts += 1;
  }

  const refreshedAt = new Date().toISOString();
  return {
    symbols_updated: symbolsUpdated,
    ids_requested: uniqueIds.length,
    stable_fallback_upserts: stableFallbackUpserts,
    refreshed_at: refreshedAt
  };
}

async function fetchTickerData(db) {
  const seenRows = await db.query(`
    SELECT DISTINCT UPPER(TRIM(symbol)) AS symbol
    FROM (
      SELECT asset_symbol AS symbol
      FROM enriched_events
      WHERE COALESCE(event_timestamp, enriched_at) >= NOW() - INTERVAL '7 days'
      UNION ALL
      SELECT token_in_symbol AS symbol
      FROM enriched_events
      WHERE COALESCE(event_timestamp, enriched_at) >= NOW() - INTERVAL '7 days'
      UNION ALL
      SELECT token_out_symbol AS symbol
      FROM enriched_events
      WHERE COALESCE(event_timestamp, enriched_at) >= NOW() - INTERVAL '7 days'
    ) s
    WHERE symbol IS NOT NULL
      AND TRIM(symbol) <> ''
  `);
  const seenSymbols = new Set(
    (seenRows.rows || [])
      .map((row) => canonicalPriceSymbol(row.symbol))
      .filter(Boolean)
  );

  const apyRows = await db.query(`
    SELECT
      UPPER(TRIM(asset_symbol)) AS symbol,
      apy_percent,
      COALESCE(event_timestamp, enriched_at) AS last_seen
    FROM enriched_events
    WHERE asset_symbol IS NOT NULL
      AND TRIM(asset_symbol) <> ''
      AND apy_percent IS NOT NULL
      AND apy_percent > 0
      AND COALESCE(event_timestamp, enriched_at) >= NOW() - INTERVAL '7 days'
    ORDER BY COALESCE(event_timestamp, enriched_at) DESC
    LIMIT 8000
  `);
  const apyBySymbol = new Map();
  for (const row of (apyRows.rows || [])) {
    const symbol = canonicalPriceSymbol(row.symbol);
    const apy = Number(row.apy_percent);
    if (!symbol || !seenSymbols.has(symbol) || !Number.isFinite(apy) || apy <= 0) continue;
    if (apyBySymbol.has(symbol)) continue;
    apyBySymbol.set(symbol, {
      symbol,
      apy_percent: Number(apy.toFixed(4)),
      last_seen: row.last_seen
    });
  }

  const apyPrev24hRows = await db.query(`
    SELECT DISTINCT ON (UPPER(TRIM(asset_symbol)))
      UPPER(TRIM(asset_symbol)) AS symbol,
      apy_percent
    FROM enriched_events
    WHERE asset_symbol IS NOT NULL
      AND TRIM(asset_symbol) <> ''
      AND apy_percent IS NOT NULL
      AND apy_percent > 0
      AND COALESCE(event_timestamp, enriched_at) >= NOW() - INTERVAL '26 hours'
      AND COALESCE(event_timestamp, enriched_at) <= NOW() - INTERVAL '22 hours'
    ORDER BY UPPER(TRIM(asset_symbol)), COALESCE(event_timestamp, enriched_at) DESC
  `).catch(() => ({ rows: [] }));
  const prev24hApy = new Map();
  for (const row of (apyPrev24hRows.rows || [])) {
    const symbol = canonicalPriceSymbol(row.symbol);
    const apy = Number(row.apy_percent);
    if (symbol && Number.isFinite(apy) && apy > 0) {
      prev24hApy.set(symbol, apy);
    }
  }

  for (const [symbol, entry] of apyBySymbol) {
    const prev = prev24hApy.get(symbol);
    if (prev != null && Number.isFinite(prev) && prev > 0) {
      entry.apy_prev_24h = Number(prev.toFixed(4));
      entry.trend = entry.apy_percent > prev ? 'up' : entry.apy_percent < prev ? 'down' : 'flat';
    } else {
      entry.apy_prev_24h = null;
      entry.trend = null;
    }
  }

  const apys = Array.from(apyBySymbol.values()).sort((a, b) => {
    const apyDelta = (Number(b.apy_percent) || 0) - (Number(a.apy_percent) || 0);
    if (apyDelta !== 0) return apyDelta;
    return String(a.symbol).localeCompare(String(b.symbol));
  });

  await ensureTokenPriceTable(db).catch(() => null);
  const priceRows = await db.query(`
    SELECT symbol, price_usd, change_24h_pct, source, fetched_at
    FROM ${TOKEN_PRICE_CACHE_TABLE}
    WHERE chain = $1
      AND fetched_at >= NOW() - INTERVAL '${TOKEN_PRICE_STALE_MAX_MINUTES} minutes'
      AND price_usd > 0
    ORDER BY fetched_at DESC, symbol ASC
  `, [TOKEN_PRICE_CHAIN]).catch(() => ({ rows: [] }));

  const stableTickerSymbols = new Set([
    'USDC', 'USDT', 'DAI', 'USDC.E', 'USDCE', 'USDT0', 'USDCN', 'USDE', 'GHO'
  ]);
  const priceBySymbol = new Map();
  for (const row of (priceRows.rows || [])) {
    const symbol = canonicalPriceSymbol(row.symbol);
    const price = Number(row.price_usd);
    if (!symbol || !seenSymbols.has(symbol)) continue;
    if (stableTickerSymbols.has(symbol)) continue;
    if (!Number.isFinite(price) || price <= 0) continue;
    if (priceBySymbol.has(symbol)) continue;
    const change = Number(row.change_24h_pct);
    const priceTrend = Number.isFinite(change) ? (change > 0 ? 'up' : change < 0 ? 'down' : 'flat') : null;
    priceBySymbol.set(symbol, {
      symbol,
      price_usd: Number(price.toFixed(price >= 1000 ? 2 : 6)),
      change_24h_pct: Number.isFinite(change) ? Number(change.toFixed(2)) : null,
      trend: priceTrend,
      source: row.source || 'coingecko'
    });
  }
  const PRICE_TICKER_ORDER = ['WBTC', 'WETH', 'AAVE', 'ARB', 'LINK', 'UNI', 'CRV', 'GMX', 'LDO'];
  const prices = Array.from(priceBySymbol.values()).sort((a, b) => {
    const ai = PRICE_TICKER_ORDER.indexOf(a.symbol);
    const bi = PRICE_TICKER_ORDER.indexOf(b.symbol);
    const ao = ai === -1 ? PRICE_TICKER_ORDER.length : ai;
    const bo = bi === -1 ? PRICE_TICKER_ORDER.length : bi;
    if (ao !== bo) return ao - bo;
    return String(a.symbol).localeCompare(String(b.symbol));
  });

  return {
    apys,
    prices,
    as_of: new Date().toISOString()
  };
}

async function fetchExplorerVolumeRows(db) {
  const result = await db.query(`
    SELECT ref_tx_hash, action_type, token_in_symbol, token_in_amount,
           token_out_symbol, token_out_amount, value_eth, event_timestamp, enriched_at
    FROM enriched_events
    WHERE action_type IS NOT NULL
      AND action_type NOT IN ('UNKNOWN', 'RESERVE_DATA_UPDATED', 'TRANSFER', 'APPROVE', 'WRAP', 'UNWRAP')
      AND COALESCE(event_timestamp, enriched_at) >= NOW() - INTERVAL '${EXPLORER_VOLUME_LOOKBACK_HOURS} hours'
    ORDER BY COALESCE(event_timestamp, enriched_at) DESC
    LIMIT $1
  `, [EXPLORER_VOLUME_ROWS_LIMIT]);
  return result.rows || [];
}

function buildExplorerVolumeSummary(rows, priceMap = null) {
  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;
  const oneHourMs = 60 * 60 * 1000;
  const last1hAgo = now - oneHourMs;
  const last2hAgo = now - (2 * oneHourMs);
  const last24hAgo = now - oneDayMs;
  const last48hAgo = now - (2 * oneDayMs);
  const last72hAgo = now - (3 * oneDayMs);
  const nowDate = new Date(now);
  const todayStart = Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate());
  const yesterdayStart = todayStart - oneDayMs;
  const twoDaysAgoStart = todayStart - (2 * oneDayMs);

  const unique = [];
  const seen = new Set();
  rows.forEach((row, index) => {
    const ts = marketPulseTs(row);
    const key = [
      row.ref_tx_hash || 'nohash',
      row.action_type || 'noaction',
      row.token_in_symbol || 'nosym_in',
      String(row.token_in_amount ?? 'noamt_in'),
      row.token_out_symbol || 'nosym_out',
      String(row.token_out_amount ?? 'noamt_out'),
      String(row.value_eth ?? 'novalue'),
      Number.isFinite(ts) ? ts : (row.event_timestamp || row.enriched_at || `row-${index}`)
    ].join('|');
    if (seen.has(key)) return;
    seen.add(key);
    unique.push(row);
  });

  let volume24h = 0;
  let volumePrev24h = 0;
  let volume1h = 0;
  let volumePrev1h = 0;
  let todayVolume = 0;
  let yesterdayVolume = 0;
  let twoDaysAgoVolume = 0;
  let totalEvents24h = 0;
  let pricedEvents24h = 0;

  unique.forEach((row) => {
    const ts = marketPulseTs(row);
    if (!Number.isFinite(ts) || ts < last72hAgo || ts > now + 5 * 60 * 1000) return;
    const usd = estimateUsdValueFromEvent(row, priceMap);

    if (ts >= last1hAgo && usd > 0) {
      volume1h += usd;
    } else if (ts >= last2hAgo && usd > 0) {
      volumePrev1h += usd;
    }

    if (ts >= last24hAgo) {
      totalEvents24h += 1;
      if (usd > 0) {
        pricedEvents24h += 1;
        volume24h += usd;
      }
    } else if (ts >= last48hAgo && usd > 0) {
      volumePrev24h += usd;
    }

    if (usd <= 0) return;
    if (ts >= todayStart) todayVolume += usd;
    else if (ts >= yesterdayStart && ts < todayStart) yesterdayVolume += usd;
    else if (ts >= twoDaysAgoStart && ts < yesterdayStart) twoDaysAgoVolume += usd;
  });

  const change1hPct = pctDelta(volume1h, volumePrev1h);
  const change24hPct = pctDelta(volume24h, volumePrev24h);
  const todayVsYesterdayPct = pctDelta(todayVolume, yesterdayVolume);
  const yesterdayVsTwoDaysAgoPct = pctDelta(yesterdayVolume, twoDaysAgoVolume);
  const trend1h = change1hPct > 1 ? 'up' : change1hPct < -1 ? 'down' : 'flat';
  const trend24h = change24hPct > 1 ? 'up' : change24hPct < -1 ? 'down' : 'flat';

  return {
    as_of: new Date(now).toISOString(),
    window: '24h',
    lookback: '72h',
    volume_1h_usd: Number(volume1h.toFixed(2)),
    previous_1h_usd: Number(volumePrev1h.toFixed(2)),
    change_pct_1h: Number(change1hPct.toFixed(2)),
    trend_1h: trend1h,
    volume_24h_usd: Number(volume24h.toFixed(2)),
    previous_24h_usd: Number(volumePrev24h.toFixed(2)),
    change_pct_24h: Number(change24hPct.toFixed(2)),
    trend_24h: trend24h,
    total_events_24h: totalEvents24h,
    priced_events_24h: pricedEvents24h,
    priced_coverage_24h: totalEvents24h > 0 ? Number((pricedEvents24h / totalEvents24h).toFixed(4)) : 0,
    daily: {
      today_usd: Number(todayVolume.toFixed(2)),
      yesterday_usd: Number(yesterdayVolume.toFixed(2)),
      two_days_ago_usd: Number(twoDaysAgoVolume.toFixed(2)),
      today_vs_yesterday_pct: Number(todayVsYesterdayPct.toFixed(2)),
      yesterday_vs_two_days_ago_pct: Number(yesterdayVsTwoDaysAgoPct.toFixed(2))
    }
  };
}

async function ensureMarketPulseInsightTable(db) {
  if (marketPulseInsightTableEnsured) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS market_pulse_insight_cache (
      cache_key TEXT PRIMARY KEY,
      payload_json JSONB NOT NULL,
      snapshot_hash TEXT NOT NULL,
      model_name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    )
  `);
  marketPulseInsightTableEnsured = true;
}

async function readMarketPulseInsightCacheRow(db) {
  const result = await db.query(`
    SELECT cache_key, payload_json, snapshot_hash, model_name, created_at, expires_at
    FROM market_pulse_insight_cache
    WHERE cache_key = $1
    LIMIT 1
  `, [MARKET_PULSE_INSIGHT_CACHE_KEY]).catch(() => ({ rows: [] }));
  return result.rows?.[0] || null;
}

async function writeMarketPulseInsightCacheRow(db, payload, snapshotHash, modelName) {
  await db.query(`
    INSERT INTO market_pulse_insight_cache (cache_key, payload_json, snapshot_hash, model_name, created_at, expires_at)
    VALUES ($1, $2::jsonb, $3, $4, NOW(), NOW() + ($5 * INTERVAL '1 millisecond'))
    ON CONFLICT (cache_key) DO UPDATE
    SET payload_json = EXCLUDED.payload_json,
        snapshot_hash = EXCLUDED.snapshot_hash,
        model_name = EXCLUDED.model_name,
        created_at = NOW(),
        expires_at = EXCLUDED.expires_at
  `, [
    MARKET_PULSE_INSIGHT_CACHE_KEY,
    JSON.stringify(payload),
    snapshotHash,
    modelName,
    MARKET_PULSE_INSIGHT_TTL_MS
  ]);
}

function isMarketPulseCacheFresh(cacheRow) {
  if (!cacheRow?.expires_at) return false;
  return new Date(cacheRow.expires_at).getTime() > Date.now();
}

function inferPulseInsightProvider(source, modelName) {
  const normalizedSource = String(source || '').trim().toLowerCase();
  const normalizedModel = String(modelName || '').trim().toLowerCase();
  if (normalizedModel.startsWith('openclaw:')) return 'openclaw';
  if (normalizedSource === 'chutes') return 'chutes';
  if (normalizedSource === 'proxy' || normalizedSource === 'model') return 'openclaw';
  if (normalizedSource === 'fallback') {
    return normalizedModel ? 'openclaw' : 'internal';
  }
  return normalizedModel ? 'model' : 'internal';
}

function buildMarketPulseInsightResponse(payload, cacheRow, extra = {}) {
  const createdAtMs = cacheRow?.created_at ? new Date(cacheRow.created_at).getTime() : null;
  const expiresAtMs = cacheRow?.expires_at ? new Date(cacheRow.expires_at).getTime() : null;
  const nowMs = Date.now();
  const modelName = extra.model_name ?? cacheRow?.model_name ?? null;
  const resolvedSource = extra.source ?? payload?.source ?? null;
  const stale = typeof extra.stale === 'boolean' ? extra.stale : !isMarketPulseCacheFresh(cacheRow);
  const refreshing = typeof extra.refreshing === 'boolean' ? extra.refreshing : false;
  const cached = typeof extra.cached === 'boolean' ? extra.cached : Boolean(cacheRow?.payload_json);
  const cacheStatus = !cached ? 'miss' : (stale ? (refreshing ? 'stale_refreshing' : 'stale') : 'fresh');
  return {
    ...payload,
    provider: inferPulseInsightProvider(resolvedSource, modelName),
    model_name: modelName,
    proxy_configured: isOpenClawProxyConfigured(),
    cached,
    stale,
    fresh: !stale,
    refreshing,
    cache_status: cacheStatus,
    cache_created_at: cacheRow?.created_at || null,
    cache_expires_at: cacheRow?.expires_at || null,
    cache_age_seconds: createdAtMs ? Math.max(0, Math.round((nowMs - createdAtMs) / 1000)) : null,
    ...extra
  };
}

function isOpenClawProxyConfigured() {
  return Boolean((process.env.OPENCLAW_PROXY_URL || '').trim());
}

function isProxyBackedPulseInsight(cacheRow) {
  const source = String(cacheRow?.payload_json?.source || '').trim().toLowerCase();
  const modelName = String(cacheRow?.model_name || '').trim().toLowerCase();
  if (modelName.startsWith('openclaw:') || modelName.startsWith('eigenclaw')) return true;
  return source === 'proxy' || source === 'model' || source === 'eigenclaw';
}

function shouldAwaitPulseInsightRefresh(cacheRow) {
  if (!cacheRow?.payload_json) return true;
  if (!isMarketPulseCacheFresh(cacheRow)) return true;
  return isOpenClawProxyConfigured() && !isProxyBackedPulseInsight(cacheRow);
}

function getCronSecret(req) {
  return String(req.query?.secret || req.headers['authorization'] || (req.body && req.body.secret) || '').trim();
}

function isAuthorizedCronRequest(req) {
  const expectedSecret = String(process.env.CRON_SECRET || process.env.ADMIN_SECRET || process.env.X402_WALLET_SECRET || '').trim();
  const cronSecret = getCronSecret(req);
  if (!expectedSecret) return false;
  return cronSecret === expectedSecret || cronSecret === `Bearer ${expectedSecret}`;
}

function buildSnapshotHash(snapshot) {
  const normalized = {
    window: snapshot.window,
    market_pulse: snapshot.market_pulse,
    activity: snapshot.activity,
    flow: snapshot.flow,
    participants: snapshot.participants,
    concentration: snapshot.concentration,
    deltas: snapshot.deltas,
    anomalies: snapshot.anomalies
  };
  return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

function trimTo(text, maxLen) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

function hasNumericSignal(text) {
  return /[\d$%]/.test(String(text || ''));
}

function isCompleteSentence(text) {
  return /[.!?]["']?$/.test(String(text || '').trim());
}

function normalizeRibbonLine(text, maxLen) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  const sentenceMatch = normalized.match(/^(.+?[.!?]["']?)(?:\s|$)/);
  if (sentenceMatch && sentenceMatch[1].length <= maxLen) {
    return sentenceMatch[1].trim();
  }
  return normalized.length <= maxLen ? normalized : '';
}

function pickRibbonVariant(snapshot, salt, options) {
  const items = Array.isArray(options) ? options.filter(Boolean) : [];
  if (!items.length) return '';
  const base = buildSnapshotHash(snapshot);
  const hash = crypto.createHash('sha256').update(`${base}:${salt}`).digest('hex');
  const index = parseInt(hash.slice(0, 8), 16) % items.length;
  return items[index];
}

function fallbackRibbonLine(snapshot, pulseMode, warnings = [], drivers = []) {
  const anomalies = Array.isArray(snapshot?.anomalies) ? snapshot.anomalies : [];
  const combined = [...drivers, ...warnings].join(' ').toLowerCase();
  const activityDelta = Number(snapshot?.activity?.change_vs_baseline_pct);
  const byMode = {
    defensive: [
      'Caution is setting the tone.',
      'Risk appetite looks lower.',
      'The tone feels cautious.',
      'A defensive mood prevails.'
    ],
    risk_off: [
      'Pulling back from risk.',
      'Caution is leading.',
      'Shifting toward safety.',
      'Risk-off tone prevails.'
    ],
    risk_on: [
      'Risk appetite is building.',
      'Leaning back into risk.',
      'Confidence is returning.',
      'Risk-on mood emerging.'
    ],
    whale_accumulation: [
      'Big moves are shaping flow.',
      'Conviction is building.',
      'Strong hands are moving.',
      'Accumulation in progress.'
    ],
    retail_chase: [
      'Momentum is building.',
      'Pace is picking up.',
      'Urgency in the market.',
      'Pressure is building.'
    ],
    rotation: [
      'Capital is rotating.',
      'Flow is shifting around.',
      'Rotation is underway.',
      'Money is on the move.'
    ],
    mixed: [
      'Signals are mixed.',
      'The mood is mixed.',
      'Mixed signals persist.',
      'The tone is undecided.'
    ],
    unclear: [
      'Tone is hard to read.',
      'Signals remain noisy.',
      'Still settling down.',
      'Picture is unclear.'
    ]
  };
  const byAnomaly = {
    supply_dominance: [
      'Supply is setting the tone.',
      'Lenders are leading.',
      'Supply flow dominates.',
      'Lending leads the way.'
    ],
    borrow_dominance: [
      'Borrow is setting the tone.',
      'Leverage demand leads.',
      'Borrow flow dominates.',
      'Debt demand is rising.'
    ],
    withdraw_pressure: [
      'Withdrawals are rising.',
      'Funds are being pulled.',
      'Exit flow is building.',
      'Withdrawal pressure grows.'
    ],
    repay_pressure: [
      'Repayments are building.',
      'Debt is being reduced.',
      'Repay flow is growing.',
      'Deleveraging underway.'
    ],
    whale_dominance: [
      'Big moves are in play.',
      'Conviction is building.',
      'Strong hands leading.',
      'Big flow is shaping up.'
    ]
  };

  const dominantAnomaly = [
    'borrow_dominance',
    'supply_dominance',
    'withdraw_pressure',
    'repay_pressure',
    'whale_dominance'
  ].find((item) => anomalies.includes(item));

  if (dominantAnomaly && byAnomaly[dominantAnomaly]) {
    return pickRibbonVariant(snapshot, `anomaly:${dominantAnomaly}`, byAnomaly[dominantAnomaly]);
  }
  if (Number.isFinite(activityDelta)) {
    if (activityDelta <= -25) {
      return pickRibbonVariant(snapshot, 'activity:cooling', [
        'Flow has cooled off.',
        'Quieter than usual.',
        'Flow is slowing down.',
        'Things have calmed down.'
      ]);
    }
    if (activityDelta >= 25) {
      return pickRibbonVariant(snapshot, 'activity:heating', [
        'Flow is heating up.',
        'Pace is picking up.',
        'Moving faster than usual.',
        'Getting more active.'
      ]);
    }
  }
  if (pulseMode === 'defensive' || anomalies.includes('borrow_dominance')) {
    return pickRibbonVariant(snapshot, 'mode:defensive', byMode.defensive);
  }
  if (pulseMode === 'risk_off') {
    return pickRibbonVariant(snapshot, 'mode:risk_off', byMode.risk_off);
  }
  if (pulseMode === 'risk_on') {
    return pickRibbonVariant(snapshot, 'mode:risk_on', byMode.risk_on);
  }
  if (pulseMode === 'whale_accumulation' || anomalies.includes('whale_dominance')) {
    return pickRibbonVariant(snapshot, 'mode:whale_accumulation', byMode.whale_accumulation);
  }
  if (pulseMode === 'retail_chase' || anomalies.includes('retail_dominance')) {
    return pickRibbonVariant(snapshot, 'mode:retail_chase', byMode.retail_chase);
  }
  if (pulseMode === 'rotation') {
    return pickRibbonVariant(snapshot, 'mode:rotation', byMode.rotation);
  }
  return pickRibbonVariant(snapshot, `mode:${pulseMode || 'mixed'}`, byMode[pulseMode] || byMode.mixed);
}

function sanitizePulseInsightPayload(raw, snapshot) {
  const pulseMode = String(raw?.pulse_mode || 'mixed').trim().toLowerCase();
  const riskLevel = String(raw?.risk_level || 'medium').trim().toLowerCase();
  const confidenceNum = Number(raw?.confidence);
  const clampConfidence = Number.isFinite(confidenceNum) ? Math.max(0, Math.min(1, confidenceNum)) : 0.35;

  const drivers = Array.isArray(raw?.drivers)
    ? raw.drivers.map((x) => trimTo(x, 120)).filter(Boolean).slice(0, 3)
    : [];
  const warnings = Array.isArray(raw?.warnings)
    ? raw.warnings.map((x) => trimTo(x, 120)).filter(Boolean).slice(0, 2)
    : [];

  const fallbackHeadline = 'Reading the market now';
  const fallbackSummary = 'The market picture is still coming into focus. Flow patterns are being read and interpreted — check back shortly for a clearer read on sentiment.';
  const fallbackRibbon = fallbackRibbonLine(snapshot, pulseMode, warnings, drivers);
  const ribbonCandidate = normalizeRibbonLine(raw?.ribbon_line, MARKET_PULSE_INSIGHT_MAX_RIBBON_LINE);
  const safeRibbon = ribbonCandidate && !hasNumericSignal(ribbonCandidate) && isCompleteSentence(ribbonCandidate)
    ? ribbonCandidate
    : fallbackRibbon;

  return {
    pulse_mode: MARKET_PULSE_ALLOWED_PULSE_MODES.has(pulseMode) ? pulseMode : 'mixed',
    headline: trimTo(raw?.headline, MARKET_PULSE_INSIGHT_MAX_HEADLINE) || fallbackHeadline,
    summary: trimTo(raw?.summary, MARKET_PULSE_INSIGHT_MAX_SUMMARY) || fallbackSummary,
    ribbon_line: safeRibbon,
    confidence: Number(clampConfidence.toFixed(2)),
    risk_level: MARKET_PULSE_ALLOWED_RISK_LEVELS.has(riskLevel) ? riskLevel : 'medium',
    drivers: drivers.length ? drivers : ['Scripted pulse metrics remain available'],
    warnings,
    as_of: snapshot.as_of,
    window: snapshot.window,
    source: 'chutes',
    version: MARKET_PULSE_INSIGHT_VERSION
  };
}

function pulseInsightFallback(snapshot, reason = '') {
  const warnings = reason ? [trimTo(reason, 120)] : [];
  return {
    pulse_mode: 'mixed',
    headline: 'Market pulse is mixed',
    summary: 'Live activity is updating, but the AI interpretation layer is temporarily unavailable.',
    ribbon_line: 'Pulse insight is refreshing.',
    confidence: 0.25,
    risk_level: 'medium',
    drivers: ['Scripted pulse metrics are still available'],
    warnings,
    as_of: snapshot.as_of,
    window: snapshot.window,
    source: 'fallback',
    version: MARKET_PULSE_INSIGHT_VERSION
  };
}

async function generatePulseInsightViaOpenClawProxy(snapshot) {
  const baseUrl = (process.env.OPENCLAW_PROXY_URL || '').trim().replace(/\/+$/, '');
  const clientKey = (process.env.OPENCLAW_D6_CLIENT_KEY || process.env.OPENCLAW_PROXY_STATIC_CLIENT_KEY || '').trim();
  if (!baseUrl) throw new Error('OPENCLAW_PROXY_URL not configured');
  if (!clientKey) throw new Error('OPENCLAW_D6_CLIENT_KEY not configured');

  const retries = Math.max(0, parseInt(process.env.OPENCLAW_PROXY_MAX_RETRIES || '1', 10) || 1);
  const backoffMs = Math.max(100, parseInt(process.env.OPENCLAW_PROXY_RETRY_BACKOFF_MS || '600', 10) || 600);
  const timeoutSeconds = Math.max(5, parseInt(process.env.OPENCLAW_PROXY_TIMEOUT_SECONDS || '35', 10) || 35);

  const briefing = snapshot.briefing || JSON.stringify(snapshot);
  const message = `You are a sharp DeFi market analyst. Here is a briefing on the current on-chain state:

${briefing}

Based on this, return valid JSON (no markdown, no code fences) with these fields:
{
  "pulse_mode": one of: risk_on, risk_off, defensive, rotation, mixed, unclear
  "headline": creative editorial title, max 44 chars, 5-7 words, no numbers
  "summary": your thesis in 2-3 sentences, max 400 chars
  "ribbon_line": ultra-short mood line, max 34 chars, no numbers
  "confidence": number 0-1
  "risk_level": low, medium, or high
  "drivers": 1-3 short strings
  "warnings": 0-2 short strings
}

CRITICAL RULES:
- headline and summary must contain ZERO numbers, percentages, or dollar amounts.
- Do NOT recap the briefing. Interpret it — form a thesis. What does this positioning mean? What could happen next? What should a trader watch for?
- Write the summary like a sharp analyst giving a friend conviction: "The market is building dry powder — if borrowing picks back up, it could signal the start of a new leg." NOT: "Supply is up, borrow is down."
- headline should read like an editorial: "A quiet unwind beneath the surface", not "Supply dominant, borrow declining."
- Use prior D6 context if available to identify shifts or patterns compared to earlier readings.`;

  const requestPayload = {
    user_id: 'defeyes-pulse-insight',
    session_key: 'defeyes-pulse-insight',
    message,
    schema_enforcement: false,
    memory_retrieval: true,
    hard_json: true,
    temperature: 0.5,
    max_tokens: 600
  };

  let lastError = 'OpenClaw proxy failed';
  const totalAttempts = retries + 1;
  for (let attempt = 1; attempt <= totalAttempts; attempt++) {
    try {
      const res = await fetch(`${baseUrl}/v1/agent/query`, {
        method: 'POST',
        headers: {
          'X-D6-Client-Key': clientKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestPayload),
        signal: AbortSignal.timeout(timeoutSeconds * 1000)
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        lastError = `EigenClaw ${res.status}: ${body?.error || body?.message || 'Unknown error'}`;
        if ([429, 500, 502, 503, 504].includes(res.status) && attempt < totalAttempts) {
          await new Promise((r) => setTimeout(r, backoffMs * attempt));
          continue;
        }
        throw new Error(lastError);
      }

      let rawPayload = body.reply_json || null;
      if (!rawPayload && body.reply) {
        try {
          const cleaned = body.reply.replace(/```(?:json)?\s*/g, '').replace(/```/g, '').trim();
          rawPayload = JSON.parse(cleaned);
        } catch (_) { /* reply wasn't valid JSON — fall through */ }
      }
      if (!rawPayload || typeof rawPayload !== 'object') {
        lastError = 'EigenClaw returned no parseable JSON payload';
        if (attempt < totalAttempts) {
          await new Promise((r) => setTimeout(r, backoffMs * attempt));
          continue;
        }
        throw new Error(lastError);
      }

      const sanitized = sanitizePulseInsightPayload(rawPayload, snapshot);
      sanitized.source = String(body.source || sanitized.source || 'eigenclaw');

      return {
        payload: sanitized,
        modelName: body.model || 'eigenclaw-main'
      };
    } catch (err) {
      lastError = err?.message || String(err);
      if (attempt < totalAttempts) {
        await new Promise((r) => setTimeout(r, backoffMs * attempt));
        continue;
      }
    }
  }

  throw new Error(lastError);
}

async function generatePulseInsightWithChutesDirect(snapshot) {
  const chutesToken = process.env.CHUTES_API_TOKEN;
  const chutesUrl = (process.env.CHUTES_API_URL || 'https://llm.chutes.ai/v1').replace(/\/+$/, '');
  const chutesModel = (process.env.CHUTES_MODEL || 'deepseek-ai/DeepSeek-V3').trim();
  const chutesModelFallback = 'Qwen/Qwen3-235B-A22B-Instruct-2507-TEE';
  const chutesModels = (process.env.CHUTES_MODELS || [chutesModel, chutesModelFallback].join(','))
    .split(',')
    .map(m => m.trim())
    .filter(Boolean);

  if (!chutesToken) throw new Error('CHUTES_API_TOKEN not configured');

  const systemPrompt = `You are a market-state interpreter for an on-chain analytics product.
Analyze ONLY the structured snapshot provided by the user.
Do not invent values. Do not use outside knowledge. Return valid JSON only.

Allowed pulse_mode values: risk_on, risk_off, defensive, rotation, whale_accumulation, retail_chase, mixed, unclear
Allowed risk_level values: low, medium, high

Output JSON schema:
{
  "pulse_mode": "string",
  "headline": "string <= 44 chars, compact creative title",
  "summary": "string <= 400 chars, 2-3 sentences",
  "ribbon_line": "string <= 34 chars",
  "confidence": 0.0,
  "risk_level": "string",
  "drivers": ["string"],
  "warnings": ["string"]
}
Writing guidance:
- ribbon_line: ultra short (<=34 chars, 4-6 words), no numbers or dollar signs, describes the market tone.
- summary: 2-3 sentences (up to 400 chars) forming a THESIS about the current market state. Take a stance — what does this positioning tell you? What could happen next? Never repeat snapshot field names/values, never include numbers/percentages/tokens/protocols. Give the reader a signal they can act on, not a recap.
- headline: compact creative editorial title (<=44 chars, 5-7 words). No numbers, no data labels.`;

  const userPrompt = `Interpret this current on-chain market pulse snapshot.\n\nSnapshot:\n${JSON.stringify(snapshot)}\n\nReturn JSON only.`;

  const basePayload = {
    temperature: 0.2,
    max_tokens: 600,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]
  };

  let lastError = 'No model attempts executed';
  for (const modelName of chutesModels) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const chutesRes = await fetch(`${chutesUrl}/chat/completions`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${chutesToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...basePayload, model: modelName }),
          signal: AbortSignal.timeout(30000)
        });
        const chutesBody = await chutesRes.json().catch(() => ({}));
        if (!chutesRes.ok) {
          const errMsg = chutesBody?.error?.message || chutesBody?.detail || chutesRes.statusText || 'Unknown error';
          lastError = `Chutes ${chutesRes.status} (${modelName}): ${errMsg}`;
          if ([429, 500, 502, 503, 504].includes(chutesRes.status) && attempt < 2) {
            await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
            continue;
          }
          break;
        }

        const content = String(chutesBody?.choices?.[0]?.message?.content || '').trim();
        let parsed = null;
        try {
          parsed = JSON.parse(content);
        } catch (_) {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0]);
          }
        }
        if (!parsed || typeof parsed !== 'object') {
          lastError = `Invalid JSON payload from Chutes (${modelName})`;
          break;
        }

        return {
          payload: sanitizePulseInsightPayload(parsed, snapshot),
          modelName
        };
      } catch (err) {
        lastError = `${err?.message || String(err)} (${modelName})`;
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
          continue;
        }
      }
    }
  }

  throw new Error(lastError);
}

function qualitativeTrend(pct) {
  const v = Number(pct);
  if (!Number.isFinite(v)) return 'unchanged';
  if (v <= -50) return 'sharply_down';
  if (v <= -20) return 'notably_down';
  if (v <= -5) return 'slightly_down';
  if (v >= 50) return 'sharply_up';
  if (v >= 20) return 'notably_up';
  if (v >= 5) return 'slightly_up';
  return 'roughly_flat';
}

function qualitativeSize(usd) {
  const v = Number(usd);
  if (!Number.isFinite(v) || v <= 0) return 'negligible';
  if (v < 10000) return 'light';
  if (v < 100000) return 'moderate';
  if (v < 500000) return 'significant';
  return 'heavy';
}

function describePositioning(addingExposure) {
  if (addingExposure >= 0.65) return 'aggressively adding exposure';
  if (addingExposure >= 0.55) return 'leaning into new positions';
  if (addingExposure <= 0.35) return 'actively unwinding and de-risking';
  if (addingExposure <= 0.45) return 'leaning toward unwinding';
  return 'evenly split between adding and reducing exposure';
}

function describeMomentum(deltas) {
  const borrowTrend = qualitativeTrend(deltas?.borrow_vs_prev_4h_pct);
  const supplyTrend = qualitativeTrend(deltas?.supply_vs_prev_4h_pct);
  const withdrawTrend = qualitativeTrend(deltas?.withdraw_vs_prev_4h_pct);
  if (borrowTrend.includes('up') && supplyTrend.includes('up')) return 'conviction is growing on both sides';
  if (borrowTrend.includes('down') && withdrawTrend.includes('up')) return 'leverage is coming off and exits are increasing';
  if (borrowTrend.includes('up') && withdrawTrend.includes('down')) return 'appetite for leverage is building';
  if (supplyTrend.includes('down') && withdrawTrend.includes('up')) return 'capital is rotating out';
  if (borrowTrend.includes('down') && supplyTrend.includes('down')) return 'both sides are pulling back';
  return 'flow patterns are mixed with no strong directional signal';
}

function buildInsightSnapshot(snapshot) {
  const { activity, participants, market_pulse, concentration, flow, deltas, action_mix, ...rest } = snapshot;
  const noiseAnomalies = new Set(['whale_dominance', 'retail_dominance', 'protocol_concentration', 'activity_spike']);
  const addingExposure = (action_mix?.supply_share || 0) + (action_mix?.borrow_share || 0);
  const anomalies = (rest.anomalies || []).filter(a => !noiseAnomalies.has(a));
  const parts = [];
  parts.push(`Over the last ${rest.window || '4h'}, participants are ${describePositioning(addingExposure)}.`);
  parts.push(`The momentum reads: ${describeMomentum(deltas)}.`);
  if (market_pulse?.sentiment_deg > 30) parts.push('Dollar flow is tilted toward supply over borrowing.');
  else if (market_pulse?.sentiment_deg < -30) parts.push('Dollar flow is tilted toward borrowing over supply.');
  else parts.push('Dollar flow between supply and borrowing is roughly balanced.');
  if (anomalies.length) parts.push(`Notable signals: ${anomalies.join(', ')}.`);
  return { briefing: parts.join(' ') };
}

async function generatePulseInsight(snapshot) {
  const insightSnapshot = buildInsightSnapshot(snapshot);
  const hasProxy = isOpenClawProxyConfigured();
  if (hasProxy) {
    try {
      return await generatePulseInsightViaOpenClawProxy(insightSnapshot);
    } catch (err) {
      console.warn('[PulseInsight] EigenClaw failed, trying Chutes fallback:', err.message);
    }
  }
  try {
    return await generatePulseInsightWithChutesDirect(insightSnapshot);
  } catch (err) {
    console.warn('[PulseInsight] Chutes also failed:', err.message);
  }
  throw new Error('No insight provider available');
}

function scheduleMarketPulseInsightRefresh(db, existingCacheRow = null) {
  if (marketPulseInsightRefreshPromise) return marketPulseInsightRefreshPromise;

  marketPulseInsightRefreshPromise = (async () => {
    await ensureMarketPulseInsightTable(db);

    const cacheRow = existingCacheRow || await readMarketPulseInsightCacheRow(db);
    const rows = await fetchMarketPulseRows(db);
    let priceMap = null;
    try {
      await ensureTokenPriceTable(db);
      priceMap = await fetchTokenPriceMap(db);
    } catch (err) {
      console.warn('[PulseInsight] token price map failed:', err.message);
    }
    const snapshot = buildMarketPulseSnapshot(rows, priceMap);
    const snapshotHash = buildSnapshotHash(snapshot);

    let payload;
    let modelName = null;
    try {
      const aiResult = await generatePulseInsight(snapshot);
      payload = aiResult.payload;
      modelName = aiResult.modelName || null;
    } catch (err) {
      payload = pulseInsightFallback(snapshot, err.message || 'AI unavailable');
    }

    await writeMarketPulseInsightCacheRow(db, payload, snapshotHash, modelName);
    return { payload, modelName, reusedSnapshot: false };
  })()
    .catch((err) => {
      console.warn('[PulseInsight] background refresh failed:', err.message);
      throw err;
    })
    .finally(() => {
      marketPulseInsightRefreshPromise = null;
    });

  return marketPulseInsightRefreshPromise;
}

const PERSONA_SAMPLE_SIZE = parseInt(process.env.PERSONA_SAMPLE_SIZE || '75', 10);

// Calculate wallet statistics from events (for persona generation)
// Includes: dust filtering, value-weighting, recency decay, random-sample focus, complex-routing
function calculateWalletStats(events) {
  const filtered = filterDustEvents(events);
  const sampled = randomSample(filtered, PERSONA_SAMPLE_SIZE);

  const protocols = {};
  const actions = {};
  const valueByAction = {};
  const valueByProtocol = {};
  const recencyWeightedActions = {};
  const sampledActions = {};
  let firstSeen = null;
  let lastSeen = null;
  let totalVolumeEth = 0;
  const tokenVolumes = {};

  sampled.forEach(e => {
    const a = e.action_type || 'Unknown';
    sampledActions[a] = (sampledActions[a] || 0) + 1;
  });

  const protocolsPerTx = {};
  filtered.forEach(event => {
    const tx = event.ref_tx_hash || event.event_timestamp;
    if (!protocolsPerTx[tx]) protocolsPerTx[tx] = new Set();
    const p = event.protocol_name || 'Unknown';
    if (p !== 'Unknown') protocolsPerTx[tx].add(p);
  });

  const complexRoutingTxCount = Object.values(protocolsPerTx).filter(s => s.size >= 3).length;
  const totalTxCount = Object.keys(protocolsPerTx).length;

  filtered.forEach(event => {
    const protocol = event.protocol_name || 'Unknown';
    const action = event.action_type || 'Unknown';
    const vol = event.value_eth && !isNaN(parseFloat(event.value_eth)) ? parseFloat(event.value_eth) : 0;
    const weight = recencyWeight(event.event_timestamp);

    protocols[protocol] = (protocols[protocol] || 0) + 1;
    actions[action] = (actions[action] || 0) + 1;
    if (vol > 0) {
      valueByAction[action] = (valueByAction[action] || 0) + vol;
      valueByProtocol[protocol] = (valueByProtocol[protocol] || 0) + vol;
    }
    recencyWeightedActions[action] = (recencyWeightedActions[action] || 0) + weight;

    if (event.event_timestamp) {
      const ts = new Date(event.event_timestamp);
      if (!firstSeen || ts < firstSeen) firstSeen = ts;
      if (!lastSeen || ts > lastSeen) lastSeen = ts;
    }
    totalVolumeEth += vol;

    if (event.token_in_amount && event.token_in_symbol) {
      const symbol = event.token_in_symbol.toUpperCase();
      if (symbol !== 'UNKNOWN' && symbol !== '' && symbol !== 'NULL') {
        const amount = parseFloat(event.token_in_amount);
        if (!isNaN(amount) && amount > 0) tokenVolumes[symbol] = (tokenVolumes[symbol] || 0) + amount;
      }
    }
    if (event.token_out_amount && event.token_out_symbol) {
      const symbol = event.token_out_symbol.toUpperCase();
      if (symbol !== 'UNKNOWN' && symbol !== '' && symbol !== 'NULL') {
        const amount = parseFloat(event.token_out_amount);
        if (!isNaN(amount) && amount > 0) tokenVolumes[symbol] = (tokenVolumes[symbol] || 0) + amount;
      }
    }
  });

  const sortedProtocols = Object.entries(protocols)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));
  const sortedActions = Object.entries(actions)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

  // Value-dominant: which action/protocol has most volume (ignore dust)
  const totalValueAction = Object.values(valueByAction).reduce((a, b) => a + b, 0);
  const dominantByValue = totalValueAction > 0.01
    ? Object.entries(valueByAction).sort((a, b) => b[1] - a[1])[0]
    : null;

  const totalValueProtocol = Object.values(valueByProtocol).reduce((a, b) => a + b, 0);
  const dominantProtocolByValue = totalValueProtocol > 0.01
    ? Object.entries(valueByProtocol).sort((a, b) => b[1] - a[1])[0]
    : null;

  const daysSinceLast = lastSeen ? Math.floor((Date.now() - lastSeen) / (1000 * 60 * 60 * 24)) : null;
  const sampledSummary = Object.entries(sampledActions)
    .sort((a, b) => b[1] - a[1])
    .map(([a, c]) => `${a}:${c}`)
    .join(', ');

  return {
    totalEvents: filtered.length,
    eventsFiltered: events.length - filtered.length,
    protocols: sortedProtocols,
    actions: sortedActions,
    firstSeen: firstSeen ? firstSeen.toISOString() : null,
    lastSeen: lastSeen ? lastSeen.toISOString() : null,
    totalVolumeEth,
    tokenVolumes,
    valueByAction,
    valueByProtocol,
    recencyWeightedActions,
    sampledActions: sampledSummary,
    sampledCount: sampled.length,
    dominantByValue: dominantByValue ? { action: dominantByValue[0], valueEth: dominantByValue[1] } : null,
    dominantProtocolByValue: dominantProtocolByValue ? { protocol: dominantProtocolByValue[0], valueEth: dominantProtocolByValue[1] } : null,
    complexRoutingTxCount,
    totalTxCount,
    daysSinceLast
  };
}

// Generate API key
function generateApiKey() {
  return 'def_' + crypto.randomBytes(32).toString('hex');
}

// Hash password using SHA-256 with salt
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

// Verify password
function verifyPassword(password, storedHash) {
  const [salt, hash] = storedHash.split(':');
  const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}

// Generate deterministic wallet for customer (from customer ID + secret)
function generateCustomerWallet(customerId) {
  const secret = process.env.X402_WALLET_SECRET;
  if (!secret) throw new Error('X402_WALLET_SECRET environment variable is required for wallet generation');
  // Create deterministic private key from customer ID + secret
  const seed = crypto.createHash('sha256').update(`${customerId}-${secret}`).digest('hex');
  // Use first 64 chars as private key (32 bytes = 64 hex chars)
  const privateKey = '0x' + seed.slice(0, 64);
  const wallet = new ethers.Wallet(privateKey);
  return wallet;
}

// Encrypt private key for storage
function encryptPrivateKey(privateKey) {
  const algorithm = 'aes-256-gcm';
  const encKey = process.env.X402_ENCRYPTION_KEY;
  if (!encKey) throw new Error('X402_ENCRYPTION_KEY environment variable is required');
  const key = crypto.scryptSync(encKey, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  
  let encrypted = cipher.update(privateKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
}

// Decrypt private key from storage
function decryptPrivateKey(encryptedData) {
  const algorithm = 'aes-256-gcm';
  const encKey = process.env.X402_ENCRYPTION_KEY;
  if (!encKey) throw new Error('X402_ENCRYPTION_KEY environment variable is required');
  const key = crypto.scryptSync(encKey, 'salt', 32);
  const iv = Buffer.from(encryptedData.iv, 'hex');
  const authTag = Buffer.from(encryptedData.authTag, 'hex');
  
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted.trim();
}

// Prepaid credit system configuration
// x402 AI agent pricing stays at $0.001/req (unchanged in X402_CONFIG.pricing)
// Human USDC credits use tiered packs and per-endpoint weights
const PREPAID_CONFIG = {
  chargeAmount: 0.05,        // Default charge per payment ($0.05)
  callsPerPayment: 1,        // Credits granted per default payment
  pricePerCall: 0.05,        // $0.05 per credit (human rate, lowest pack)
  minCredits: 0
};

const CREDIT_PACKS = [
  { credits: 100,  priceUsdc: 5,   perCredit: 0.05 },
  { credits: 500,  priceUsdc: 20,  perCredit: 0.04 },
  { credits: 2000, priceUsdc: 60,  perCredit: 0.03 },
  { credits: 5000, priceUsdc: 100, perCredit: 0.02 }
];

const CREDIT_WEIGHTS = {
  '/api/stats': 1,
  '/api/v1/market-pulse': 1,
  '/api/v1/explorer-volume': 1,
  '/api/explorer/events': 1,
  '/api/events': 1,
  '/api/tx': 2,
  '/api/wallet/persona': 5,
  '/api/events/export': 10,
  '/api/tts/speak': 3,
  'default': 1
};

function getCreditWeight(endpoint) {
  if (CREDIT_WEIGHTS[endpoint]) return CREDIT_WEIGHTS[endpoint];
  for (const [path, weight] of Object.entries(CREDIT_WEIGHTS)) {
    if (endpoint.startsWith(path)) return weight;
  }
  return CREDIT_WEIGHTS['default'];
}

function creditsForDeposit(amountUsdc) {
  for (let i = CREDIT_PACKS.length - 1; i >= 0; i--) {
    if (amountUsdc >= CREDIT_PACKS[i].priceUsdc) {
      return Math.floor(amountUsdc / CREDIT_PACKS[i].perCredit);
    }
  }
  return Math.floor(amountUsdc / CREDIT_PACKS[0].perCredit);
}

// Automatically check wallet balance and grant credits if enough USDC is available
async function autoGrantCreditsFromWallet(customerId, network = 'base') {
  const db = getPool();
  
  // Get customer wallet
  const customerResult = await db.query(`
    SELECT x402_wallet_address, x402_wallet_encrypted_key
    FROM customers
    WHERE id = $1 AND x402_enabled = TRUE
  `, [customerId]);
  
  if (customerResult.rows.length === 0) {
    return { granted: false, reason: 'Wallet not found or pay-per-go not enabled' };
  }
  
  const customer = customerResult.rows[0];
  const walletAddress = customer.x402_wallet_address;
  
  // Check wallet balance on-chain
  const networkConfig = X402_CONFIG.networks[network];
  const provider = new ethers.providers.JsonRpcProvider(networkConfig.rpc);
  
  const usdcContract = new ethers.Contract(networkConfig.usdc, [
    'function balanceOf(address account) view returns (uint256)',
    'function transfer(address to, uint256 amount) returns (bool)'
  ], provider);
  
  const balance = await usdcContract.balanceOf(walletAddress);
  const balanceUsdc = Number(ethers.utils.formatUnits(balance, 6));
  
  // MINIMUM DEPOSIT: $5 (covers gas + provides reasonable credits)
  const MINIMUM_DEPOSIT = 5.0;
  
  if (balanceUsdc < MINIMUM_DEPOSIT) {
    return { 
      granted: false, 
      reason: 'Below minimum deposit', 
      balance: balanceUsdc,
      minimum: MINIMUM_DEPOSIT,
      message: `Minimum deposit: $${MINIMUM_DEPOSIT} USDC`
    };
  }
  
  // Calculate credits using tiered pack pricing
  const totalCharge = balanceUsdc;
  const totalCredits = creditsForDeposit(balanceUsdc);
  
  // CRITICAL: Check if there's any pending_sweep for this customer + network
  // If USDC hasn't been swept yet, the on-chain balance is the SAME deposit we already credited
  const pendingSweep = await db.query(`
    SELECT id, amount_usdc, credits_granted FROM x402_prepaid_payments 
    WHERE customer_id = $1 AND network = $2 AND status = 'pending_sweep'
  `, [customerId, network]);
  
  if (pendingSweep.rows.length > 0) {
    // Already credited for this deposit — sweep will be handled by /api/x402/sweep
    return { 
      granted: false, 
      reason: 'Already credited — pending sweep', 
      balance: balanceUsdc,
      previouslyGranted: parseInt(pendingSweep.rows[0].credits_granted),
      pendingSweep: true
    };
  }
  
  // Block only if we have a recent CONFIRMED payment that was never swept (tx_hash still dep-xxx)
  // After sweep, tx_hash = real tx; so a new deposit with same amount is allowed
  const recentGrant = await db.query(`
    SELECT id FROM x402_prepaid_payments 
    WHERE customer_id = $1 AND network = $2 AND status = 'confirmed'
    AND created_at > NOW() - INTERVAL '5 minutes'
    AND amount_usdc = $3
    AND tx_hash LIKE 'dep-%'
  `, [customerId, network, totalCharge]);
  
  if (recentGrant.rows.length > 0) {
    return { granted: false, reason: 'Already credited recently for this amount', balance: balanceUsdc };
  }
  
  // Stable deposit ID — must fit varchar(66). Use short hash.
  const depositHash = crypto.createHash('sha256').update(`${walletAddress}-${network}-${totalCharge.toFixed(6)}`).digest('hex').slice(0, 40);
  const depositId = `dep-${depositHash}`;
  
  // GRANT CREDITS IMMEDIATELY based on on-chain balance
  // We control the wallet private key, so the USDC is ours — safe to credit now
  await db.query(`
    UPDATE customers 
    SET x402_prepaid_credits = COALESCE(x402_prepaid_credits, 0) + $1
    WHERE id = $2
  `, [totalCredits, customerId]);
  
  // Log the deposit (mark as pending_sweep — USDC is still in user's deposit wallet)
  await db.query(`
    INSERT INTO x402_prepaid_payments 
    (customer_id, tx_hash, network, amount_usdc, credits_granted, from_wallet, to_wallet, confirmations, status, verified_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, 1, 'pending_sweep', NOW())
    ON CONFLICT (tx_hash) DO NOTHING
  `, [
    customerId,
    depositId,
    network,
    totalCharge,
    totalCredits,
    walletAddress,
    X402_CONFIG.paymentWallet
  ]);
  
  const creditsResult = await db.query('SELECT x402_prepaid_credits FROM customers WHERE id = $1', [customerId]);
  const newCredits = parseInt(creditsResult.rows[0].x402_prepaid_credits);
  
  console.log(`[AutoGrant] Credited ${totalCredits} credits to customer ${customerId} from ${network} ($${totalCharge} USDC)`);
  
  // NOTE: Sweep is NOT done here. It's done by the separate /api/x402/sweep endpoint.
  // This keeps autoGrant fast enough to complete within Vercel's 10s timeout.
  
  return {
    granted: true,
    depositId: depositId,
    amount: totalCharge,
    creditsGranted: totalCredits,
    newCredits,
    network: network,
    pendingSweep: true
  };
}

// Verify prepaid payment and grant credits (kept for backward compatibility)
async function verifyPrepaidPayment(customerId, txHash, network) {
  const db = getPool();
  
  // Check if already processed
  const existingPayment = await db.query('SELECT id, status, credits_granted FROM x402_prepaid_payments WHERE tx_hash = $1', [txHash]);
  if (existingPayment.rows.length > 0) {
    if (existingPayment.rows[0].status === 'confirmed') {
      return {
        success: true,
        alreadyProcessed: true,
        creditsGranted: existingPayment.rows[0].credits_granted
      };
    }
  }
  
  // Get customer wallet
  const customerResult = await db.query(`
    SELECT x402_wallet_address, x402_wallet_encrypted_key
    FROM customers
    WHERE id = $1 AND x402_enabled = TRUE
  `, [customerId]);
  
  if (customerResult.rows.length === 0) {
    throw new Error('Customer wallet not found or pay-per-go not enabled');
  }
  
  const fromWallet = customerResult.rows[0].x402_wallet_address;
  
  // Verify transaction on-chain
  const networkConfig = X402_CONFIG.networks[network];
  const provider = new ethers.providers.JsonRpcProvider(networkConfig.rpc);
  const receipt = await provider.getTransactionReceipt(txHash);
  
  if (!receipt || receipt.status !== 1) {
    throw new Error('Transaction not found or failed');
  }
  
  // Check confirmations (require 2 for prepaid)
  const currentBlock = await provider.getBlockNumber();
  const confirmations = currentBlock - receipt.blockNumber;
  if (confirmations < 2) {
    throw new Error(`Insufficient confirmations: ${confirmations}/2 required`);
  }
  
  // Parse USDC transfer
  const usdcContract = new ethers.Contract(networkConfig.usdc, [
    'event Transfer(address indexed from, address indexed to, uint256 value)',
    'function balanceOf(address account) view returns (uint256)'
  ], provider);
  
  const transferLogs = receipt.logs
    .filter(log => log.address.toLowerCase() === networkConfig.usdc.toLowerCase())
    .map(log => {
      try {
        return usdcContract.interface.parseLog({ topics: log.topics, data: log.data });
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  
  // Find transfer from user wallet to platform wallet
  const validTransfer = transferLogs.find(log => 
    log.name === 'Transfer' && 
    log.args.from.toLowerCase() === fromWallet.toLowerCase() &&
    log.args.to.toLowerCase() === X402_CONFIG.paymentWallet.toLowerCase()
  );
  
  if (!validTransfer) {
    throw new Error('No valid USDC transfer found from your wallet to payment wallet');
  }
  
  const amountUsdc = Number(validTransfer.args.value) / 1e6;
  
  // Verify amount matches expected charge
  if (Math.abs(amountUsdc - PREPAID_CONFIG.chargeAmount) > 0.001) {
    throw new Error(`Amount mismatch: expected $${PREPAID_CONFIG.chargeAmount}, got $${amountUsdc}`);
  }
  
  // Grant credits
  const creditsGranted = PREPAID_CONFIG.callsPerPayment;
  
  // Update or insert payment record
  if (existingPayment.rows.length === 0) {
    await db.query(`
      INSERT INTO x402_prepaid_payments 
      (customer_id, tx_hash, network, amount_usdc, credits_granted, from_wallet, to_wallet, confirmations, status, verified_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'confirmed', NOW())
    `, [customerId, txHash, network, amountUsdc, creditsGranted, fromWallet, X402_CONFIG.paymentWallet, confirmations]);
  } else {
    await db.query(`
      UPDATE x402_prepaid_payments
      SET status = 'confirmed', verified_at = NOW(), confirmations = $1
      WHERE tx_hash = $2
    `, [confirmations, txHash]);
  }
  
  // Add credits to customer
  await db.query(`
    UPDATE customers 
    SET x402_prepaid_credits = COALESCE(x402_prepaid_credits, 0) + $1
    WHERE id = $2
  `, [creditsGranted, customerId]);
  
  const creditsResult = await db.query('SELECT x402_prepaid_credits FROM customers WHERE id = $1', [customerId]);
  const newCredits = parseInt(creditsResult.rows[0].x402_prepaid_credits);
  
  return {
    success: true,
    amount: amountUsdc,
    creditsGranted,
    newCredits,
    txHash,
    confirmations
  };
}

// DIRECT CREDIT PURCHASE - User sends USDC directly to platform wallet
async function verifyDirectCreditPurchase(customerId, txHash, network = 'base') {
  const db = getPool();
  
  // Check if already processed
  const existingPayment = await db.query('SELECT id, status, credits_granted FROM x402_prepaid_payments WHERE tx_hash = $1', [txHash]);
  if (existingPayment.rows.length > 0 && existingPayment.rows[0].status === 'confirmed') {
    return {
      alreadyProcessed: true,
      creditsGranted: existingPayment.rows[0].credits_granted
    };
  }
  
  // Verify transaction on-chain
  const networkConfig = X402_CONFIG.networks[network];
  if (!networkConfig) {
    throw new Error(`Unsupported network: ${network}`);
  }
  
  const provider = new ethers.providers.JsonRpcProvider(networkConfig.rpc);
  const receipt = await provider.getTransactionReceipt(txHash);
  
  if (!receipt || receipt.status !== 1) {
    throw new Error('Transaction not found or failed');
  }
  
  // Check confirmations
  const currentBlock = await provider.getBlockNumber();
  const confirmations = currentBlock - receipt.blockNumber;
  if (confirmations < 1) {
    throw new Error(`Insufficient confirmations: ${confirmations}/1 required. Please wait a moment and try again.`);
  }
  
  // Parse USDC transfer TO platform wallet
  const usdcContract = new ethers.Contract(networkConfig.usdc, [
    'event Transfer(address indexed from, address indexed to, uint256 value)'
  ], provider);
  
  const transferLogs = receipt.logs
    .filter(log => log.address.toLowerCase() === networkConfig.usdc.toLowerCase())
    .map(log => {
      try {
        return usdcContract.interface.parseLog({ topics: log.topics, data: log.data });
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  
  // Find transfer TO platform wallet (from ANY address)
  const validTransfer = transferLogs.find(log => 
    log.name === 'Transfer' && 
    log.args.to.toLowerCase() === X402_CONFIG.paymentWallet.toLowerCase()
  );
  
  if (!validTransfer) {
    throw new Error(`No USDC transfer to platform wallet found. Make sure you sent USDC to ${X402_CONFIG.paymentWallet}`);
  }
  
  const amountUsdc = Number(validTransfer.args.value) / 1e6;
  const fromWallet = validTransfer.args.from;
  
  // Minimum $0.02
  if (amountUsdc < 0.02) {
    throw new Error(`Amount too small: minimum $0.02, received $${amountUsdc.toFixed(2)}`);
  }
  
  // Calculate credits: $0.001 per credit (1000 credits per $1)
  const creditsGranted = Math.floor(amountUsdc * 1000);
  
  // Insert payment record
  if (existingPayment.rows.length === 0) {
    await db.query(`
      INSERT INTO x402_prepaid_payments 
      (customer_id, tx_hash, network, amount_usdc, credits_granted, from_wallet, to_wallet, confirmations, status, verified_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'confirmed', NOW())
    `, [customerId, txHash, network, amountUsdc, creditsGranted, fromWallet, X402_CONFIG.paymentWallet, confirmations]);
  } else {
    await db.query(`
      UPDATE x402_prepaid_payments
      SET status = 'confirmed', verified_at = NOW(), confirmations = $1, credits_granted = $2
      WHERE tx_hash = $3
    `, [confirmations, creditsGranted, txHash]);
  }
  
  // Add credits to customer
  await db.query(`
    UPDATE customers 
    SET x402_prepaid_credits = COALESCE(x402_prepaid_credits, 0) + $1
    WHERE id = $2
  `, [creditsGranted, customerId]);
  
  const creditsResult = await db.query('SELECT x402_prepaid_credits FROM customers WHERE id = $1', [customerId]);
  const newCredits = parseInt(creditsResult.rows[0].x402_prepaid_credits);
  
  return {
    success: true,
    amount: amountUsdc,
    creditsGranted,
    newCredits,
    txHash,
    confirmations,
    fromWallet
  };
}

// Check wallet balance and pending limits before allowing API calls
async function checkPayPerGoLimits(customerId, network = 'base') {
  const db = getPool();
  
  // Get customer wallet info
  const customerResult = await db.query(`
    SELECT x402_wallet_address, x402_wallet_encrypted_key
    FROM customers
    WHERE id = $1 AND x402_enabled = TRUE
  `, [customerId]);
  
  if (customerResult.rows.length === 0) {
    return { allowed: false, reason: 'Pay-per-go not enabled' };
  }
  
  const customer = customerResult.rows[0];
  const walletAddress = customer.x402_wallet_address;
  
  // Get total pending amount
  const pendingResult = await db.query(`
    SELECT SUM(amount_usdc) as total
    FROM x402_pending_payments
    WHERE customer_id = $1 AND network = $2 AND batched_at IS NULL
  `, [customerId, network]);
  
  const totalPending = parseFloat(pendingResult.rows[0]?.total || 0);
  
  // Check if pending exceeds maximum
  if (totalPending >= MAX_PENDING_AMOUNT) {
    return {
      allowed: false,
      reason: 'Maximum pending amount exceeded',
      pending: totalPending,
      maxPending: MAX_PENDING_AMOUNT,
      message: `You have $${totalPending.toFixed(2)} in pending payments. Please fund your wallet to allow batching.`
    };
  }
  
  // Check wallet balance on-chain
  try {
    const networkConfig = X402_CONFIG.networks[network];
    const provider = new ethers.providers.JsonRpcProvider(networkConfig.rpc);
    
    const usdcContract = new ethers.Contract(
      networkConfig.usdc,
      ['function balanceOf(address account) view returns (uint256)'],
      provider
    );
    
    const balance = await usdcContract.balanceOf(walletAddress);
    const balanceUsdc = Number(ethers.utils.formatUnits(balance, 6));
    
    // Check if wallet has enough to cover pending + next batch threshold
    const requiredBalance = totalPending + BATCH_THRESHOLD;
    
    if (balanceUsdc < requiredBalance) {
      return {
        allowed: false,
        reason: 'Insufficient wallet balance',
        walletBalance: balanceUsdc,
        pending: totalPending,
        required: requiredBalance,
        message: `Your wallet has $${balanceUsdc.toFixed(2)} USDC, but you need $${requiredBalance.toFixed(2)} to cover pending payments ($${totalPending.toFixed(2)}) and next batch ($${BATCH_THRESHOLD}). Please fund your wallet.`
      };
    }
    
    // Check if there are failed batches (status = 'failed')
    const failedBatchesResult = await db.query(`
      SELECT COUNT(*) as count
      FROM x402_batched_payments
      WHERE customer_id = $1 AND network = $2 AND status = 'failed'
    `, [customerId, network]);
    
    const failedCount = parseInt(failedBatchesResult.rows[0]?.count || 0);
    if (failedCount > 0) {
      return {
        allowed: false,
        reason: 'Previous batch failed',
        failedBatches: failedCount,
        message: `You have ${failedCount} failed batch(es). Please fund your wallet to resolve this.`
      };
    }
    
    return {
      allowed: true,
      walletBalance: balanceUsdc,
      pending: totalPending,
      available: balanceUsdc - totalPending
    };
  } catch (error) {
    console.error('Error checking wallet balance:', error);
    // If we can't check balance, be conservative and allow but log warning
    return {
      allowed: true,
      warning: 'Could not verify wallet balance',
      pending: totalPending
    };
  }
}

// Check and batch pending payments if threshold reached
async function checkAndBatchPayments(customerId, network = 'base') {
  const db = getPool();
  
  // Get pending payments for this customer and network
  const pendingResult = await db.query(`
    SELECT id, amount_usdc, endpoint, api_key_id
    FROM x402_pending_payments
    WHERE customer_id = $1 AND network = $2 AND batched_at IS NULL
    ORDER BY created_at ASC
  `, [customerId, network]);
  
  if (pendingResult.rows.length === 0) return null;
  
  const totalPending = pendingResult.rows.reduce((sum, p) => sum + parseFloat(p.amount_usdc), 0);
  
  // Only batch if threshold reached
  if (totalPending < BATCH_THRESHOLD) {
    return { pending: totalPending, count: pendingResult.rows.length, batched: false };
  }
  
  // Get customer wallet info
  const customerResult = await db.query(`
    SELECT x402_wallet_address, x402_wallet_encrypted_key
    FROM customers
    WHERE id = $1 AND x402_enabled = TRUE
  `, [customerId]);
  
  if (customerResult.rows.length === 0) {
    throw new Error('Customer wallet not found or X402 not enabled');
  }
  
  const customer = customerResult.rows[0];
  const fromWallet = customer.x402_wallet_address;
  
  // Decrypt private key
  const encryptedKey = JSON.parse(customer.x402_wallet_encrypted_key);
  const privateKey = decryptPrivateKey(encryptedKey);
  
  // Send batched payment
  const networkConfig = X402_CONFIG.networks[network];
  const provider = new ethers.providers.JsonRpcProvider(networkConfig.rpc);
  const wallet = new ethers.Wallet(privateKey, provider);
  
  // Check wallet balance first
  const usdcContract = new ethers.Contract(
    networkConfig.usdc,
    ['function balanceOf(address account) view returns (uint256)',
     'function transfer(address to, uint256 amount) returns (bool)'],
    provider
  );
  
  const balance = await usdcContract.balanceOf(wallet.address);
  const amountWei = ethers.utils.parseUnits(totalPending.toFixed(6), 6);
  
  if (balance < amountWei) {
    throw new Error(`Insufficient balance: wallet has ${ethers.utils.formatUnits(balance, 6)} USDC, need ${totalPending} USDC`);
  }
  
  // Sign and send transaction
  const contractWithSigner = usdcContract.connect(wallet);
  
  try {
    // Manual gas limit for Base (cheap transactions)
    const tx = await contractWithSigner.transfer(X402_CONFIG.paymentWallet, amountWei, {
      gasLimit: 100000
    });
    const receipt = await tx.wait();
    
    // Mark pending payments as batched
    await db.query(`
      UPDATE x402_pending_payments
      SET batched_at = NOW(), batch_tx_hash = $1
      WHERE customer_id = $2 AND network = $3 AND batched_at IS NULL
    `, [receipt.hash, customerId, network]);
    
    // Log batched payment
    await db.query(`
      INSERT INTO x402_batched_payments 
      (customer_id, batch_tx_hash, network, total_amount_usdc, payment_count, from_wallet, to_wallet, status, confirmations, confirmed_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'confirmed', $8, NOW())
    `, [
      customerId,
      receipt.hash,
      network,
      totalPending,
      pendingResult.rows.length,
      fromWallet,
      X402_CONFIG.paymentWallet,
      receipt.confirmations || 1
    ]);
    
    return {
      batched: true,
      txHash: receipt.hash,
      amount: totalPending,
      count: pendingResult.rows.length,
      confirmations: receipt.confirmations || 1
    };
  } catch (error) {
    console.error('Error batching payment:', error);
    throw error;
  }
}

// Create customer
async function createCustomer(email, name, company, stripeCustomerId = null, passwordHash = null) {
  const db = getPool();
  const query = `
    INSERT INTO customers (email, name, company, stripe_customer_id, password_hash)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, email, name, company, stripe_customer_id, created_at
  `;
  const result = await db.query(query, [email, name, company, stripeCustomerId, passwordHash]);
  return result.rows[0];
}

// Create API key for customer
async function createApiKey(customerId) {
  const db = getPool();
  const apiKey = generateApiKey();
  const query = `
    INSERT INTO api_keys (customer_id, api_key, name)
    VALUES ($1, $2, $3)
    RETURNING id, api_key, name, created_at
  `;
  const result = await db.query(query, [customerId, apiKey, 'Default Key']);
  return result.rows[0];
}

// Main handler
module.exports = async (req, res) => {
  // CORS headers - MUST be set first, before any other response
  const corsOrigin = getCorsOrigin(req);

  // Handle OPTIONS (preflight) requests FIRST - return immediately with CORS headers
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, X-Payment-Proof, X-Payment-Network, X-Agent-Id, X-Agent-Metadata, Authorization, Payment-Signature, X-Payment');
    res.setHeader('Access-Control-Max-Age', '86400'); // Cache preflight for 24 hours
    res.setHeader('Vary', 'Origin');
    return res.status(204).end(); // 204 No Content for OPTIONS
  }

  // Set CORS headers for all other requests
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, X-Payment-Proof, X-Payment-Network, X-Agent-Id, X-Agent-Metadata, Authorization, Payment-Signature, X-Payment');
  res.setHeader('Access-Control-Max-Age', '86400'); // Cache preflight for 24 hours
  res.setHeader('Access-Control-Expose-Headers', 'X-Payment-Required, X-Price-Amount, X-Price-Currency, X-Accepted-Networks, X-Payment-Wallet, X-RateLimit-Remaining, PAYMENT-REQUIRED, PAYMENT-RESPONSE');
  res.setHeader('Vary', 'Origin');

  const url = req.url || '/';
  const method = req.method;
  
  // Parse query parameters from URL
  const urlParts = url.split('?');
  const path = urlParts[0];
  const queryString = urlParts[1] || '';
  const queryParams = {};
  if (queryString) {
    queryString.split('&').forEach(pair => {
      const [key, value] = pair.split('=');
      if (key) {
        queryParams[decodeURIComponent(key)] = decodeURIComponent(value || '');
      }
    });
  }
  req.query = req.query || queryParams; // Use existing req.query if available, otherwise use parsed

  try {
    // Debug endpoint (remove in production)
    if (url === '/api/debug/env' && method === 'GET') {
      const hasNewKey = !!process.env.NEW_REACTIVE_PRIVATE_KEY;
      const hasOldKey = !!process.env.REACTIVE_PRIVATE_KEY;
      const newKeyLength = process.env.NEW_REACTIVE_PRIVATE_KEY ? process.env.NEW_REACTIVE_PRIVATE_KEY.trim().length : 0;
      const oldKeyLength = process.env.REACTIVE_PRIVATE_KEY ? process.env.REACTIVE_PRIVATE_KEY.trim().length : 0;
      const newKeyPrefix = process.env.NEW_REACTIVE_PRIVATE_KEY ? process.env.NEW_REACTIVE_PRIVATE_KEY.trim().substring(0, 4) : 'N/A';
      const oldKeyPrefix = process.env.REACTIVE_PRIVATE_KEY ? process.env.REACTIVE_PRIVATE_KEY.trim().substring(0, 4) : 'N/A';
      
      return res.status(200).json({
        hasNewKey,
        hasOldKey,
        newKeyLength,
        oldKeyLength,
        newKeyPrefix,
        oldKeyPrefix,
        reactiveRpc: process.env.REACTIVE_RPC || 'not set'
      });
    }
    
    // Health check
    if (url === '/' || url === '/api') {
      return res.status(200).json({
        status: 'ok',
        service: 'Defeyes API',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        x402: {
          enabled: true,
          networks: Object.keys(X402_CONFIG.networks),
          pricingEndpoint: '/api/x402/pricing'
        }
      });
    }

    // =========================================================================
    // AGENT DISCOVERY ENDPOINTS
    // =========================================================================

    // .well-known/x402.json - Standard x402 service discovery for AI agents and crawlers
    if (url === '/.well-known/x402.json' || url === '/api/.well-known/x402.json') {
      return res.status(200).json({
        x402Version: 2,
        service: {
          name: 'DefEyes',
          description: 'Real-time enriched DeFi transaction data. Covers Aave V3, lending, swaps, liquidations, and yield strategies on Arbitrum. Every event is enriched with token metadata, USD values, APY rates, and protocol classification.',
          url: 'https://defeyes-api.vercel.app',
          documentationUrl: 'https://defeyes.com/api-docs.html',
          openApiSpec: 'https://defeyes-api.vercel.app/openapi.json',
          termsOfService: 'https://defeyes.com/terms.html',
          logo: 'https://defeyes.com/logo.png'
        },
        payTo: X402_CONFIG.paymentWallet,
        networks: [{
          network: 'eip155:8453',
          name: 'Base',
          currency: 'USDC',
          contract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
        }],
        endpoints: [
          {
            path: '/api/events',
            method: 'GET',
            description: 'Query enriched DeFi events with filtering, pagination, and time ranges. Returns token metadata, USD values, APY, and protocol classification.',
            scheme: 'exact',
            price: '$0.001',
            parameters: ['limit', 'offset', 'time_range', 'protocol', 'action_type', 'wallet']
          },
          {
            path: '/api/stats',
            method: 'GET',
            description: 'Aggregate statistics: total events, unique wallets, protocol breakdown, and volume data.',
            scheme: 'exact',
            price: '$0.0005'
          },
          {
            path: '/api/events/export',
            method: 'GET',
            description: 'Bulk export events as CSV or JSON.',
            scheme: 'exact',
            price: '$0.01',
            parameters: ['format', 'limit']
          },
          {
            path: '/api/wallet/persona',
            method: 'GET',
            description: 'AI-generated wallet persona: behavior patterns, risk profile, strategy classification, and activity summary.',
            scheme: 'exact',
            price: '$0.001',
            parameters: ['address']
          }
        ],
        freeEndpoints: [
          { path: '/api/health', description: 'Service health, event listener status, and database freshness' },
          { path: '/api/x402/pricing', description: 'Full pricing table and accepted networks' },
          { path: '/openapi.json', description: 'OpenAPI 3.1 specification' }
        ],
        extensions: {
          bazaar: {
            discoverable: true,
            category: 'defi-data',
            tags: ['DeFi', 'Arbitrum', 'Aave', 'lending', 'swaps', 'liquidations', 'yield', 'transactions', 'enriched-data', 'real-time']
          }
        }
      });
    }

    // OpenAPI 3.1 specification - machine-readable API docs for LLM function calling
    if (url === '/openapi.json' || url === '/api/openapi.json') {
      return res.status(200).json({
        openapi: '3.1.0',
        info: {
          title: 'DefEyes API',
          version: '2.0.0',
          description: 'Real-time enriched DeFi transaction data API. Covers Aave V3, lending protocols, swaps, liquidations, and yield strategies on Arbitrum. Supports x402 micropayments in USDC for pay-per-request access.',
          contact: { url: 'https://defeyes.com' },
          'x-logo': { url: 'https://defeyes.com/logo.png' }
        },
        servers: [{ url: 'https://defeyes-api.vercel.app', description: 'Production' }],
        'x-x402': {
          version: 2,
          payTo: X402_CONFIG.paymentWallet,
          network: 'eip155:8453',
          currency: 'USDC'
        },
        paths: {
          '/api/events': {
            get: {
              operationId: 'getEvents',
              summary: 'Query enriched DeFi events',
              description: 'Returns enriched DeFi transaction events with token metadata, USD values, APY rates, protocol classification, and lego detection. Supports filtering by time range, protocol, action type, and wallet address.',
              'x-x402-price': '$0.001',
              parameters: [
                { name: 'limit', in: 'query', schema: { type: 'integer', default: 100, maximum: 1000 }, description: 'Number of events to return' },
                { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 }, description: 'Pagination offset' },
                { name: 'time_range', in: 'query', schema: { type: 'string', enum: ['5m','1h','24h','7d','30d','all'], default: '24h' }, description: 'Time window for events' },
                { name: 'protocol', in: 'query', schema: { type: 'string' }, description: 'Filter by protocol (e.g. aave-v3, uniswap)' },
                { name: 'action_type', in: 'query', schema: { type: 'string', enum: ['supply','borrow','repay','withdraw','swap','liquidation','flash_loan'] }, description: 'Filter by action type' },
                { name: 'wallet', in: 'query', schema: { type: 'string' }, description: 'Filter by wallet address (requires authentication)' }
              ],
              responses: {
                '200': {
                  description: 'Enriched event data',
                  content: { 'application/json': { schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      count: { type: 'integer', description: 'Number of events returned' },
                      tier: { type: 'string', enum: ['public','free','developer','pro'], description: 'Access tier of the requester' },
                      events: { type: 'array', items: { '$ref': '#/components/schemas/EnrichedEvent' } },
                      pagination: { type: 'object', properties: {
                        limit: { type: 'integer' }, offset: { type: 'integer' }, total: { type: 'integer' },
                        has_more: { type: 'boolean' }, total_pages: { type: 'integer' }
                      }}
                    }
                  }}}
                },
                '402': { description: 'Payment required. Includes PAYMENT-REQUIRED header with x402 v2 payment instructions.' }
              }
            }
          },
          '/api/stats': {
            get: {
              operationId: 'getStats',
              summary: 'Aggregate DeFi statistics',
              description: 'Returns aggregate statistics including total events, unique wallets, protocol breakdown, volume data, and trend metrics.',
              'x-x402-price': '$0.0005',
              parameters: [
                { name: 'time_range', in: 'query', schema: { type: 'string', enum: ['1h','24h','7d','30d','all'], default: '24h' }, description: 'Time window' }
              ],
              responses: {
                '200': { description: 'Aggregate statistics', content: { 'application/json': { schema: { type: 'object' } } } },
                '402': { description: 'Payment required' }
              }
            }
          },
          '/api/wallet/persona': {
            get: {
              operationId: 'getWalletPersona',
              summary: 'AI-generated wallet persona',
              description: 'Returns an AI-generated behavioral analysis of a wallet: strategy classification, risk profile, activity patterns, and DeFi protocol usage.',
              'x-x402-price': '$0.001',
              parameters: [
                { name: 'address', in: 'query', required: true, schema: { type: 'string' }, description: 'Ethereum wallet address to analyze' }
              ],
              responses: {
                '200': { description: 'Wallet persona analysis', content: { 'application/json': { schema: { type: 'object' } } } },
                '402': { description: 'Payment required' }
              }
            }
          },
          '/api/health': {
            get: {
              operationId: 'getHealth',
              summary: 'Service health check',
              description: 'Returns event listener status, database freshness, and event throughput. Free endpoint - no payment required.',
              responses: {
                '200': { description: 'Health status', content: { 'application/json': { schema: { type: 'object', properties: {
                  status: { type: 'string', enum: ['healthy','degraded','down'] },
                  event_listener: { type: 'object' },
                  database: { type: 'object' },
                  server_time: { type: 'string', format: 'date-time' }
                }}}}}
              }
            }
          },
          '/api/x402/pricing': {
            get: {
              operationId: 'getPricing',
              summary: 'x402 pricing information',
              description: 'Returns accepted payment methods, wallet address, supported networks, and per-endpoint pricing. Free endpoint.',
              responses: {
                '200': { description: 'Pricing info', content: { 'application/json': { schema: { type: 'object' } } } }
              }
            }
          },
          '/api/x402/quote': {
            post: {
              operationId: 'getQuote',
              summary: 'Get exact price quote',
              description: 'Returns the exact USDC price for a specific request including any metered pricing adjustments. Recommended for agents before making payment.',
              requestBody: { content: { 'application/json': { schema: { type: 'object', properties: {
                endpoint: { type: 'string', description: 'Target endpoint path' },
                params: { type: 'object', description: 'Query parameters that affect pricing (time_range, limit, etc.)' }
              }, required: ['endpoint'] }}}},
              responses: {
                '200': { description: 'Price quote', content: { 'application/json': { schema: { type: 'object', properties: {
                  endpoint: { type: 'string' }, price: { type: 'number' }, currency: { type: 'string' },
                  confirmations: { type: 'integer' }, wallet: { type: 'string' }
                }}}}}
              }
            }
          }
        },
        components: {
          schemas: {
            EnrichedEvent: {
              type: 'object',
              description: 'A DeFi transaction event enriched with token metadata, USD values, and protocol classification.',
              properties: {
                id: { type: 'integer' },
                tx_hash: { type: 'string', description: 'Arbitrum transaction hash' },
                block_number: { type: 'integer' },
                event_timestamp: { type: 'string', format: 'date-time' },
                protocol: { type: 'string', description: 'DeFi protocol name (e.g. aave-v3)' },
                action_type: { type: 'string', description: 'Transaction type: supply, borrow, repay, withdraw, swap, liquidation, flash_loan' },
                wallet_address: { type: 'string' },
                token_symbol: { type: 'string', description: 'Primary token symbol' },
                token_amount: { type: 'string', description: 'Token amount in human-readable units' },
                usd_value: { type: 'number', description: 'Estimated USD value at time of transaction' },
                apy: { type: 'number', description: 'Annual percentage yield (if applicable)' },
                lego_type: { type: 'string', description: 'DeFi lego classification (e.g. lending, dex, yield)' },
                full_data: { type: 'object', description: 'Complete enrichment data including all extracted fields' }
              }
            }
          },
          securitySchemes: {
            apiKey: { type: 'apiKey', in: 'header', name: 'X-API-Key', description: 'API key for authenticated access (subscription plans)' },
            x402: { type: 'apiKey', in: 'header', name: 'Payment-Signature', description: 'x402 v2 signed payment authorization (Coinbase SDK)' },
            x402Legacy: { type: 'apiKey', in: 'header', name: 'X-Payment-Proof', description: 'Legacy x402 on-chain payment proof (transaction hash)' }
          }
        }
      });
    }

    // =========================================================================
    // X402 ENDPOINTS
    // =========================================================================
    
    // Get X402 pricing info
    if (url === '/api/x402/pricing' && method === 'GET') {
      return res.status(200).json({
        currency: 'USDC',
        wallet: X402_CONFIG.paymentWallet,
        networks: Object.entries(X402_CONFIG.networks).map(([key, net]) => ({
          id: key,
          name: net.name,
          chainId: net.chainId,
          usdcContract: net.usdc,
          blockExplorer: net.blockExplorer
        })),
        pricing: X402_CONFIG.pricing,
        meteredPricing: {
          note: 'Some endpoints have metered (dynamic) pricing based on request parameters. Agents should call /api/x402/quote to get an exact price before paying.',
          quoteEndpoint: '/api/x402/quote',
          rules: {
            '/api/events': {
              time_range: {
                base: '24h',
                options: ['5m', '1h', '24h', '7d', 'all'],
                premium: {
                  '5m': 0.005,
                  '1h': 0.003,
                  '24h+': 0.001
                }
              },
              limitSurcharges: [
                { minExclusive: 100, maxInclusive: 500, add: 0.002 },
                { minExclusive: 500, maxInclusive: 1000, add: 0.01 }
              ]
            },
            '/api/events/export': {
              note: 'Small exports are free samples. Larger exports are metered and require payment.',
              freeSample: { maxLimit: 100, price: 0 },
              paidTiers: [
                { min: 101, max: 200, price: 0.01 },
                { min: 201, max: 500, price: 0.02 }
              ],
              limitMax: 500
            }
          }
        },
        instructions: {
          step1: 'Make request to desired endpoint',
          step2: 'If 402 returned, note the price (or call /api/x402/quote for an exact quote)',
          step3: 'Send USDC to the payment wallet',
          step4: 'Retry request with X-Payment-Proof (tx hash) and X-Payment-Network headers'
        }
      });
    }

    // Get an exact X402 quote for a specific request (recommended for agents)
    if (url === '/api/x402/quote' && method === 'POST') {
      const { endpoint, url: fullUrl, params } = req.body || {};
      const targetEndpoint = (endpoint || '').trim();

      if (!targetEndpoint || !targetEndpoint.startsWith('/')) {
        return res.status(400).json({ error: 'endpoint is required (e.g., "/api/events")' });
      }

      // Build a URL with params for deterministic pricing
      let quoteUrl = fullUrl;
      if (!quoteUrl) {
        const u = new URL(targetEndpoint, 'http://localhost');
        if (params && typeof params === 'object') {
          for (const [k, v] of Object.entries(params)) {
            if (v === undefined || v === null || v === '') continue;
            u.searchParams.set(String(k), String(v));
          }
        }
        quoteUrl = u.pathname + (u.search ? u.search : '');
      }

      const price = computeRequestPrice({ endpoint: targetEndpoint, url: quoteUrl });
      const requiredConfirmations = X402_CONFIG.confirmations[targetEndpoint] || X402_CONFIG.confirmations.default;

      return res.status(200).json({
        endpoint: targetEndpoint,
        url: quoteUrl,
        price,
        currency: 'USDC',
        wallet: X402_CONFIG.paymentWallet,
        networks: Object.entries(X402_CONFIG.networks).map(([key, net]) => ({
          id: key,
          name: net.name,
          chainId: net.chainId,
          usdcContract: net.usdc,
          blockExplorer: net.blockExplorer
        })),
        requiredConfirmations,
        payThenRetry: {
          headers: {
            'X-Payment-Proof': '<tx_hash>',
            'X-Payment-Network': '<base|arbitrum>'
          }
        }
      });
    }

    // =========================================================================
    // X402 CREDIT BALANCE ENDPOINTS
    // =========================================================================
    
    // Get user's USDC balance
    if (url === '/api/x402/balance' && method === 'GET') {
      const apiKey = req.headers['x-api-key'];
      if (!apiKey) {
        return res.status(401).json({ error: 'API key required' });
      }
      
      const db = getPool();
      const customerQuery = `
        SELECT c.id, c.email, COALESCE(c.usdc_balance, 0) as balance, c.linked_wallet
        FROM customers c
        JOIN api_keys ak ON ak.customer_id = c.id
        WHERE ak.api_key = $1 AND ak.is_active = true
      `;
      const result = await db.query(customerQuery, [apiKey]);
      
      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid API key' });
      }
      
      const customer = result.rows[0];
      
      // Get deposit and usage history
      const depositsResult = await db.query(`
        SELECT amount_usdc, status, created_at, tx_hash, network
        FROM x402_deposits
        WHERE customer_id = $1
        ORDER BY created_at DESC
        LIMIT 10
      `, [customer.id]);
      
      const usageResult = await db.query(`
        SELECT SUM(amount_deducted) as total_spent, COUNT(*) as request_count
        FROM x402_credits_usage
        WHERE customer_id = $1
      `, [customer.id]);
      
      return res.status(200).json({
        balance: parseFloat(customer.balance),
        linkedWallet: customer.linked_wallet,
        deposits: depositsResult.rows,
        usage: {
          totalSpent: parseFloat(usageResult.rows[0]?.total_spent || 0),
          requestCount: parseInt(usageResult.rows[0]?.request_count || 0)
        },
        paymentWallet: X402_CONFIG.paymentWallet,
        supportedNetworks: Object.keys(X402_CONFIG.networks)
      });
    }
    
    // Link wallet address for deposits
    if (url === '/api/x402/link-wallet' && method === 'POST') {
      const apiKey = req.headers['x-api-key'];
      const { walletAddress } = req.body || {};
      
      if (!apiKey) {
        return res.status(401).json({ error: 'API key required' });
      }
      
      if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
        return res.status(400).json({ error: 'Valid wallet address required' });
      }
      
      const db = getPool();
      const customerQuery = `
        SELECT c.id FROM customers c
        JOIN api_keys ak ON ak.customer_id = c.id
        WHERE ak.api_key = $1 AND ak.is_active = true
      `;
      const result = await db.query(customerQuery, [apiKey]);
      
      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid API key' });
      }
      
      await db.query('UPDATE customers SET linked_wallet = $1 WHERE id = $2', [walletAddress, result.rows[0].id]);
      
      return res.status(200).json({
        success: true,
        message: 'Wallet linked successfully',
        walletAddress,
        paymentWallet: X402_CONFIG.paymentWallet,
        note: 'Send USDC deposits to your linked wallet or to the payment wallet'
      });
    }
    
    // Verify and credit a deposit
    if (url === '/api/x402/deposit/verify' && method === 'POST') {
      const apiKey = req.headers['x-api-key'];
      const { txHash, network } = req.body || {};
      
      if (!apiKey || !txHash || !network) {
        return res.status(400).json({ error: 'API key, txHash, and network required' });
      }
      
      const db = getPool();
      const customerQuery = `
        SELECT c.id, c.linked_wallet FROM customers c
        JOIN api_keys ak ON ak.customer_id = c.id
        WHERE ak.api_key = $1 AND ak.is_active = true
      `;
      const result = await db.query(customerQuery, [apiKey]);
      
      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid API key' });
      }
      
      const customer = result.rows[0];
      
      // Check if deposit already processed
      const existingDeposit = await db.query('SELECT id, status FROM x402_deposits WHERE tx_hash = $1', [txHash]);
      if (existingDeposit.rows.length > 0) {
        if (existingDeposit.rows[0].status === 'confirmed') {
          return res.status(200).json({ message: 'Deposit already processed', status: 'confirmed' });
        }
      }
      
      // Verify transaction
      const networkConfig = X402_CONFIG.networks[network];
      const provider = new ethers.providers.JsonRpcProvider(networkConfig.rpc);
      const receipt = await provider.getTransactionReceipt(txHash);
      
      if (!receipt || receipt.status !== 1) {
        return res.status(400).json({ error: 'Transaction not found or failed' });
      }
      
      // Check confirmations (require 3 for deposits - higher value)
      const currentBlock = await provider.getBlockNumber();
      const confirmations = currentBlock - receipt.blockNumber;
      if (confirmations < 3) {
        return res.status(400).json({
          error: 'Insufficient confirmations',
          confirmations,
          required: 3,
          message: 'Please wait for 3 block confirmations'
        });
      }
      
      // Parse USDC transfer
      const usdcContract = new ethers.Contract(networkConfig.usdc, USDC_ABI, provider);
      const transferLogs = receipt.logs
        .filter(log => log.address.toLowerCase() === networkConfig.usdc.toLowerCase())
        .map(log => {
          try {
            return usdcContract.interface.parseLog({ topics: log.topics, data: log.data });
          } catch {
            return null;
          }
        })
        .filter(Boolean);
      
      // Find transfer from linked wallet (or payment wallet if no linked wallet)
      const targetWallet = customer.linked_wallet || X402_CONFIG.paymentWallet;
      const validTransfer = transferLogs.find(log => 
        log.name === 'Transfer' && 
        (log.args.from.toLowerCase() === targetWallet.toLowerCase() ||
         log.args.to.toLowerCase() === X402_CONFIG.paymentWallet.toLowerCase())
      );
      
      if (!validTransfer) {
        return res.status(400).json({ error: 'No valid USDC transfer found in transaction' });
      }
      
      // Get deposit amount (must be from user's wallet to payment wallet)
      const fromWallet = validTransfer.args.from.toLowerCase();
      const toWallet = validTransfer.args.to.toLowerCase();
      
      if (toWallet !== X402_CONFIG.paymentWallet.toLowerCase()) {
        return res.status(400).json({ error: 'Transfer must be to payment wallet' });
      }
      
      // Allow deposits from linked wallet OR any wallet if no linked wallet
      if (customer.linked_wallet && fromWallet !== customer.linked_wallet.toLowerCase()) {
        return res.status(400).json({ error: 'Transfer must be from your linked wallet' });
      }
      
      const amountUsdc = Number(validTransfer.args.value) / 1e6;
      
      // Credit the account
      if (existingDeposit.rows.length === 0) {
        await db.query(`
          INSERT INTO x402_deposits (customer_id, tx_hash, network, amount_usdc, from_wallet, confirmations, status, verified_at)
          VALUES ($1, $2, $3, $4, $5, $6, 'confirmed', NOW())
        `, [customer.id, txHash, network, amountUsdc, fromWallet, confirmations]);
      } else {
        await db.query(`
          UPDATE x402_deposits 
          SET status = 'confirmed', verified_at = NOW(), confirmations = $1
          WHERE tx_hash = $2
        `, [confirmations, txHash]);
      }
      
      await db.query(`
        UPDATE customers 
        SET usdc_balance = COALESCE(usdc_balance, 0) + $1 
        WHERE id = $2
      `, [amountUsdc, customer.id]);
      
      const balanceResult = await db.query('SELECT usdc_balance FROM customers WHERE id = $1', [customer.id]);
      const newBalance = parseFloat(balanceResult.rows[0].usdc_balance);
      
      return res.status(200).json({
        success: true,
        message: 'Deposit credited successfully',
        amount: amountUsdc,
        newBalance: newBalance,
        txHash,
        confirmations
      });
    }
    
    // =========================================================================
    // X402 PAY-PER-GO ENDPOINTS
    // =========================================================================
    
    // Enable pay-per-go and generate wallet
    if (url === '/api/x402/paypergo/enable' && method === 'POST') {
      try {
        const apiKey = req.headers['x-api-key'];
        if (!apiKey) {
          return res.status(401).json({ error: 'API key required' });
        }
        
        const db = getPool();
        const customerQuery = `
          SELECT c.id FROM customers c
          JOIN api_keys ak ON ak.customer_id = c.id
          WHERE ak.api_key = $1 AND ak.is_active = true
        `;
        const result = await db.query(customerQuery, [apiKey]);
        
        if (result.rows.length === 0) {
          return res.status(401).json({ error: 'Invalid API key' });
        }
        
        const customerId = result.rows[0].id;
        
        // Check if already enabled
        const existingQuery = await db.query(`
          SELECT x402_enabled, x402_wallet_address FROM customers WHERE id = $1
        `, [customerId]);
        
        if (existingQuery.rows[0]?.x402_enabled && existingQuery.rows[0]?.x402_wallet_address) {
          return res.status(200).json({
            success: true,
            message: 'Pay-per-go already enabled',
            walletAddress: existingQuery.rows[0].x402_wallet_address,
            enabled: true
          });
        }
        
        // Generate wallet
        const wallet = generateCustomerWallet(customerId);
        const encryptedKey = encryptPrivateKey(wallet.privateKey);
        
        // Save to database
        await db.query(`
          UPDATE customers 
          SET x402_enabled = TRUE,
              x402_wallet_address = $1,
              x402_wallet_encrypted_key = $2
          WHERE id = $3
        `, [wallet.address, JSON.stringify(encryptedKey), customerId]);
        
        // No pre-funding gas at signup — gas is funded on-demand when deposit is detected
        let gasFunded = false;
        let gasFundingError = null;
        console.log(`Wallet created: ${wallet.address} (gas will be funded on first deposit)`);
        
        return res.status(200).json({
          success: true,
          message: 'Wallet generated successfully!',
          walletAddress: wallet.address,
          enabled: true,
          gasFunded: gasFunded,
          instructions: {
            step1: `Send USDC to ${wallet.address} on Base Network`,
            step2: 'USDC is automatically converted to credits within 30 seconds',
            step3: 'Each API call uses 1 credit ($0.001 per call)',
            rate: '1,000 credits per $1 USDC'
          }
        });
      } catch (error) {
        console.error('Error enabling pay-per-go:', error);
        return res.status(500).json({ 
          error: 'Failed to enable pay-per-go',
          message: error.message,
          details: 'If wallet was created, refresh to see it. Contact support if issue persists.'
        });
      }
    }
    
    // Get pay-per-go status
    if (url === '/api/x402/paypergo/status' && method === 'GET') {
      try {
        const apiKey = req.headers['x-api-key'];
        if (!apiKey) {
          return res.status(401).json({ error: 'API key required' });
        }
        
        const db = getPool();
        const customerQuery = `
          SELECT c.id, c.x402_enabled, c.x402_wallet_address
          FROM customers c
          JOIN api_keys ak ON ak.customer_id = c.id
          WHERE ak.api_key = $1 AND ak.is_active = true
        `;
        const result = await db.query(customerQuery, [apiKey]);
        
        if (result.rows.length === 0) {
          return res.status(401).json({ error: 'Invalid API key' });
        }
        
        const customer = result.rows[0];
        
        // Get pending payments
        const pendingResult = await db.query(`
          SELECT network, COUNT(*) as count, SUM(amount_usdc) as total
          FROM x402_pending_payments
          WHERE customer_id = $1 AND batched_at IS NULL
          GROUP BY network
        `, [customer.id]);
        
        // Get batched payments
        const batchedResult = await db.query(`
          SELECT COUNT(*) as count, SUM(total_amount_usdc) as total
          FROM x402_batched_payments
          WHERE customer_id = $1 AND status = 'confirmed'
        `, [customer.id]);
        
        return res.status(200).json({
          enabled: customer.x402_enabled || false,
          walletAddress: customer.x402_wallet_address || null,
          pending: pendingResult.rows.map(r => ({
            network: r.network,
            count: parseInt(r.count),
            amount: parseFloat(r.total || 0)
          })),
          batched: {
            count: parseInt(batchedResult.rows[0]?.count || 0),
            total: parseFloat(batchedResult.rows[0]?.total || 0)
          },
          batchThreshold: BATCH_THRESHOLD,
          paymentWallet: X402_CONFIG.paymentWallet
        });
      } catch (error) {
        console.error('Error fetching pay-per-go status:', error);
        return res.status(500).json({ 
          error: 'Failed to fetch pay-per-go status',
          message: error.message 
        });
      }
    }
    
    // Verify DIRECT credit purchase (user sends USDC to platform wallet, submits tx hash)
    if (url === '/api/x402/prepaid/buy' && method === 'POST') {
      const apiKey = req.headers['x-api-key'];
      const { txHash, network = 'base' } = req.body || {};
      
      if (!apiKey || !txHash) {
        return res.status(400).json({ error: 'API key and txHash required' });
      }
      
      const db = getPool();
      const customerQuery = `
        SELECT c.id FROM customers c
        JOIN api_keys ak ON ak.customer_id = c.id
        WHERE ak.api_key = $1 AND ak.is_active = true
      `;
      const result = await db.query(customerQuery, [apiKey]);
      
      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid API key' });
      }
      
      try {
        const verification = await verifyDirectCreditPurchase(result.rows[0].id, txHash, network);
        return res.status(200).json({
          success: true,
          message: verification.alreadyProcessed ? 'Payment already processed' : 'Credits added successfully!',
          amount: verification.amount,
          creditsGranted: verification.creditsGranted,
          newBalance: verification.newCredits
        });
      } catch (error) {
        return res.status(400).json({
          error: 'Payment verification failed',
          message: error.message
        });
      }
    }
    
    // Link wallet address for automatic deposit detection
    if (url === '/api/x402/prepaid/link-wallet' && method === 'POST') {
      const apiKey = req.headers['x-api-key'];
      const { walletAddress } = req.body || {};
      
      if (!apiKey || !walletAddress) {
        return res.status(400).json({ error: 'API key and walletAddress required' });
      }
      
      // Validate wallet address format
      if (!walletAddress.startsWith('0x') || walletAddress.length !== 42) {
        return res.status(400).json({ error: 'Invalid wallet address format' });
      }
      
      const db = getPool();
      const customerQuery = `
        SELECT c.id FROM customers c
        JOIN api_keys ak ON ak.customer_id = c.id
        WHERE ak.api_key = $1 AND ak.is_active = true
      `;
      const result = await db.query(customerQuery, [apiKey]);
      
      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid API key' });
      }
      
      try {
        // Update customer's linked wallet
        await db.query(`
          UPDATE customers 
          SET x402_linked_wallet = $1
          WHERE id = $2
        `, [walletAddress.toLowerCase(), result.rows[0].id]);
        
        return res.status(200).json({
          success: true,
          message: 'Wallet linked successfully',
          walletAddress: walletAddress.toLowerCase()
        });
      } catch (error) {
        return res.status(500).json({
          error: 'Failed to link wallet',
          message: error.message
        });
      }
    }
    
    // Get prepaid status (with wallet balance) - AUTO-CONVERTS USDC TO CREDITS
    if (url === '/api/x402/prepaid/status' && method === 'GET') {
      try {
        const apiKey = req.headers['x-api-key'];
        if (!apiKey) {
          return res.status(401).json({ error: 'API key required' });
        }
        
        const db = getPool();
        const customerQuery = `
          SELECT c.id, c.x402_enabled, c.x402_wallet_address, COALESCE(c.x402_prepaid_credits, 0) as credits
          FROM customers c
          JOIN api_keys ak ON ak.customer_id = c.id
          WHERE ak.api_key = $1 AND ak.is_active = true
        `;
        const result = await db.query(customerQuery, [apiKey]);
        
        if (result.rows.length === 0) {
          return res.status(401).json({ error: 'Invalid API key' });
        }
        
        const customer = result.rows[0];
      
      // Get wallet balance on-chain across ALL networks and AUTO-CONVERT if USDC is present
      let walletBalance = 0;
      let balanceByNetwork = {};
      let autoConverted = false;
      let autoConvertResults = [];
      
      if (customer.x402_enabled && customer.x402_wallet_address) {
        // Check all supported networks in parallel
        const networkChecks = Object.entries(X402_CONFIG.networks).map(async ([networkKey, networkConfig]) => {
          try {
            const provider = new ethers.providers.JsonRpcProvider(networkConfig.rpc);
            const usdcContract = new ethers.Contract(networkConfig.usdc, [
              'function balanceOf(address account) view returns (uint256)'
            ], provider);
            const balance = await usdcContract.balanceOf(customer.x402_wallet_address);
            const balanceUsdc = Number(ethers.utils.formatUnits(balance, 6));
            return { network: networkKey, name: networkConfig.name, balance: balanceUsdc };
          } catch (error) {
            console.error(`Error checking ${networkKey} balance:`, error.message);
            return { network: networkKey, name: networkConfig.name, balance: 0, error: error.message };
          }
        });
        
        const networkResults = await Promise.all(networkChecks);
        
        for (const nr of networkResults) {
          balanceByNetwork[nr.network] = nr.balance;
          walletBalance += nr.balance;
        }
        
        // AUTO-CONVERT: Try to convert USDC on each network that has a balance
        for (const nr of networkResults) {
          if (nr.balance >= PREPAID_CONFIG.chargeAmount) {
            try {
              const result = await autoGrantCreditsFromWallet(customer.id, nr.network);
              if (result.granted) {
                autoConverted = true;
                autoConvertResults.push({ network: nr.network, ...result });
              }
            } catch (error) {
              console.error(`Error auto-converting USDC on ${nr.network}:`, error.message);
            }
          }
        }
        
        // Re-fetch credits and balances after any conversions
        if (autoConverted) {
          const newCreditsResult = await db.query('SELECT x402_prepaid_credits FROM customers WHERE id = $1', [customer.id]);
          customer.credits = parseInt(newCreditsResult.rows[0]?.x402_prepaid_credits || 0);
          
          // Re-check balances
          walletBalance = 0;
          for (const [networkKey, networkConfig] of Object.entries(X402_CONFIG.networks)) {
            try {
              const provider = new ethers.providers.JsonRpcProvider(networkConfig.rpc);
              const usdcContract = new ethers.Contract(networkConfig.usdc, [
                'function balanceOf(address account) view returns (uint256)'
              ], provider);
              const newBalance = await usdcContract.balanceOf(customer.x402_wallet_address);
              balanceByNetwork[networkKey] = Number(ethers.utils.formatUnits(newBalance, 6));
              walletBalance += balanceByNetwork[networkKey];
            } catch (e) {}
          }
        }
      }
      
      // Check for pending sweeps (USDC credited but not yet moved to platform wallet)
      const pendingSweepResult = await db.query(
        "SELECT COUNT(*) as cnt FROM x402_prepaid_payments WHERE customer_id = $1 AND status = 'pending_sweep'",
        [customer.id]
      );
      const hasPendingSweep = parseInt(pendingSweepResult.rows[0]?.cnt || 0) > 0;
      
      // Get payment history
      const paymentsResult = await db.query(`
        SELECT tx_hash, amount_usdc, credits_granted, status, created_at, network
        FROM x402_prepaid_payments
        WHERE customer_id = $1
        ORDER BY created_at DESC
        LIMIT 10
      `, [customer.id]);
      
      // Get usage stats
      const usageResult = await db.query(`
        SELECT COUNT(*) as total_calls, SUM(credits_used) as total_credits_used
        FROM x402_prepaid_usage
        WHERE customer_id = $1
      `, [customer.id]);
      
      // Get usage history (last 10 transactions)
      const usageHistoryResult = await db.query(`
        SELECT endpoint, credits_used, credits_before, credits_after, created_at
        FROM x402_prepaid_usage
        WHERE customer_id = $1
        ORDER BY created_at DESC
        LIMIT 10
      `, [customer.id]);
      
      // Build auto-convert summary
      const totalAutoConverted = autoConvertResults.reduce((sum, r) => sum + (r.amount || 0), 0);
      const totalCreditsGranted = autoConvertResults.reduce((sum, r) => sum + (r.creditsGranted || 0), 0);
      
      return res.status(200).json({
        enabled: customer.x402_enabled || false,
        walletAddress: customer.x402_wallet_address || null,
        walletBalance: walletBalance,
        hasPendingSweep: hasPendingSweep,
        balanceByNetwork: balanceByNetwork,
        credits: parseInt(customer.credits),
        autoConverted: autoConverted,
        autoConvertDetails: autoConvertResults.length > 0 ? autoConvertResults.map(r => ({
          network: r.network,
          creditsGranted: r.creditsGranted,
          amountConverted: r.amount,
          txHash: r.txHash
        })) : null,
        config: {
          chargeAmount: PREPAID_CONFIG.chargeAmount,
          creditsPerPayment: PREPAID_CONFIG.callsPerPayment,
          pricePerCall: PREPAID_CONFIG.pricePerCall
        },
        payments: paymentsResult.rows.map(p => ({
          txHash: p.tx_hash,
          amount: parseFloat(p.amount_usdc),
          creditsGranted: parseInt(p.credits_granted),
          status: p.status,
          network: p.network,
          createdAt: p.created_at
        })),
        usageHistory: usageHistoryResult.rows.map(u => ({
          endpoint: u.endpoint,
          creditsUsed: parseInt(u.credits_used),
          creditsBefore: parseInt(u.credits_before),
          creditsAfter: parseInt(u.credits_after),
          createdAt: u.created_at
        })),
        usage: {
          totalCalls: parseInt(usageResult.rows[0]?.total_calls || 0),
          totalCreditsUsed: parseInt(usageResult.rows[0]?.total_credits_used || 0)
        },
        paymentWallet: X402_CONFIG.paymentWallet,
        message: autoConverted 
          ? `$${totalAutoConverted.toFixed(2)} USDC automatically converted to ${totalCreditsGranted} credits!`
          : hasPendingSweep && walletBalance > 0
            ? `$${walletBalance.toFixed(2)} USDC credited — sweep in progress (refresh shortly).`
            : walletBalance > 0 
              ? `$${walletBalance.toFixed(2)} USDC detected. Min $5 to auto-convert. Send USDC to your address.`
              : 'Send USDC to your wallet address - it will automatically convert to credits!'
      });
      } catch (error) {
        console.error('Error in prepaid/status endpoint:', error);
        return res.status(500).json({ 
          error: 'Failed to fetch prepaid status',
          message: error.message 
        });
      }
    }
    
    // =========================================================================
    // DEDICATED SWEEP ENDPOINT — lightweight, only does on-chain work
    // Called by frontend after status returns, or manually
    // POST /api/x402/sweep { apiKey } or GET with x-api-key header
    // =========================================================================
    if (url === '/api/x402/sweep' && (method === 'POST' || method === 'GET')) {
      try {
        const apiKey = req.headers['x-api-key'] || (req.body && req.body.apiKey);
        if (!apiKey) {
          return res.status(401).json({ error: 'API key required' });
        }
        
        const db = getPool();
        const custResult = await db.query(`
          SELECT c.id, c.x402_wallet_address, c.x402_wallet_encrypted_key
          FROM customers c JOIN api_keys ak ON ak.customer_id = c.id
          WHERE ak.api_key = $1 AND ak.is_active = true AND c.x402_enabled = true
        `, [apiKey]);
        
        if (custResult.rows.length === 0) {
          return res.status(401).json({ error: 'Invalid API key' });
        }
        
        const cust = custResult.rows[0];
        if (!cust.x402_wallet_address || !cust.x402_wallet_encrypted_key) {
          return res.status(200).json({ swept: false, reason: 'No wallet configured' });
        }
        
        // Find all pending_sweep records for this customer
        let pendingResult = await db.query(
          "SELECT id, network, amount_usdc FROM x402_prepaid_payments WHERE customer_id = $1 AND status = 'pending_sweep'",
          [cust.id]
        );
        
        // Self-healing: if no pending_sweep but USDC in wallet, run autoGrant to create one
        if (pendingResult.rows.length === 0) {
          for (const [networkKey, netConfig] of Object.entries(X402_CONFIG.networks)) {
            try {
              const provider = new ethers.providers.JsonRpcProvider(netConfig.rpc);
              const usdcContract = new ethers.Contract(netConfig.usdc, [
                'function balanceOf(address account) view returns (uint256)'
              ], provider);
              const balance = await usdcContract.balanceOf(cust.x402_wallet_address);
              const balanceUsdc = Number(ethers.utils.formatUnits(balance, 6));
              if (balanceUsdc >= 5.0) {
                const grantResult = await autoGrantCreditsFromWallet(cust.id, networkKey);
                if (grantResult.granted || grantResult.pendingSweep) {
                  pendingResult = await db.query(
                    "SELECT id, network, amount_usdc FROM x402_prepaid_payments WHERE customer_id = $1 AND status = 'pending_sweep'",
                    [cust.id]
                  );
                  break;
                }
              }
            } catch (e) {
              console.warn('[Sweep] Auto-grant attempt on ' + networkKey + ':', e.message);
            }
          }
        }
        
        if (pendingResult.rows.length === 0) {
          return res.status(200).json({ 
            swept: false, 
            reason: 'No pending sweeps — send $5+ USDC to your deposit address and refresh' 
          });
        }
        
        const results = [];
        const encryptedKey = JSON.parse(cust.x402_wallet_encrypted_key);
        const privateKey = decryptPrivateKey(encryptedKey);
        const masterWalletKey = (process.env.MASTER_WALLET_PRIVATE_KEY || '').trim();
        
        for (const pending of pendingResult.rows) {
          const netConfig = X402_CONFIG.networks[pending.network];
          if (!netConfig) continue;
          
          try {
            const provider = new ethers.providers.JsonRpcProvider(netConfig.rpc);
            let depositWallet = new ethers.Wallet(privateKey, provider);
            let usdcContract = new ethers.Contract(netConfig.usdc, [
              'function balanceOf(address account) view returns (uint256)',
              'function transfer(address to, uint256 amount) returns (bool)'
            ], provider);
            
            // Check USDC balance
            const balance = await usdcContract.balanceOf(cust.x402_wallet_address);
            const balanceUsdc = Number(ethers.utils.formatUnits(balance, 6));
            
            if (balanceUsdc < 0.01) {
              // Already swept or dust
              await db.query("UPDATE x402_prepaid_payments SET status = 'confirmed' WHERE id = $1", [pending.id]);
              results.push({ network: pending.network, status: 'already_swept', balance: balanceUsdc });
              continue;
            }
            
            // Check gas — use EIP-1559 fee data (not legacy gasPrice which is wrong on L2s)
            const ethBalance = await provider.getBalance(cust.x402_wallet_address);
            const feeData = await provider.getFeeData();
            const effectiveGasPrice = feeData.maxFeePerGas || feeData.gasPrice;
            const sweepGasNeeded = effectiveGasPrice.mul(100000); // gasLimit for USDC transfer
            const minGas = sweepGasNeeded.mul(2); // 2x buffer
            
            if (ethBalance.lt(minGas)) {
              // Fund gas — send 3x what the sweep needs (covers sweep + drain + future)
              if (masterWalletKey) {
                const fundAmount = sweepGasNeeded.mul(3);
                const masterWallet = new ethers.Wallet(masterWalletKey, provider);
                const gasTx = await masterWallet.sendTransaction({ to: cust.x402_wallet_address, value: fundAmount });
                await gasTx.wait();
                await new Promise(r => setTimeout(r, 1000)); // Wait for state propagation
                console.log(`[Sweep] Gas funded on ${pending.network}: ${gasTx.hash} (${ethers.utils.formatEther(fundAmount)} ETH)`);
                // Refresh provider connection to get updated balance
                const freshProvider = new ethers.providers.JsonRpcProvider(netConfig.rpc);
                depositWallet = new ethers.Wallet(privateKey, freshProvider);
                usdcContract = new ethers.Contract(netConfig.usdc, [
                  'function balanceOf(address account) view returns (uint256)',
                  'function transfer(address to, uint256 amount) returns (bool)'
                ], freshProvider);
              } else {
                results.push({ network: pending.network, status: 'no_gas', error: 'Master wallet not configured' });
                continue;
              }
            }
            
            // Submit USDC sweep
            const contractWithSigner = usdcContract.connect(depositWallet);
            const amountWei = ethers.utils.parseUnits(balanceUsdc.toFixed(6), 6);
            const tx = await contractWithSigner.transfer(X402_CONFIG.paymentWallet, amountWei, { gasLimit: 100000 });
            console.log(`[Sweep] Submitted on ${pending.network}: ${tx.hash} ($${balanceUsdc})`);
            
            // Update record
            await db.query(
              "UPDATE x402_prepaid_payments SET tx_hash = $1, status = 'confirmed' WHERE id = $2",
              [tx.hash, pending.id]
            );
            
            results.push({ network: pending.network, status: 'swept', txHash: tx.hash, amount: balanceUsdc });
            
            // Drain leftover ETH (fire-and-forget, non-blocking)
            try {
              if (masterWalletKey) {
                const masterWallet = new ethers.Wallet(masterWalletKey, provider);
                const remEth = await provider.getBalance(cust.x402_wallet_address);
                const drainFeeData = await provider.getFeeData();
                const drainGasPrice = drainFeeData.maxFeePerGas || drainFeeData.gasPrice;
                const drainCost = drainGasPrice.mul(21000).mul(3);
                if (remEth.gt(drainCost)) {
                  const drainTx = await depositWallet.sendTransaction({
                    to: masterWallet.address,
                    value: remEth.sub(drainGasPrice.mul(21000).mul(3).div(2)),
                    gasLimit: 21000
                  });
                  console.log(`[Sweep] ETH drain on ${pending.network}: ${drainTx.hash}`);
                  results.push({ network: pending.network, status: 'eth_drained', txHash: drainTx.hash });
                }
              }
            } catch (de) { /* non-critical */ }
            
          } catch (err) {
            console.error(`[Sweep] Failed on ${pending.network}:`, err.message);
            results.push({ network: pending.network, status: 'error', error: err.message });
          }
        }
        
        const anySwept = results.some(r => r.status === 'swept' || r.status === 'already_swept');
        return res.status(200).json({ 
          swept: anySwept, 
          results,
          ...(results.some(r => r.status === 'error' || r.status === 'no_gas') ? { 
            debug: 'Some sweeps failed — check MASTER_WALLET_PRIVATE_KEY and gas funding' 
          } : {})
        });
      } catch (error) {
        console.error('Error in sweep endpoint:', error);
        return res.status(500).json({ error: 'Sweep failed', message: error.message });
      }
    }
    
    // Get pending payments detail
    if (url === '/api/x402/paypergo/pending' && method === 'GET') {
      const apiKey = req.headers['x-api-key'];
      if (!apiKey) {
        return res.status(401).json({ error: 'API key required' });
      }
      
      const db = getPool();
      const customerQuery = `
        SELECT c.id FROM customers c
        JOIN api_keys ak ON ak.customer_id = c.id
        WHERE ak.api_key = $1 AND ak.is_active = true
      `;
      const result = await db.query(customerQuery, [apiKey]);
      
      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid API key' });
      }
      
      const pendingResult = await db.query(`
        SELECT id, endpoint, amount_usdc, network, created_at
        FROM x402_pending_payments
        WHERE customer_id = $1 AND batched_at IS NULL
        ORDER BY created_at DESC
        LIMIT 50
      `, [result.rows[0].id]);
      
      return res.status(200).json({
        pending: pendingResult.rows.map(r => ({
          id: r.id,
          endpoint: r.endpoint,
          amount: parseFloat(r.amount_usdc),
          network: r.network,
          createdAt: r.created_at
        }))
      });
    }
    
    // Verify a payment (for debugging/status checks)
    if (url === '/api/x402/verify' && method === 'POST') {
      const { txHash, network, endpoint, url: fullUrl, params } = req.body || {};
      
      if (!txHash || !network) {
        return res.status(400).json({ error: 'txHash and network required' });
      }
      
      const targetEndpoint = endpoint || '/api/events';
      let effectiveUrl = fullUrl;
      if (!effectiveUrl) {
        const u = new URL(targetEndpoint, 'http://localhost');
        if (params && typeof params === 'object') {
          for (const [k, v] of Object.entries(params)) {
            if (v === undefined || v === null || v === '') continue;
            u.searchParams.set(String(k), String(v));
          }
        }
        effectiveUrl = u.pathname + (u.search ? u.search : '');
      }

      const price = computeRequestPrice({ endpoint: targetEndpoint, url: effectiveUrl });
      const result = await verifyX402Payment(txHash, network, price, targetEndpoint);
      
      return res.status(result.valid ? 200 : 400).json(result);
    }

    // =========================================================================
    // PUBLIC TRANSACTION DETAIL: /api/tx/:hash
    // Used by the tx detail page (linked from Telegram insights)
    // =========================================================================
    const txMatch = url.match(/^\/api\/tx\/(0x[a-fA-F0-9]{10,})/);
    if (txMatch && method === 'GET') {
      try {
        const txHash = txMatch[1];
        const db = getPool();
        const result = await db.query(`
          SELECT e.ref_tx_hash, e.origin_user, e.action_type, e.protocol_name,
                 e.token_in_symbol, e.token_out_symbol, e.token_in_amount, e.token_out_amount,
                 e.swap_pair,
                 e.value_eth, e.event_timestamp, e.enriched_at, e.apy_percent, e.asset_symbol,
                 e.block_number, e.intent_metadata, i.insight_text, i.insight_headline
          FROM enriched_events e
          LEFT JOIN telegram_insight_sent i ON LOWER(i.ref_tx_hash) = LOWER(e.ref_tx_hash)
          WHERE LOWER(e.ref_tx_hash) = LOWER($1)
          ORDER BY COALESCE(e.event_timestamp, e.enriched_at) DESC
          LIMIT 1
        `, [txHash]);
        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Transaction not found', hash: txHash });
        }
        const ev = result.rows[0];
        // Compute latency: time between on-chain timestamp and enrichment
        let latencySeconds = null;
        if (ev.event_timestamp && ev.enriched_at) {
          latencySeconds = Math.round((new Date(ev.enriched_at).getTime() - new Date(ev.event_timestamp).getTime()) / 1000);
          if (latencySeconds < 0) latencySeconds = null;
        }
        // If API key provided and no telegram insight, check user's cached insight
        let insightText = ev.insight_text || null;
        let insightHeadline = ev.insight_headline || null;
        const apiKeyForTx = req.headers['x-api-key'];
        if ((!insightText || !insightHeadline) && apiKeyForTx) {
          try {
            const keyRow = await db.query(`
              SELECT c.id FROM customers c
              JOIN api_keys ak ON ak.customer_id = c.id
              WHERE ak.api_key = $1 AND ak.is_active = true
            `, [apiKeyForTx]);
            if (keyRow.rows.length > 0) {
              const userInsight = await db.query(`
                SELECT insight_text, insight_headline FROM user_tx_insights
                WHERE LOWER(ref_tx_hash) = LOWER($1) AND customer_id = $2
              `, [txHash, keyRow.rows[0].id]);
              if (userInsight.rows.length > 0) {
                insightText = userInsight.rows[0].insight_text;
                insightHeadline = userInsight.rows[0].insight_headline;
              }
            }
          } catch (err) { /* table may not exist yet */ }
        }

        return res.status(200).json({
          ref_tx_hash: ev.ref_tx_hash,
          origin_user: ev.origin_user,
          action_type: ev.action_type,
          protocol_name: ev.protocol_name,
          token_in_symbol: ev.token_in_symbol,
          token_out_symbol: ev.token_out_symbol,
          token_in_amount: ev.token_in_amount,
          token_out_amount: ev.token_out_amount,
          swap_pair: ev.swap_pair,
          value_eth: ev.value_eth,
          apy_percent: ev.apy_percent,
          asset_symbol: ev.asset_symbol,
          event_timestamp: ev.event_timestamp,
          enriched_at: ev.enriched_at,
          block_number: ev.block_number,
          intent_metadata: ev.intent_metadata,
          latency_seconds: latencySeconds,
          arbiscan_url: `https://arbiscan.io/tx/${ev.ref_tx_hash}`,
          insight_text: insightText,
          insight_headline: insightHeadline
        });
      } catch (e) {
        console.error('TX detail error:', e.message);
        return res.status(500).json({ error: 'Failed to fetch transaction', detail: e.message });
      }
    }

    // =========================================================================
    // ON-DEMAND AI INSIGHT: POST /api/tx/:hash/insight (Pro/PAYG, charged)
    // =========================================================================
    const insightMatch = url.match(/^\/api\/tx\/(0x[a-fA-F0-9]{10,})\/insight$/);
    if (insightMatch && method === 'POST') {
      try {
        const txHash = insightMatch[1];
        const apiKey = req.headers['x-api-key'];
        if (!apiKey) {
          return res.status(401).json({ error: 'API key required', message: 'Add X-API-Key header to generate insights.' });
        }

        const db = getPool();

        // Ensure tables exist (idempotent)
        await db.query(`
          CREATE TABLE IF NOT EXISTS user_tx_insights (
            ref_tx_hash TEXT NOT NULL,
            customer_id INTEGER NOT NULL,
            insight_text TEXT NOT NULL,
            insight_headline TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            PRIMARY KEY (ref_tx_hash, customer_id)
          )
        `).catch(() => {});

        // Resolve customer and tier
        const custResult = await db.query(`
          SELECT c.id, ak.id as api_key_id,
                 (SELECT COUNT(*) FROM subscriptions s WHERE s.customer_id = c.id AND s.status = 'active') as active_subs
          FROM customers c
          JOIN api_keys ak ON ak.customer_id = c.id
          WHERE ak.api_key = $1 AND ak.is_active = true
        `, [apiKey]);
        if (custResult.rows.length === 0) {
          return res.status(401).json({ error: 'Invalid API key' });
        }
        const customerId = custResult.rows[0].id;
        const apiKeyId = custResult.rows[0].api_key_id;
        const hasValidSubscription = parseInt(custResult.rows[0].active_subs || 0) > 0;

        const sentenceCount = (text) => {
          const t = String(text || '').trim();
          if (!t) return 0;
          return t
            .split(/(?<=[.!?])\s+/)
            .map(s => s.trim())
            .filter(Boolean).length;
        };
        const hasMinimumInsightStructure = (text) => {
          const paragraphs = String(text || '')
            .split(/\n\s*\n+/)
            .map(p => p.trim())
            .filter(Boolean);
          if (paragraphs.length < 2) return false;
          return sentenceCount(paragraphs[0]) >= 3 && sentenceCount(paragraphs[1]) >= 3;
        };

        // Check cache first - same user, same tx = reuse
        let cached = { rows: [] };
        try {
          cached = await db.query(`
            SELECT insight_text, insight_headline FROM user_tx_insights
            WHERE LOWER(ref_tx_hash) = LOWER($1) AND customer_id = $2
          `, [txHash, customerId]);
        } catch (e) { /* table may not exist */ }
        if (cached.rows && cached.rows.length > 0) {
          const cachedInsight = cached.rows[0].insight_text || '';
          // If old cached content is too short, regenerate with current stricter prompt.
          if (!hasMinimumInsightStructure(cachedInsight)) {
            console.log(`[Insight] Ignoring short cached insight for ${txHash} (customer ${customerId})`);
          } else {
          return res.status(200).json({
            insight_text: cached.rows[0].insight_text,
            insight_headline: cached.rows[0].insight_headline,
            cached: true
          });
          }
        }

        // Need to generate - Pro or PAYG only
        let credits = 0;
        if (!hasValidSubscription) {
          const credResult = await db.query('SELECT COALESCE(x402_prepaid_credits, 0) as c FROM customers WHERE id = $1', [customerId]);
          credits = parseInt(credResult.rows[0]?.c || 0);
          if (credits <= 0) {
            return res.status(402).json({
              error: 'Pro or credits required',
              message: 'Generate insights requires a Pro subscription or Pay-As-You-Go credits. Add credits in your dashboard.',
              prepaid: { chargeAmount: PREPAID_CONFIG.chargeAmount, creditsGranted: PREPAID_CONFIG.callsPerPayment }
            });
          }
        }

        // Prefer telegram-api (same code path as Telegram bot) when configured
        const telegramInsightUrl = (process.env.TELEGRAM_INSIGHT_API_URL || '').trim().replace(/\/+$/, '');
        const telegramCronSecret = (process.env.CRON_SECRET || process.env.TELEGRAM_INSIGHT_CRON_SECRET || '').trim();
        if (telegramInsightUrl && telegramCronSecret) {
          try {
            const tgRes = await fetch(`${telegramInsightUrl}/api/generate-insight`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${telegramCronSecret}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ tx_hash: txHash }),
              signal: AbortSignal.timeout(35000)
            });
            const tgData = await tgRes.json().catch(() => ({}));
            if (tgRes.ok && tgData.insight_text) {
              const insight = normalizeInsightText(tgData.insight_text);
              const headline = tgData.insight_headline || 'Analysis';
              await db.query(`
                INSERT INTO user_tx_insights (ref_tx_hash, customer_id, insight_text, insight_headline)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (ref_tx_hash, customer_id) DO UPDATE SET insight_text = $3, insight_headline = $4
              `, [txHash, customerId, insight, headline]).catch((err) => {
                console.warn('Insight cache save failed:', err.message);
              });
              if (!hasValidSubscription && credits > 0) {
                const weight = getCreditWeight('/api/tx');
                const newCredits = credits - weight;
                await db.query('UPDATE customers SET x402_prepaid_credits = $1 WHERE id = $2', [newCredits, customerId]);
                await db.query(`
                  INSERT INTO x402_prepaid_usage (customer_id, api_key_id, endpoint, credits_used, credits_before, credits_after)
                  VALUES ($1, $2, $3, $4, $5, $6)
                `, [customerId, apiKeyId, '/api/tx/insight', weight, credits, newCredits]).catch(() => {});
              }
              return res.status(200).json({ insight_text: insight, insight_headline: headline, cached: false });
            }
          } catch (e) {
            console.warn('[Insight] Telegram API fallback:', e.message);
          }
        }

        // Get tx data for prompt (local generation fallback)
        const txResult = await db.query(`
          SELECT e.ref_tx_hash, e.origin_user, e.action_type, e.protocol_name,
                 e.token_in_symbol, e.token_out_symbol, e.token_in_amount, e.token_out_amount,
                 e.value_eth, e.apy_percent
          FROM enriched_events e
          WHERE LOWER(e.ref_tx_hash) = LOWER($1)
          LIMIT 1
        `, [txHash]);
        if (txResult.rows.length === 0) {
          return res.status(404).json({ error: 'Transaction not found', hash: txHash });
        }
        const ev = txResult.rows[0];
        const addr = (ev.origin_user || '').slice(0, 6) + '...' + (ev.origin_user || '').slice(-4);
        const action = (ev.action_type || '').toLowerCase().replace(/_/g, ' ');
        const actionUpper = (ev.action_type || '').toUpperCase();
        const proto = (ev.protocol_name || '').replace(/ \+ .*$/, '');
        const tokens = [ev.token_in_symbol, ev.token_out_symbol].filter(Boolean).join(' / ');
        const formatHumanAmount = (value) => {
          const num = Number(value);
          if (!Number.isFinite(num)) return '';
          return num.toLocaleString(undefined, { maximumFractionDigits: 6 });
        };
        const stablecoins = new Set(['USDC', 'USDT', 'DAI', 'USDC.E', 'USDCN']);
        const inferUsdValue = () => {
          const candidates = [];
          const pushCandidate = (symbol, amount) => {
            const sym = String(symbol || '').toUpperCase();
            const num = Number(amount);
            if (stablecoins.has(sym) && Number.isFinite(num) && num > 0) candidates.push(num);
          };
          pushCandidate(ev.token_in_symbol, ev.token_in_amount);
          pushCandidate(ev.token_out_symbol, ev.token_out_amount);
          return candidates.length ? candidates[0] : null;
        };
        const amtIn = formatHumanAmount(ev.token_in_amount);
        const amtOut = formatHumanAmount(ev.token_out_amount);
        const valEth = parseFloat(ev.value_eth || 0);
        const apy = ev.apy_percent != null ? parseFloat(ev.apy_percent) : null;
        const usdValue = inferUsdValue();
        const promptValue = usdValue != null
          ? `$${usdValue.toFixed(2)} USD${valEth > 0 ? ` | ${valEth.toFixed(4)} ETH` : ''}`
          : (valEth > 0 ? `${valEth.toFixed(4)} ETH` : 'Unavailable');

        const angleHints = {
          SUPPLY: 'Focus on: why this asset/protocol was chosen, risk vs reward trade-off, or how lending pools work mechanically.',
          DELEGATED_SUPPLY: 'Focus on: permissioned execution (delegation), why automation was used, and how this differs from direct user supply.',
          DEPOSIT: 'Focus on: what the depositor gains, how the protocol uses these funds, or the strategy behind the deposit size.',
          BORROW: 'Focus on: why someone borrows crypto instead of selling, leverage strategies, or collateral requirements.',
          DELEGATED_BORROW: 'Focus on: permissioned execution (delegation), why automation/permissions were used for borrowing, and the risk controls involved.',
          REPAY: 'Focus on: deleveraging, managing liquidation risk, the cost of the loan, or why timing a repayment matters.',
          DELEGATED_REPAY: 'Focus on: permissioned execution (delegation), automated deleveraging, and risk management (liquidation safety) motivations.',
          SWAP: 'Focus on: what this trade signals about sentiment, the swap route/path, slippage considerations, or market timing.',
          LIQUIDATION: 'Focus on: what went wrong for the borrower, how liquidation mechanics protect lenders, or what market move triggered this.',
          WITHDRAW: 'Focus on: why someone exits a position, profit-taking vs risk reduction, or what it signals about confidence in the protocol.',
          DELEGATED_WITHDRAW: 'Focus on: permissioned execution (delegation), automated exits/position maintenance, and why the withdrawal was triggered.',
          UNWIND: 'Focus on: what closing a complex position involves, multi-step transactions, or how DeFi composability works.'
        };
        const angleHint = angleHints[actionUpper] || 'Pick an interesting angle: strategy, risk, market context, or protocol mechanics.';

        // Use same prompt structure as Telegram (which produces the detailed output you want)
        const styles = [
          'Use a tone like a sharp crypto analyst briefing a friend.',
          'Write like a curious journalist discovering this for the first time.',
          'Explain it like a teacher making DeFi click for a newcomer.',
          'Be witty and concise—think fintech Twitter at its best.',
          'Channel the voice of someone who genuinely finds this fascinating.'
        ];
        const styleHint = styles[Math.floor(Math.random() * styles.length)];
        const teacherPersonas = [
          'The Risk Analyst: You focus on liquidation thresholds, slippage, and defensive moves.',
          'The Yield Hunter: You highlight APY, cost of capital, and yield optimization.',
          'The Protocol Architect: You explain smart contract logic, LTV ratios, and protocol mechanics.',
          'The Market Watcher: You compare to broader yields and market context.',
          'The Intent Decoder: You infer whether this is a test, rebalance, or strategic entry.'
        ];
        const teacherPersona = teacherPersonas[Math.floor(Math.random() * teacherPersonas.length)];
        const themes = ['Protocol Deep-Dive (smart contract logic, LTV, liquidity hooks)', 'Market Macro (APY vs broader yields)', 'Wallet Intent (dust test vs rebalance vs strategic)', 'Asset Spotlight (why USDC/WBTC/ETH for this action)', 'Risk Factor (liquidation, slippage, deleveraging)'];
        const prompt = `Analyze this DeFi transaction. Return ONLY valid JSON (no markdown, no code block).

**Do NOT use a fixed template.** You are ${teacherPersona}
**Thematic angles:** Choose the 3 most relevant for THIS tx. Paragraph 1 covers 3 themes; Paragraph 2 covers 3 DIFFERENT themes.
Themes: ${themes.join('; ')}
**Variation:** Start Paragraph 1 with something other than "This wallet" or "The wallet"—e.g. "${proto} enables...", "Stablecoin liquidity...", "A ${action.toLowerCase()} of...".
**Output structure:**
{
  "headline": "Punchy statement, max 12 words.",
  "p1": ["sentence 1", "sentence 2", "sentence 3"],
  "p2": ["sentence 1", "sentence 2", "sentence 3"]
}
Each array = 3 sentences. Be specific. No generic filler.

**Transaction:**
- Wallet: ${addr}
- Action: ${action}
- Protocol: ${proto}
- Assets: ${tokens || 'N/A'} ${amtIn || amtOut ? `(${amtIn || ''} ${amtOut ? '→ ' + amtOut : ''})` : ''}
- Value: ${promptValue}${apy != null ? ` | APY: ${Number(apy).toFixed(2)}%` : ''}

**Your angle:** ${angleHint}

**Rules:** Amounts above are already human-readable token units, not raw on-chain integers. If a USD value is provided, use it exactly and do not inflate it. If USD value is unavailable, say value is unavailable instead of inferring one. Round APY to 1-2 decimals. Say "this wallet" not addresses. Be specific to THIS transaction.`;

        const systemPrompt = `You are a sharp DeFi analyst. Do NOT use a fixed template. Vary your approach: sometimes start with protocol mechanics, sometimes with asset choice, sometimes with market context. Pick the 3 most relevant thematic angles for each paragraph. Avoid repetitive phrases. Return valid JSON with headline, p1 (3 sentences), p2 (3 sentences). No markdown.`;

        const chutesToken = process.env.CHUTES_API_TOKEN;
        const chutesUrl = (process.env.CHUTES_API_URL || 'https://llm.chutes.ai/v1').replace(/\/+$/, '');
        const chutesModel = (process.env.CHUTES_MODEL || 'deepseek-ai/DeepSeek-V3').trim();
        const chutesModelFallback = 'Qwen/Qwen3-235B-A22B-Instruct-2507-TEE';
        const chutesModels = (process.env.CHUTES_MODELS || [chutesModel, chutesModelFallback].join(','))
          .split(',')
          .map(m => m.trim())
          .filter(Boolean);

        if (!chutesToken) {
          return res.status(503).json({ error: 'AI service unavailable' });
        }

        let t = '';
        let chutesUnavailable = false;
        let lastChutesError = '';
        const chutesPayloadBase = {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
          ],
          stream: false,
          max_tokens: 900,
          temperature: 0.82,
          frequency_penalty: 0.4,
          presence_penalty: 0.25
        };

        modelLoop:
        for (const modelName of chutesModels) {
          for (let attempt = 1; attempt <= 2; attempt++) {
            try {
              const chutesRes = await fetch(`${chutesUrl}/chat/completions`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${chutesToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...chutesPayloadBase, model: modelName }),
                signal: AbortSignal.timeout(30000)
              });
              const chutesBody = await chutesRes.json().catch(() => ({}));
              if (chutesRes.ok) {
                t = (chutesBody.choices?.[0]?.message?.content || '').trim();
                break modelLoop;
              }

              const errMsg = chutesBody?.error?.message || chutesBody?.detail || chutesRes.statusText || 'Unknown error';
              lastChutesError = `Chutes API ${chutesRes.status} (${modelName}): ${errMsg}`;
              chutesUnavailable = [429, 500, 502, 503, 504].includes(chutesRes.status);
              if (chutesUnavailable && attempt < 2) {
                await new Promise(resolve => setTimeout(resolve, 1200));
                continue;
              }
              break;
            } catch (err) {
              lastChutesError = `${err?.message || String(err)} (${modelName})`;
              chutesUnavailable = true;
              if (attempt < 2) {
                await new Promise(resolve => setTimeout(resolve, 1200));
                continue;
              }
            }
          }
        }
        if (!t && lastChutesError) {
          console.warn('[Insight] Falling back to local insight text:', lastChutesError);
        }
        t = t.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

        // Try JSON sentence-array format first
        let headline = '';
        let insight = '';
        const jsonMatch = t.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            const p1 = Array.isArray(parsed.p1) ? parsed.p1.filter(Boolean) : [];
            const p2 = Array.isArray(parsed.p2) ? parsed.p2.filter(Boolean) : [];
            if (p1.length === 3 && p2.length === 3 && (parsed.headline || '').trim()) {
              headline = (parsed.headline || '').trim().replace(/\*\*/g, '').slice(0, 120);
              insight = p1.join(' ') + '\n\n' + p2.join(' ');
            }
          } catch (_) { /* fall through */ }
        }
        if (!insight && /"headline"|"p1"|"p2"/i.test(t)) {
          const h = t.match(/"headline"\s*:\s*"([^"]+)"/i);
          const p1Body = (t.match(/"p1"\s*:\s*\[([\s\S]*?)\]/i) || [])[1] || '';
          const p2Body = (t.match(/"p2"\s*:\s*\[([\s\S]*?)\]/i) || [])[1] || '';
          const parseItems = (body) => (body.match(/"((?:\\.|[^"\\])*)"/g) || [])
            .map(s => s.slice(1, -1).replace(/\\"/g, '"').trim())
            .filter(Boolean);
          const p1 = parseItems(p1Body).slice(0, 3);
          const p2 = parseItems(p2Body).slice(0, 3);
          if (h && p1.length >= 1 && p2.length >= 1) {
            headline = h[1].trim().replace(/\*\*/g, '').slice(0, 120);
            insight = p1.join(' ') + '\n\n' + p2.join(' ');
          }
        }
        if (!insight) {
          const headlineMatch = t.match(/HEADLINE:\s*(.+?)(?=\s*---|\s*INSIGHT:|\n\n|$)/is);
          const insightMatch2 = t.match(/(?:---\s*)?INSIGHT:\s*([\s\S]+?)$/im);
          headline = headlineMatch ? headlineMatch[1].trim().replace(/\n.*/gs, '').replace(/\*\*/g, '').slice(0, 120) : (valEth > 0 ? `${action} on ${proto} — ${valEth.toFixed(2)} ETH moved.` : `${action} on ${proto}.`);
          insight = insightMatch2 ? insightMatch2[1].trim().replace(/^HEADLINE:\s*.+$/im, '').replace(/^---\s*/im, '').replace(/\*\*/g, '').trim() : '';
          const looksJsonish = /"headline"|"p1"|"p2"|\{|\}/i.test(insight || t);
          if (!insight || looksJsonish) {
            insight = `This wallet executed a ${action} action on ${proto} involving ${tokens || 'key assets'}. ${apy != null ? `The position references an APY near ${Number(apy).toFixed(2)}%, signaling a deliberate risk/reward choice.` : 'The position suggests a deliberate risk/reward choice.'}\n\nThis behavior points to tactical capital management rather than random activity, with execution aligned to current DeFi market conditions.`;
          }
        }

        insight = normalizeInsightText(insight);

        // Save to cache (best-effort)
        await db.query(`
          INSERT INTO user_tx_insights (ref_tx_hash, customer_id, insight_text, insight_headline)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (ref_tx_hash, customer_id) DO UPDATE SET insight_text = $3, insight_headline = $4
        `, [txHash, customerId, insight, headline]).catch((err) => {
          console.warn('Insight cache save failed:', err.message);
        });

        // Charge PAYG user
        if (!hasValidSubscription && credits > 0 && !chutesUnavailable) {
          const weight = getCreditWeight('/api/tx');
          const newCredits = credits - weight;
          await db.query('UPDATE customers SET x402_prepaid_credits = $1 WHERE id = $2', [newCredits, customerId]);
          await db.query(`
            INSERT INTO x402_prepaid_usage (customer_id, api_key_id, endpoint, credits_used, credits_before, credits_after)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [customerId, apiKeyId, '/api/tx/insight', weight, credits, newCredits]).catch(() => {});
        }

        return res.status(200).json({ insight_text: insight, insight_headline: headline, cached: false, ai_fallback: chutesUnavailable });
      } catch (e) {
        console.error('Insight generation error:', e.message, e.stack);
        return res.status(500).json({
          error: 'Failed to generate insight',
          message: e.message,
          detail: process.env.NODE_ENV === 'development' ? e.stack : undefined
        });
      }
    }

    // =========================================================================
    // TTS SPEAK: POST /api/tts/speak (Pro=free, PAYG=charged, from_telegram=free)
    // =========================================================================
    if (url === '/api/tts/speak' && method === 'POST') {
      try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
        const { text, from_telegram } = body;
        if (!text || typeof text !== 'string') {
          return res.status(400).json({ error: 'text is required' });
        }

        const db = getPool();
        const apiKey = req.headers['x-api-key'];

        // Free path: from_telegram flag
        if (from_telegram === true || from_telegram === 'true') {
          // Generate and return (no charge, no cache check for simplicity - cache by content)
          const audio = await generateTTS(text, db);
          if (!audio) return res.status(503).json({ error: 'TTS unavailable' });
          return res.setHeader('Content-Type', 'audio/wav').status(200).send(audio);
        }

        // Authenticated path: require API key
        if (!apiKey) {
          return res.status(401).json({ error: 'API key required or from_telegram=true for TTS' });
        }

        const custResult = await db.query(`
          SELECT c.id, ak.id as api_key_id,
                 (SELECT COUNT(*) FROM subscriptions s WHERE s.customer_id = c.id AND s.status = 'active') as active_subs,
                 COALESCE(c.x402_prepaid_credits, 0) as credits
          FROM customers c
          JOIN api_keys ak ON ak.customer_id = c.id
          WHERE ak.api_key = $1 AND ak.is_active = true
        `, [apiKey]);
        if (custResult.rows.length === 0) {
          return res.status(401).json({ error: 'Invalid API key' });
        }
        const customerId = custResult.rows[0].id;
        const apiKeyId = custResult.rows[0].api_key_id;
        const hasValidSubscription = parseInt(custResult.rows[0].active_subs || 0) > 0;
        let credits = parseInt(custResult.rows[0].credits || 0);

        // Pro = free. PAYG = must have credits
        if (!hasValidSubscription && credits <= 0) {
          return res.status(402).json({
            error: 'Pro or credits required',
            message: 'TTS requires Pro subscription or Pay-As-You-Go credits.'
          });
        }

        const audio = await generateTTS(text, db);
        if (!audio) return res.status(503).json({ error: 'TTS unavailable' });

        // Charge PAYG only (Pro = no charge)
        if (!hasValidSubscription && credits > 0) {
          const weight = getCreditWeight('/api/tts/speak');
          const newCredits = credits - weight;
          await db.query('UPDATE customers SET x402_prepaid_credits = $1 WHERE id = $2', [newCredits, customerId]);
          await db.query(`
            INSERT INTO x402_prepaid_usage (customer_id, api_key_id, endpoint, credits_used, credits_before, credits_after)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [customerId, apiKeyId, '/api/tts/speak', weight, credits, newCredits]).catch(() => {});
        }

        return res.setHeader('Content-Type', 'audio/wav').status(200).send(audio);
      } catch (e) {
        console.error('TTS error:', e.message);
        return res.status(500).json({ error: 'TTS failed', detail: e.message });
      }
    }

    // =========================================================================
    // X402-PROTECTED DATA ENDPOINT: /api/events
    // =========================================================================
    if ((url === '/api/events' || url.startsWith('/api/events?')) && method === 'GET') {
      const apiKey = req.headers['x-api-key'];
      const paymentProof = req.headers['x-payment-proof'];
      const paymentNetwork = req.headers['x-payment-network'];
      const db = getPool();

      // Compute the exact price for THIS request (metered pricing: time_range + limit)
      const requestUrlParams = new URL(url, 'http://localhost').searchParams;
      const requestTimeRange = requestUrlParams.get('time_range') || '24h';
      const requestLimit = requestUrlParams.get('limit') || '100';
      const requestPrice = computeEventsPrice({ timeRange: requestTimeRange, limit: requestLimit });
      
      let customerId = null;
      let hasValidSubscription = false;
      let rateLimitRemaining = 0;
      
      // Check API key authentication
      if (apiKey) {
        const customerQuery = `
          SELECT c.id, c.email, ak.rate_limit_requests,
                 (SELECT COUNT(*) FROM subscriptions s WHERE s.customer_id = c.id AND s.status = 'active') as active_subs
          FROM customers c
          JOIN api_keys ak ON ak.customer_id = c.id
          WHERE ak.api_key = $1 AND ak.is_active = true
        `;
        const customerResult = await db.query(customerQuery, [apiKey]);
        
        if (customerResult.rows.length > 0) {
          customerId = customerResult.rows[0].id;
          hasValidSubscription = parseInt(customerResult.rows[0].active_subs) > 0;
          const rateLimit = customerResult.rows[0].rate_limit_requests || 50;
          
          // Check rate limit for free users
          if (!hasValidSubscription) {
            const windowStart = new Date(Math.floor(Date.now() / 3600000) * 3600000);
            const usageResult = await db.query(
              'SELECT request_count FROM rate_limit_counters WHERE api_key_id = (SELECT id FROM api_keys WHERE api_key = $1) AND window_start = $2',
              [apiKey, windowStart]
            );
            const currentUsage = usageResult.rows[0]?.request_count || 0;
            rateLimitRemaining = Math.max(0, rateLimit - currentUsage);
            
            if (rateLimitRemaining <= 0 && !paymentProof) {
              // Rate limited - require X402 payment
              res.setHeader('X-RateLimit-Remaining', '0');
              return generate402Response('/api/events', res, {
                price: requestPrice,
                params: { time_range: requestTimeRange, limit: requestLimit }
              });
            }
          }
        }
      }
      
      // Check payment method priority: Pay-Per-Go > Credit Balance > Per-Request
      let paymentHandled = false;
      const price = requestPrice;
      
      if (customerId) {
        // Check if pay-per-go is enabled
        const paypergoResult = await db.query(`
          SELECT x402_enabled, x402_wallet_address 
          FROM customers 
          WHERE id = $1 AND x402_enabled = TRUE
        `, [customerId]);
        
        if (paypergoResult.rows.length > 0 && paypergoResult.rows[0].x402_wallet_address) {
          // Pay-per-go enabled: check prepaid credits
          const creditsResult = await db.query('SELECT x402_prepaid_credits FROM customers WHERE id = $1', [customerId]);
          let credits = parseInt(creditsResult.rows[0]?.x402_prepaid_credits || 0);
          
          // If no credits, automatically check wallet and grant credits if USDC is available
          if (credits <= PREPAID_CONFIG.minCredits) {
            try {
              const autoGrant = await autoGrantCreditsFromWallet(customerId, 'base');
              if (autoGrant.granted) {
                credits = autoGrant.newCredits;
                console.log(`Auto-granted ${autoGrant.creditsGranted} credits from wallet balance`);
              } else {
                // Still no credits after auto-check: require user to fund wallet
                return res.status(402).json({
                  error: 'Insufficient credits',
                  message: `You have ${credits} API call credits remaining. Send USDC to your wallet to automatically get more credits.`,
                  credits: credits,
                  required: 1,
                  prepaid: {
                    chargeAmount: PREPAID_CONFIG.chargeAmount,
                    creditsGranted: PREPAID_CONFIG.callsPerPayment,
                    walletAddress: paypergoResult.rows[0].x402_wallet_address,
                    networks: Object.keys(X402_CONFIG.networks),
                    instructions: `Send $${PREPAID_CONFIG.chargeAmount} USDC to your wallet address to automatically receive ${PREPAID_CONFIG.callsPerPayment} API call credits. No verification needed!`
                  }
                });
              }
            } catch (error) {
              console.error('Error auto-granting credits:', error);
              return res.status(402).json({
                error: 'Could not check wallet balance',
                message: 'Please try again or manually fund your wallet.',
                credits: credits
              });
            }
          }
          
          // Deduct credit (weighted by endpoint)
          const weight = getCreditWeight('/api/events');
          const newCredits = credits - weight;
          await db.query('UPDATE customers SET x402_prepaid_credits = $1 WHERE id = $2', [newCredits, customerId]);
          
          // Log credit usage
          try {
            const apiKeyResult = await db.query('SELECT id FROM api_keys WHERE api_key = $1', [apiKey]);
            const apiKeyId = apiKeyResult.rows[0]?.id;
            await db.query(`
              INSERT INTO x402_prepaid_usage 
              (customer_id, api_key_id, endpoint, credits_used, credits_before, credits_after)
              VALUES ($1, $2, $3, $4, $5, $6)
            `, [customerId, apiKeyId, '/api/events', weight, credits, newCredits]);
          } catch (e) {
            console.log('Credit usage logging skipped:', e.message);
          }
          
          paymentHandled = true;
        } else {
          // Check credit balance
          const balanceResult = await db.query('SELECT usdc_balance FROM customers WHERE id = $1', [customerId]);
          const balance = parseFloat(balanceResult.rows[0]?.usdc_balance || 0);
          
          if (balance >= price) {
            // Use credit balance
            paymentHandled = true;
            const newBalance = balance - price;
            
            await db.query('UPDATE customers SET usdc_balance = $1 WHERE id = $2', [newBalance, customerId]);
            
            // Log credit usage
            try {
              const apiKeyResult = await db.query('SELECT id FROM api_keys WHERE api_key = $1', [apiKey]);
              const apiKeyId = apiKeyResult.rows[0]?.id;
              await db.query(`
                INSERT INTO x402_credits_usage (customer_id, api_key_id, endpoint, amount_deducted, balance_before, balance_after)
                VALUES ($1, $2, $3, $4, $5, $6)
              `, [customerId, apiKeyId, '/api/events', price, balance, newBalance]);
            } catch (e) {
              console.log('Credit usage logging skipped:', e.message);
            }
          } else if (balance > 0) {
            // Insufficient balance
            return res.status(402).json({
              error: 'Insufficient balance',
              message: `Your balance is $${balance.toFixed(6)} USDC, but this request requires $${price} USDC.`,
              currentBalance: balance,
              required: price,
              x402: {
                price: price - balance,
                currency: 'USDC',
                wallet: X402_CONFIG.paymentWallet,
                depositInstructions: 'Send USDC to your linked wallet or make a one-time payment'
              },
              depositUrl: '/dashboard?tab=balance'
            });
          }
        }
      }
      
      // If no valid subscription, no API key, and payment not handled, require X402 payment
      let x402Settlement = null; // Track settlement for PAYMENT-RESPONSE header
      
      if (!hasValidSubscription && !apiKey && !paymentHandled) {
        // Check for standard x402 PAYMENT-SIGNATURE first
        if (x402Standard.isStandardX402Request(req) && !paymentHandled) {
          const stdResult = await x402Standard.processPayment(req, requestPrice, X402_CONFIG.paymentWallet, '/api/events');
          if (stdResult.success) {
            paymentHandled = true;
            x402Settlement = stdResult.settlement;
            // Log standard x402 payment
            try {
              const agentId = req.headers['x-agent-id'] || null;
              await db.query(`
                INSERT INTO x402_payments (tx_hash, network, amount_usdc, endpoint, customer_id, from_wallet, agent_id, metadata, confirmations)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (tx_hash) DO NOTHING
              `, [
                'x402std_' + Date.now(),
                'eip155:8453',
                requestPrice,
                '/api/events',
                customerId,
                'standard-x402',
                agentId,
                JSON.stringify({ protocol: 'x402v2', settlement: x402Settlement }),
                1
              ]);
            } catch (e) {
              console.log('Standard x402 payment logging skipped:', e.message);
            }
          } else if (!paymentProof && !paymentNetwork) {
            // No legacy payment either, return 402
            return generate402Response('/api/events', res, {
              price: requestPrice,
              params: { time_range: requestTimeRange, limit: requestLimit }
            });
          }
        } else if (!paymentProof || !paymentNetwork) {
          return generate402Response('/api/events', res, {
            price: requestPrice,
            params: { time_range: requestTimeRange, limit: requestLimit }
          });
        }
      }
      
      // Legacy X402 verification: verify X-Payment-Proof if provided (only if payment not handled)
      if (paymentProof && paymentNetwork && !paymentHandled) {
        const verification = await verifyX402Payment(paymentProof, paymentNetwork, requestPrice, '/api/events');
        
        if (!verification.valid) {
          return res.status(402).json({
            error: 'Invalid payment',
            details: verification.error,
            required: requestPrice,
            currency: 'USDC'
          });
        }
        
        // Log X402 payment
        try {
          const agentId = req.headers['x-agent-id'] || null;
          const metadataHeader = req.headers['x-agent-metadata'];
          const metadata = metadataHeader ? JSON.parse(metadataHeader) : null;
          const confirmations = verification.confirmations || 1;
          
          await db.query(`
            INSERT INTO x402_payments (tx_hash, network, amount_usdc, endpoint, customer_id, from_wallet, agent_id, metadata, confirmations)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (tx_hash) DO NOTHING
          `, [
            paymentProof, 
            paymentNetwork, 
            verification.amount, 
            '/api/events', 
            customerId,
            verification.from,
            agentId,
            metadata ? JSON.stringify(metadata) : null,
            confirmations
          ]);
      } catch (e) {
          // Table might not exist yet, that's ok
          console.log('X402 payment logging skipped:', e.message);
        }
      }
      
      // Parse query parameters
      const urlParams = new URL(url, 'http://localhost').searchParams;
      const requestedLimit = parseInt(urlParams.get('limit')) || 100;
      const offset = parseInt(urlParams.get('offset')) || 0;
      const protocol = urlParams.get('protocol');
      const actionType = urlParams.get('action_type');
      const wallet = urlParams.get('wallet'); // For authenticated users only
      
      // Determine user tier FIRST (needed for limit calculation)
      let userTier = 'public';
      if (apiKey && customerId) {
        if (hasValidSubscription) {
          // Check which plan
          const planQuery = await db.query(`
            SELECT sp.name 
            FROM subscriptions s
            JOIN subscription_plans sp ON s.plan_id = sp.id
            WHERE s.customer_id = $1 AND s.status = 'active'
            LIMIT 1
          `, [customerId]);
          userTier = planQuery.rows[0]?.name?.toLowerCase() || 'developer';
        } else {
          userTier = 'free';
        }
        
        // USDC pay-as-you-go users with credits get Pro access
        if (userTier === 'free') {
          const creditsCheck = await db.query(
            'SELECT COALESCE(x402_prepaid_credits, 0) as credits FROM customers WHERE id = $1',
            [customerId]
          );
          if (parseInt(creditsCheck.rows[0]?.credits || 0) > 0) {
            userTier = 'pro';
          }
        }
      }
      
      // X402 on-chain payment verified for this request = Pro data access
      if (paymentHandled && userTier !== 'pro') {
        userTier = 'pro';
      }
      
      // Tier-based limits (Pro users get unlimited access with pagination)
      let maxLimit = 100; // Default/public limit
      if (userTier === 'pro') {
        maxLimit = 100000; // Pro: virtually unlimited - pagination handles the rest
      } else if (userTier === 'developer' || userTier === 'starter') {
        maxLimit = wallet ? 2000 : 500; // Developer: more for wallet queries
      } else if (userTier === 'free') {
        maxLimit = wallet ? 500 : 100; // Free: limited
      }
      
      const limit = Math.min(requestedLimit, maxLimit);
      
      let query = `
        SELECT e.*,
          COALESCE(e.event_timestamp, e.enriched_at) as display_timestamp
        FROM enriched_events e
        WHERE e.action_type IS NOT NULL 
          AND e.action_type != 'UNKNOWN'
          AND e.protocol_name IS NOT NULL
          AND e.protocol_name != 'Unknown'
          AND LOWER(e.protocol_name) != 'unknown'
      `;
      const params = [];
      let paramIndex = 1;
      
      if (protocol) {
        query += ` AND e.protocol_name ILIKE $${paramIndex}`;
        params.push(`%${protocol}%`);
        paramIndex++;
      }
      
      if (actionType) {
        query += ` AND e.action_type = $${paramIndex}`;
        params.push(actionType);
        paramIndex++;
      }
      
      if (wallet && (hasValidSubscription || userTier === 'developer' || userTier === 'starter' || userTier === 'pro')) {
        query += ` AND e.origin_user ILIKE $${paramIndex}`;
        params.push(`%${wallet}%`);
        paramIndex++;
      }
      
      query += ` ORDER BY COALESCE(e.event_timestamp, e.enriched_at) DESC NULLS LAST LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);
      
      const result = await db.query(query, params);
      
      // Get APY from aave_events for events that need it (Pro tier)
      // Use same extraction method as live-monitor: extract from ReserveDataUpdated events
      // which are stored in aave_events.supply_apy_percent (calculated from liquidityRate)
      const apyMap = {};
      if (userTier === 'pro' && result.rows.length > 0) {
        const txHashes = result.rows.map(r => r.ref_tx_hash).filter(Boolean);
        if (txHashes.length > 0) {
          // Get APY from aave_events - use same extraction method as live-monitor
          // live-monitor extracts from ReserveDataUpdated events (function selector 0xeb45e4d1)
          // For Explorer, we use pre-calculated supply_apy_percent from the same source
          const apyQuery = await db.query(`
            SELECT 
              a.tx_hash,
              a.full_data->'fullData'->'tx'->>'refTx' as ref_tx_from_data,
              COALESCE(
                a.supply_apy_percent,
                CASE WHEN a.supply_apy_bps IS NOT NULL THEN a.supply_apy_bps::NUMERIC / 100.0 ELSE NULL END
              ) as supply_apy_percent
            FROM aave_events a
            WHERE (
              a.tx_hash = ANY($1::text[])
              OR a.full_data->'fullData'->'tx'->>'refTx' = ANY($1::text[])
            )
              AND (
                a.supply_apy_percent IS NOT NULL 
                OR a.supply_apy_bps IS NOT NULL
              )
            ORDER BY a.block_timestamp DESC
          `, [txHashes]);
          apyQuery.rows.forEach(row => {
            if (row.supply_apy_percent) {
              const apyValue = parseFloat(row.supply_apy_percent);
              // Only use if it's a reasonable APY (not 0.01 or 0.02 which are errors)
              // But allow values >= 0.1% (some low APY tokens are valid)
              // Same filtering logic as live-monitor
              if (apyValue >= 0.1) {
                // Store APY by both tx_hash and ref_tx for matching
                // Use all possible matching keys to ensure we find the APY
                if (row.tx_hash) {
                  apyMap[row.tx_hash.toLowerCase()] = apyValue;
                }
                if (row.ref_tx_from_data) {
                  apyMap[row.ref_tx_from_data.toLowerCase()] = apyValue;
                }
              }
            }
          });
        }
      }
      
      // Filter data based on tier
      const filteredData = result.rows.map(event => {
        // Prioritize non-Aave protocols when multiple protocols are involved
        let displayProtocolName = event.protocol_name;
        if (displayProtocolName && displayProtocolName.includes(' + ')) {
          const protocols = displayProtocolName.split(' + ');
          const aaveNames = ['Aave V3 Pool', 'Aave V3', 'Aave', 'Aave Pool', 
                             'Aave Wrapped Token Gateway', 'Aave Wrapped Token Gateway V3',
                             'Aave V3 WETH Gateway', 'Aave Pool Addresses Provider'];
          const nonAaveProtocols = protocols.filter(p => !aaveNames.includes(p.trim()));
          if (nonAaveProtocols.length > 0) {
            displayProtocolName = nonAaveProtocols[0].trim();
          }
        }
        
        const baseData = {
          ref_tx_hash: event.ref_tx_hash,
          protocol_name: displayProtocolName,
          action_type: event.action_type,
          event_timestamp: event.display_timestamp || event.event_timestamp || event.enriched_at,
          block_number: event.block_number,
          gas_used: event.gas_used,
          value_eth: event.value_eth,
          tx_status: event.tx_status
        };
        
        // Developer+ gets wallet addresses (truncated)
        if (userTier === 'developer' || userTier === 'starter' || userTier === 'pro') {
          baseData.origin_user = event.origin_user ? 
            (userTier === 'pro' ? event.origin_user : event.origin_user.slice(0, 6) + '...' + event.origin_user.slice(-4)) : 
            null;
          baseData.token_in_symbol = event.token_in_symbol;
          baseData.token_out_symbol = event.token_out_symbol;
          baseData.token_in_amount = event.token_in_amount;
          baseData.token_out_amount = event.token_out_amount;
        }
        
        // Pro only gets full enrichment - use supply_apy_percent from aave_events if available
        // Same extraction method as live-monitor: ReserveDataUpdated events -> supply_apy_percent
        // Allow low APYs only for assets that are expected to be very low (e.g. WBTC).
        if (userTier === 'pro') {
          const enrichedApy = event.apy_percent ? parseFloat(event.apy_percent) : null;
          // Get APY from apyMap (from separate query for performance)
          const refTxKey = (event.ref_tx_hash || '').toLowerCase();
          const mappedApy = apyMap[refTxKey];
          
          // Prefer apyMap (from aave_events.supply_apy_percent), then enriched_events.apy_percent
          let apyValue = (mappedApy !== null && mappedApy !== undefined) ? mappedApy :
            (enrichedApy !== null && enrichedApy !== undefined) ? enrichedApy : null;

          const apySymbol = (event.asset_symbol || event.token_in_symbol || event.token_out_symbol || '').toUpperCase();
          const allowLowApy = apySymbol === 'WBTC';
          if (apyValue !== null && apyValue < 0.1 && !allowLowApy) {
            apyValue = null;
          }

          baseData.apy_percent = apyValue;
          baseData.token_in_address = event.token_in_address;
          baseData.token_out_address = event.token_out_address;
          baseData.asset_symbol = event.asset_symbol;
          baseData.swap_pair = event.swap_pair;
        }
        
        return baseData;
      });
      
      // Update rate limit counter for API key users
      if (apiKey && !hasValidSubscription) {
        const windowStart = new Date(Math.floor(Date.now() / 3600000) * 3600000);
        await db.query(`
          INSERT INTO rate_limit_counters (api_key_id, window_start, request_count)
          SELECT id, $2, 1 FROM api_keys WHERE api_key = $1
          ON CONFLICT (api_key_id, window_start) DO UPDATE SET request_count = rate_limit_counters.request_count + 1
        `, [apiKey, windowStart]);
      }
      
      let total = 0;
      if (offset === 0 && result.rows.length < limit) {
        total = result.rows.length;
      } else {
        let countQuery = `
          SELECT COUNT(*) as total
          FROM enriched_events e
          WHERE e.action_type IS NOT NULL 
            AND e.action_type != 'UNKNOWN'
            AND e.protocol_name IS NOT NULL
            AND e.protocol_name != 'Unknown'
            AND LOWER(e.protocol_name) != 'unknown'
        `;
        const countParams = [];
        let countParamIndex = 1;
        
        if (protocol) {
          countQuery += ` AND e.protocol_name ILIKE $${countParamIndex}`;
          countParams.push(`%${protocol}%`);
          countParamIndex++;
        }
        
        if (actionType) {
          countQuery += ` AND e.action_type = $${countParamIndex}`;
          countParams.push(actionType);
          countParamIndex++;
        }
        
        if (wallet && (hasValidSubscription || userTier === 'developer' || userTier === 'starter' || userTier === 'pro')) {
          countQuery += ` AND e.origin_user ILIKE $${countParamIndex}`;
          countParams.push(`%${wallet}%`);
          countParamIndex++;
        }
        
        try {
          const totalResult = await Promise.race([
            db.query(countQuery, countParams),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Count query timeout')), 10000))
          ]);
          total = parseInt(totalResult.rows[0]?.total || 0);
        } catch (countError) {
          console.error('Count query error:', countError.message);
          if (userTier === 'pro' && result.rows.length >= limit) {
            total = Math.max(10000, offset + result.rows.length * 2);
          } else {
            total = offset + result.rows.length;
          }
        }
      }
      
      // Trigger webhooks for new events (async, don't block response)
      // Only trigger for events that were just enriched (within last minute)
      if (filteredData.length > 0) {
        const webhookService = new WebhookService(db);
        
        // Filter events that should trigger webhooks
        const eventsToTrigger = filteredData.filter(event => {
          const enrichedTime = event.enriched_at || event.enrichedAt;
          const eventTime = enrichedTime || event.event_timestamp || event.timestamp;
          
          if (eventTime) {
            const eventDate = new Date(eventTime);
            const timeWindow = 900000; // 15 minutes
            const timeAgo = new Date(Date.now() - timeWindow);
            return eventDate > timeAgo;
          }
          return false;
        });
        
        // Trigger webhooks with batching to avoid overwhelming the system
        if (eventsToTrigger.length > 0) {
          // Process in batches of 10 events at a time
          const batchSize = 10;
          (async () => {
            for (let i = 0; i < eventsToTrigger.length; i += batchSize) {
              const batch = eventsToTrigger.slice(i, i + batchSize);
              await Promise.allSettled(
                batch.map(event => 
                  webhookService.triggerWebhooks(event).catch(err => {
                    console.error('Webhook trigger error:', err);
                  })
                )
              );
              // Small delay between batches
              if (i + batchSize < eventsToTrigger.length) {
                await new Promise(resolve => setTimeout(resolve, 50));
              }
            }
          })().catch(err => {
            console.error('Webhook trigger batch error:', err);
          });
        }
      }

      res.setHeader('X-RateLimit-Remaining', rateLimitRemaining.toString());
      
      // Standard x402 settlement receipt header
      if (x402Settlement) {
        try { res.setHeader('PAYMENT-RESPONSE', JSON.stringify(x402Settlement)); } catch (e) { /* ignore */ }
      }
      
      return res.status(200).json({
        success: true,
        count: filteredData.length,
        limit,
        offset,
        tier: userTier,
        events: filteredData, // Use 'events' for consistency with frontend
        data: filteredData, // Keep 'data' for backward compatibility
        pagination: {
          limit,
          offset,
          total,
          has_more: offset + filteredData.length < total,
          total_pages: Math.ceil(total / limit)
        }
      });
    }

    // =========================================================================
    // EXPLORER ENDPOINT: /api/explorer/events (Public with limited data - Real-time)
    // =========================================================================
    if (url.startsWith('/api/explorer/events') && method === 'GET') {
      try {
        const urlParams = new URL(req.url, 'http://localhost').searchParams;
        const limit = Math.min(parseInt(urlParams.get('limit')) || 50, 100);
        const offset = parseInt(urlParams.get('offset')) || 0;
        const protocol = urlParams.get('protocol');
        const actionType = urlParams.get('action_type');
        const timeRange = urlParams.get('time_range') || '24h';
        const fastMode = urlParams.get('fast') === '1' || offset === 0;

        const cacheKey = `${timeRange}:${limit}:${offset}:${protocol || ''}:${actionType || ''}`;
        if (explorerEventsCache.data && explorerEventsCache.key === cacheKey
            && (Date.now() - explorerEventsCache.timestamp) < EXPLORER_EVENTS_TTL_MS) {
          return res.status(200).json(explorerEventsCache.data);
        }

        const db = getPool();
        
        // Add query timeout wrapper
        const queryWithTimeout = (queryText, params, timeoutMs = 15000) => {
          return Promise.race([
            db.query(queryText, params),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Query timeout')), timeoutMs)
            )
          ]);
        };
      
      let query = `
        SELECT
          e.ref_tx_hash,
          e.protocol_name,
          e.action_type,
          COALESCE(e.event_timestamp, e.enriched_at) as event_timestamp,
          e.block_number,
          e.gas_used,
          e.value_eth,
          e.tx_status,
          e.token_in_amount,
          e.token_out_amount,
          e.token_in_symbol,
          e.token_out_symbol,
          e.swap_pair,
          e.asset_symbol
        FROM enriched_events e
        WHERE e.action_type IS NOT NULL
          AND e.action_type NOT IN ('UNKNOWN', 'RESERVE_DATA_UPDATED', 'TRANSFER', 'APPROVE', 'WRAP', 'UNWRAP')
          AND e.protocol_name IS NOT NULL
          AND e.protocol_name != 'Unknown'
      `;

      const params = [];
      let paramIndex = 1;

      if (timeRange === '1h') {
        query += ` AND COALESCE(e.event_timestamp, e.enriched_at) > NOW() - INTERVAL '1 hour'`;
      } else if (timeRange === '24h') {
        query += ` AND COALESCE(e.event_timestamp, e.enriched_at) > NOW() - INTERVAL '24 hours'`;
      } else if (timeRange === '7d') {
        query += ` AND COALESCE(e.event_timestamp, e.enriched_at) > NOW() - INTERVAL '7 days'`;
      }

      if (protocol) {
        query += ` AND e.protocol_name ILIKE $${paramIndex}`;
        params.push(`%${protocol}%`);
        paramIndex++;
      }

      if (actionType) {
        query += ` AND e.action_type = $${paramIndex}`;
        params.push(actionType);
        paramIndex++;
      }

      query += ` ORDER BY COALESCE(e.event_timestamp, e.enriched_at) DESC NULLS LAST
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);
      
      // Execute query with timeout protection
      let result;
      try {
        result = await queryWithTimeout(query, params, 15000);
      } catch (queryError) {
        console.error('Explorer query error:', queryError);
        if (queryError.message === 'Query timeout') {
          return res.status(504).json({ 
            error: 'Query timeout', 
            message: 'The request took too long. Please try again with a smaller time range or limit.',
            success: false
          });
        }
        throw queryError;
      }
      
      // Helper function to calculate ETH value from token amounts
      const getEthValue = (event) => {
        // If value_eth exists and is > 0, use it
        if (event.value_eth && parseFloat(event.value_eth) > 0) {
          return parseFloat(event.value_eth);
        }
        
        // Try to calculate from token amounts (rough estimates)
        // USDC/USDT/DAI: ~$1 = ~0.0003 ETH (assuming ETH ~$3000)
        // WETH: 1:1 with ETH
        // WBTC: ~$95k = ~31.67 ETH (assuming ETH ~$3000)
        const ethPrice = 3000; // Approximate ETH price in USD
        
        if (event.token_in_amount && event.token_in_symbol) {
          const amount = parseFloat(event.token_in_amount);
          const symbol = event.token_in_symbol?.toUpperCase();
          
          if (symbol === 'WETH' || symbol === 'ETH') {
            return amount;
          } else if (symbol === 'USDC' || symbol === 'USDT' || symbol === 'DAI' || symbol === 'USDC.E') {
            return amount / ethPrice;
          } else if (symbol === 'WBTC') {
            return amount * 31.67; // Rough conversion
          }
        }
        
        if (event.token_out_amount && event.token_out_symbol) {
          const amount = parseFloat(event.token_out_amount);
          const symbol = event.token_out_symbol?.toUpperCase();
          
          if (symbol === 'WETH' || symbol === 'ETH') {
            return amount;
          } else if (symbol === 'USDC' || symbol === 'USDT' || symbol === 'DAI' || symbol === 'USDC.E') {
            return amount / ethPrice;
          } else if (symbol === 'WBTC') {
            return amount * 31.67;
          }
        }
        
        return 0;
      };
      
      // Return events with token data (no need to calculate ETH - frontend will show tokens)
      // Keep token_in/token_out data for public display
      // IMPORTANT: event_timestamp is now the actual on-chain block timestamp (from COALESCE)
      const enrichedData = result.rows.map(event => {
        return {
          ...event,
          // Ensure event_timestamp is included (it's already COALESCE'd with block_timestamp)
          event_timestamp: event.event_timestamp, // This is the actual on-chain time
          // Keep original value_eth for fallback, but frontend will prioritize token display
          value_eth: event.value_eth || 0
        };
      });
      
      let metadata = {};
      // Skip the heavy exact COUNT(*). The frontend only needs has_more for
      // pagination; an approximate "many more" is fine for the result count.
      // We only fetch the lightweight freshness aggregate (and only when not
      // in fast mode, so the first page stays as cheap as possible).
      const hasMore = enrichedData.length >= limit;
      // Provide an approximate total so existing UI strings keep working.
      // Use offset + page + 1 when more pages exist so "Showing X-Y of Z+"
      // never lies, and exact count when on the final page.
      let total = hasMore
        ? offset + enrichedData.length + 1
        : offset + enrichedData.length;
      if (!fastMode) {
        try {
          const freshnessResult = await queryWithTimeout(`
            SELECT MAX(e.event_timestamp) as most_recent,
                   COUNT(*) FILTER (WHERE e.event_timestamp > NOW() - INTERVAL '1 hour') as events_last_hour,
                   COUNT(*) FILTER (WHERE e.event_timestamp > NOW() - INTERVAL '24 hours') as events_last_24h
            FROM enriched_events e
            WHERE e.action_type IS NOT NULL
              AND e.action_type NOT IN ('UNKNOWN','RESERVE_DATA_UPDATED','TRANSFER','APPROVE','WRAP','UNWRAP')
              AND e.protocol_name IS NOT NULL AND e.protocol_name != 'Unknown'
              AND e.event_timestamp > NOW() - INTERVAL '24 hours'
          `, [], 5000);
          metadata = freshnessResult.rows[0] || {};
        } catch (metaErr) {
          console.error('Metadata query error:', metaErr);
        }
      }
      
      if (!fastMode && enrichedData.length > 0) {
        const webhookService = new WebhookService(db);
        
        // Filter events that should trigger webhooks
        const eventsToTrigger = enrichedData.filter(event => {
          const enrichedTime = event.enriched_at || event.enrichedAt;
          const eventTime = enrichedTime || event.event_timestamp || event.timestamp;
          
          if (eventTime) {
            const eventDate = new Date(eventTime);
            const timeWindow = 900000; // 15 minutes
            const timeAgo = new Date(Date.now() - timeWindow);
            return eventDate > timeAgo;
          }
          return false;
        });
        
        // Trigger webhooks with batching to avoid overwhelming the system
        if (eventsToTrigger.length > 0) {
          // Process in batches of 10 events at a time
          const batchSize = 10;
          (async () => {
            for (let i = 0; i < eventsToTrigger.length; i += batchSize) {
              const batch = eventsToTrigger.slice(i, i + batchSize);
              await Promise.allSettled(
                batch.map(event => 
                  webhookService.triggerWebhooks(event).catch(err => {
                    console.error('Webhook trigger error:', err);
                  })
                )
              );
              // Small delay between batches
              if (i + batchSize < eventsToTrigger.length) {
                await new Promise(resolve => setTimeout(resolve, 50));
              }
            }
          })().catch(err => {
            console.error('Webhook trigger batch error:', err);
          });
        }
      }
      
      const responsePayload = {
        success: true,
        count: enrichedData.length,
        limit,
        offset,
        tier: 'public',
        timeRange,
        metadata: {
          mostRecent: metadata.most_recent,
          eventsLastHour: parseInt(metadata.events_last_hour) || 0,
          eventsLast24h: parseInt(metadata.events_last_24h) || 0
        },
        message: 'Sign up for full access including wallet addresses, APY data, and detailed token info',
        data: enrichedData,
        pagination: {
          limit,
          offset,
          total,
          has_more: hasMore,
          approximate_total: hasMore
        }
      };
      explorerEventsCache.timestamp = Date.now();
      explorerEventsCache.data = responsePayload;
      explorerEventsCache.key = cacheKey;
      // Edge-cache the canonical first-page request; serve stale while revalidating
      // so warm visitors get an instant response from the Vercel CDN.
      if (fastMode && offset === 0 && !protocol && !actionType) {
        res.setHeader('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=60');
      } else {
        res.setHeader('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=30');
      }
      return res.status(200).json(responsePayload);
      } catch (error) {
        console.error('Explorer endpoint error:', error);
        return res.status(500).json({
          error: 'Internal server error',
          message: error.message || 'Failed to fetch explorer events',
          success: false
        });
      }
    }

    // =========================================================================
    // EXPORT ENDPOINT: /api/events/export (Public sample data - no auth required)
    // =========================================================================
    if (url.startsWith('/api/events/export') && method === 'GET') {
      const urlParams = new URL(req.url, 'http://localhost').searchParams;
      const format = urlParams.get('format') || 'csv';
      const requestedLimit = parseInt(urlParams.get('limit')) || 50;
      const limit = Math.min(Math.max(requestedLimit, 1), 500); // Up to 500 for paid export
      const apiKey = req.headers['x-api-key'];
      const paymentProof = req.headers['x-payment-proof'];
      const paymentNetwork = req.headers['x-payment-network'];

      // Metered pricing (free sample <= 100, paid beyond)
      const exportPrice = computeEventsExportPrice({ limit });

      // Enforce payment for larger exports unless user has a valid subscription
      // (We keep small exports free so landing pages can still offer a sample download.)
      if (exportPrice > 0) {
        let hasValidSubscription = false;
        let customerId = null;
        if (apiKey) {
          try {
            const dbTmp = getPool();
            const customerQuery = `
              SELECT c.id,
                     (SELECT COUNT(*) FROM subscriptions s WHERE s.customer_id = c.id AND s.status = 'active') as active_subs
              FROM customers c
              JOIN api_keys ak ON ak.customer_id = c.id
              WHERE ak.api_key = $1 AND ak.is_active = true
            `;
            const customerResult = await dbTmp.query(customerQuery, [apiKey]);
            if (customerResult.rows.length > 0) {
              customerId = customerResult.rows[0].id;
              hasValidSubscription = parseInt(customerResult.rows[0].active_subs) > 0;
            }
          } catch (e) {
            // If auth lookup fails, fall back to payment requirement for safety
          }
        }

        if (!hasValidSubscription) {
          let paymentHandled = false;

          // Check prepaid credits if customer has API key
          if (customerId) {
            const db = getPool();
            const creditsResult = await db.query('SELECT x402_prepaid_credits FROM customers WHERE id = $1', [customerId]);
            const credits = parseInt(creditsResult.rows[0]?.x402_prepaid_credits || 0);
            
            // Calculate credits needed using endpoint weight
            const creditsNeeded = getCreditWeight('/api/events/export');
            
            if (credits >= creditsNeeded) {
              // Use prepaid credits
              paymentHandled = true;
              const newCredits = credits - creditsNeeded;
              
              await db.query('UPDATE customers SET x402_prepaid_credits = $1 WHERE id = $2', [newCredits, customerId]);
              
              // Log credit usage
              try {
                const apiKeyResult = await db.query('SELECT id FROM api_keys WHERE api_key = $1', [apiKey]);
                const apiKeyId = apiKeyResult.rows[0]?.id;
                await db.query(`
                  INSERT INTO x402_prepaid_usage (customer_id, api_key_id, endpoint, credits_used, credits_before, credits_after)
                  VALUES ($1, $2, $3, $4, $5, $6)
                `, [customerId, apiKeyId, '/api/events/export', creditsNeeded, credits, newCredits]);
              } catch (e) {
                console.log('Credit usage logging skipped:', e.message);
              }
            } else if (credits > 0) {
              // Insufficient credits
              return res.status(402).json({
                error: 'Insufficient credits',
                message: `You have ${credits} credits, but this request requires ${creditsNeeded} credits.`,
                currentCredits: credits,
                required: creditsNeeded,
                prepaid: {
                  chargeAmount: PREPAID_CONFIG.chargeAmount,
                  creditsGranted: PREPAID_CONFIG.callsPerPayment,
                  instructions: `Send $${PREPAID_CONFIG.chargeAmount} USDC to automatically receive ${PREPAID_CONFIG.callsPerPayment} credits.`
                }
              });
            }
          }

          // Require X402 payment proof for paid export (only if payment not handled via credits)
          if (!paymentHandled) {
            if (!paymentProof || !paymentNetwork) {
              return generate402Response('/api/events/export', res, {
                price: exportPrice,
                params: { format: format, limit }
              });
            }

            // Verify payment
            const verification = await verifyX402Payment(
              paymentProof,
              paymentNetwork,
              exportPrice,
              '/api/events/export'
            );

            if (!verification.valid) {
              return res.status(402).json({
                error: 'Invalid payment',
                details: verification.error,
                required: exportPrice,
                currency: 'USDC'
              });
            }

            // Log X402 payment (best-effort)
            try {
              const dbLog = getPool();
              const agentId = req.headers['x-agent-id'] || null;
              const metadataHeader = req.headers['x-agent-metadata'];
              const metadata = metadataHeader ? JSON.parse(metadataHeader) : null;
              const confirmations = verification.confirmations || 1;

              await dbLog.query(
                `
                INSERT INTO x402_payments (tx_hash, network, amount_usdc, endpoint, customer_id, from_wallet, agent_id, metadata, confirmations)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (tx_hash) DO NOTHING
                `,
                [
                  paymentProof,
                  paymentNetwork,
                  verification.amount,
                  '/api/events/export',
                  customerId,
                  verification.from,
                  agentId,
                  metadata ? JSON.stringify(metadata) : null,
                  confirmations
                ]
              );
            } catch (e) {
              // Table might not exist yet; ignore
            }
          }
        }
      }
      
      const db = getPool();
      
      // Query enriched_events directly - only events that have been properly enriched
      // Filter out UNKNOWN action types and Unknown protocols
      const query = `
        SELECT 
          e.ref_tx_hash,
          e.action_type,
          e.protocol_name,
          e.origin_user,
          e.apy_percent,
          COALESCE(
            a.supply_apy_percent,
            CASE WHEN a.supply_apy_bps IS NOT NULL THEN a.supply_apy_bps::NUMERIC / 100.0 ELSE NULL END
          ) as supply_apy_percent,
          e.asset_symbol,
          e.value_eth,
          e.token_in_symbol,
          e.token_in_amount,
          e.token_out_symbol,
          e.token_out_amount,
          COALESCE(e.event_timestamp, a.block_timestamp, a.server_timestamp, e.enriched_at) as event_timestamp,
          a.block_timestamp,
          a.server_timestamp
        FROM enriched_events e
        LEFT JOIN aave_events a ON a.full_data->'fullData'->'tx'->>'refTx' = e.ref_tx_hash
        WHERE e.action_type IS NOT NULL
          AND e.action_type != 'UNKNOWN'
          AND e.protocol_name IS NOT NULL
          AND e.protocol_name != 'Unknown'
          AND LOWER(e.protocol_name) != 'unknown'
        ORDER BY COALESCE(e.event_timestamp, a.block_timestamp, a.server_timestamp, e.enriched_at) DESC NULLS LAST
        LIMIT $1
      `;
      
      const result = await db.query(query, [Math.min(limit, 500)]);
      
      // Process events - all should already be filtered by SQL query
      // Use actual block timestamp from aave_events (real on-chain transaction time)
      const events = result.rows.map(row => {
        // event_timestamp is now COALESCE'd with block_timestamp, so it should be the actual on-chain time
        const timestamp = row.event_timestamp || row.block_timestamp || row.server_timestamp || row.enriched_at;
        let apyValue = row.supply_apy_percent;
        if (apyValue === null && row.supply_apy_bps !== null) {
          apyValue = row.supply_apy_bps / 100.0;
        }
        const apySymbol = (row.asset_symbol || row.token_in_symbol || row.token_out_symbol || '').toUpperCase();
        const allowLowApy = apySymbol === 'WBTC';
        // Filter out 0.01/0.02% values unless it's WBTC
        if (apyValue !== null && apyValue < 0.1 && !allowLowApy) {
          apyValue = null;
        }
        // Fallback to e.apy_percent if still null (allow low APYs like WBTC)
        if (apyValue === null && row.apy_percent !== null && row.apy_percent !== undefined) {
          const fallbackApy = parseFloat(row.apy_percent);
          if (fallbackApy >= 0.1 || allowLowApy) {
            apyValue = fallbackApy;
          }
        }
        
        return {
          action_type: row.action_type || '',
          protocol_name: row.protocol_name || '',
          origin_user: row.origin_user || '',
          ref_tx_hash: row.ref_tx_hash || '',
          timestamp: timestamp ? new Date(timestamp).toISOString() : '',
          apy_percent: apyValue,
          asset_symbol: row.asset_symbol || '',
          value_eth: row.value_eth || null,
          token_in_symbol: row.token_in_symbol || '',
          token_in_amount: row.token_in_amount || null,
          token_out_symbol: row.token_out_symbol || '',
          token_out_amount: row.token_out_amount || null
        };
      });
      
      if (format.toLowerCase() === 'csv') {
        // Generate CSV with sales message header
        const salesMessage = [
          '# Defeyes Onchain Insights - Sample Data Export',
          '#',
          '# INCLUDED IN THIS SAMPLE:',
          '# - Action Type (SUPPLY, BORROW, SWAP, FLASH_LOAN, etc.)',
          '# - Protocol Name (Aave, CoW Protocol, GMX, etc.)',
          '# - Origin Wallet Address (actual user wallet)',
          '# - Transaction Hash',
          '# - Timestamp',
          '#',
          '# AVAILABLE IN PRO TIER ($199/month):',
          '# - APY % (interest rates at time of transaction)',
          '# - Asset Symbols (ETH, USDC, WETH, etc.)',
          '# - Transaction Values (ETH amounts)',
          '# - Token Swap Details (Token In/Out, amounts)',
          '# - Gas Usage & Costs',
          '# - Full Historical Data (unlimited exports)',
          '# - Wallet Personas & Behavioral Analytics',
          '# - Real-time API Access (5,000+ req/hour)',
          '#',
          '# Upgrade at: https://defeyes.com/pricing',
          '# API Docs: https://defeyes.com/docs',
          '#',
          '# --- DATA STARTS BELOW ---',
          ''
        ].join('\n');
        
        const headers = ['Action Type', 'Protocol', 'Origin Wallet', 'Transaction Hash', 'Timestamp', 'APY %', 'Asset', 'Value (ETH)', 'Token In', 'Amount In', 'Token Out', 'Amount Out'];
        const rows = events.map(event => {
          // Prioritize non-Aave protocols when multiple protocols are involved
          let displayProtocolName = event.protocol_name || '';
          if (displayProtocolName && displayProtocolName.includes(' + ')) {
            const protocols = displayProtocolName.split(' + ');
            const aaveNames = ['Aave V3 Pool', 'Aave V3', 'Aave', 'Aave Pool', 
                               'Aave Wrapped Token Gateway', 'Aave Wrapped Token Gateway V3',
                               'Aave V3 WETH Gateway', 'Aave Pool Addresses Provider'];
            const nonAaveProtocols = protocols.filter(p => !aaveNames.includes(p.trim()));
            if (nonAaveProtocols.length > 0) {
              displayProtocolName = nonAaveProtocols[0].trim();
            }
          }
          return [
            event.action_type || '',
            displayProtocolName,
            event.origin_user || '',
            event.ref_tx_hash || '',
            event.timestamp || '',
            event.apy_percent ? event.apy_percent.toFixed(2) : '',
            event.asset_symbol || '',
            event.value_eth ? event.value_eth.toFixed(6) : '',
            event.token_in_symbol || '',
            event.token_in_amount ? event.token_in_amount.toFixed(6) : '',
            event.token_out_symbol || '',
            event.token_out_amount ? event.token_out_amount.toFixed(6) : ''
          ];
        });
        
        const csvContent = [
          salesMessage,
          headers.join(','),
          ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        ].join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="defeyes-sample-events-${new Date().toISOString().split('T')[0]}.csv"`);
        return res.status(200).send(csvContent);
      } else {
        // JSON format with sales message
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="defeyes-sample-events-${new Date().toISOString().split('T')[0]}.json"`);
        return res.status(200).json({
          success: true,
          count: events.length,
          format: 'json',
          message: 'Sample Data Export - Free Tier',
          included: [
            'Action Type (SUPPLY, BORROW, SWAP, FLASH_LOAN, etc.)',
            'Protocol Name (Aave, CoW Protocol, GMX, etc.)',
            'Origin Wallet Address (actual user wallet)',
            'Transaction Hash',
            'Timestamp'
          ],
          available_in_pro_tier: [
            'APY % (interest rates at time of transaction)',
            'Asset Symbols (ETH, USDC, WETH, etc.)',
            'Transaction Values (ETH amounts)',
            'Token Swap Details (Token In/Out, amounts)',
            'Gas Usage & Costs',
            'Full Historical Data (unlimited exports)',
            'Wallet Personas & Behavioral Analytics',
            'Real-time API Access (10,000+ req/hour)'
          ],
          upgrade_url: 'https://defeyes.com/pricing',
          api_docs: 'https://defeyes.com/docs',
          data: events
        });
      }
    }

    // =========================================================================
    // FREE TIER SIGNUP (No payment required)
    // =========================================================================
    if (url === '/api/signup/free' && method === 'POST') {
      const { email, password, name, company } = req.body || {};

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      // Name is optional for free tier - use email prefix if not provided
      const customerName = name || email.split('@')[0] || 'User';

      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }

      const db = getPool();

      // Check if email already exists
      const existingUser = await db.query('SELECT id FROM customers WHERE LOWER(email) = LOWER($1)', [email]);
      if (existingUser.rows.length > 0) {
        return res.status(400).json({ error: 'An account with this email already exists. Please login instead.' });
      }

      // Hash password
      const passwordHash = hashPassword(password);

      // Create customer (no Stripe ID for free tier)
      const customer = await createCustomer(email, customerName, company, null, passwordHash);
      
      // Generate API key with free tier rate limit (50 req/hour)
      const apiKey = await createApiKey(customer.id);

      // Update API key with free tier rate limit (50 req/hour)
      await db.query('UPDATE api_keys SET rate_limit_requests = 50 WHERE id = $1', [apiKey.id]);

      return res.status(200).json({
        success: true,
        message: 'Account created successfully! You can now use the API.',
        customer: {
          id: customer.id,
          email: customer.email,
          name: customer.name
        },
        apiKey: apiKey.api_key,
        plan: 'free',
        limits: {
          requestsPerHour: 50,
          note: 'Upgrade to Developer ($49/mo) or Pro ($199/mo) for higher limits'
        }
      });
    }

    // =========================================================================
    // ADMIN: Fix credits and trigger sweep (temporary — secured by admin secret)
    // =========================================================================
    if (url === '/api/admin/fix-credits' && method === 'POST') {
      const adminSecret = process.env.ADMIN_SECRET || process.env.X402_WALLET_SECRET;
      const { secret, walletAddress, correctCredits, triggerSweep, network } = req.body || {};
      
      if (!secret || secret !== adminSecret) {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      const db = getPool();
      
      // Find customer by wallet address
      const customerResult = await db.query(
        'SELECT id, email, x402_prepaid_credits, x402_wallet_address, x402_wallet_encrypted_key FROM customers WHERE LOWER(x402_wallet_address) = LOWER($1)',
        [walletAddress]
      );
      
      if (customerResult.rows.length === 0) {
        return res.status(404).json({ error: 'Customer not found for this wallet' });
      }
      
      const customer = customerResult.rows[0];
      const results = { customerId: customer.id, email: customer.email, before: parseInt(customer.x402_prepaid_credits || 0) };
      
      // Fix credits if specified
      if (correctCredits !== undefined) {
        await db.query('UPDATE customers SET x402_prepaid_credits = $1 WHERE id = $2', [correctCredits, customer.id]);
        results.creditsSetTo = correctCredits;
      }
      
      // Clean up duplicate pending_sweep records
      await db.query(
        "DELETE FROM x402_prepaid_payments WHERE customer_id = $1 AND status = 'pending_sweep'",
        [customer.id]
      );
      results.cleanedPendingSweeps = true;
      
      // Trigger sweep: fund gas from master wallet -> wait -> sweep USDC back
      if (triggerSweep && network) {
        try {
          const sweepNetwork = network || 'arbitrum';
          const networkConfig = X402_CONFIG.networks[sweepNetwork];
          const provider = new ethers.providers.JsonRpcProvider(networkConfig.rpc);
          const usdcContract = new ethers.Contract(networkConfig.usdc, [
            'function balanceOf(address account) view returns (uint256)',
            'function transfer(address to, uint256 amount) returns (bool)'
          ], provider);
          
          const balance = await usdcContract.balanceOf(customer.x402_wallet_address);
          const balanceUsdc = Number(ethers.utils.formatUnits(balance, 6));
          results.usdcBalance = balanceUsdc;
          
          if (balanceUsdc > 0 && customer.x402_wallet_encrypted_key) {
            // Step 1: Check if deposit wallet needs gas — use EIP-1559 fees (not legacy gasPrice)
            const ethBalance = await provider.getBalance(customer.x402_wallet_address);
            const feeData = await provider.getFeeData();
            const effectiveGasPrice = feeData.maxFeePerGas || feeData.gasPrice;
            const sweepGasNeeded = effectiveGasPrice.mul(100000);
            const minGas = sweepGasNeeded.mul(2); // 2x buffer
            results.depositWalletEth = ethers.utils.formatEther(ethBalance);
            results.effectiveGasPrice = ethers.utils.formatUnits(effectiveGasPrice, 'gwei') + ' gwei';
            results.sweepCostEstimate = ethers.utils.formatEther(sweepGasNeeded) + ' ETH';
            results.hasEnoughGas = ethBalance.gte(minGas);
            
            if (ethBalance.lt(minGas)) {
              // Fund gas — 3x sweep cost
              const masterWalletKey = (process.env.MASTER_WALLET_PRIVATE_KEY || '').trim();
              if (!masterWalletKey) {
                results.sweepResult = { success: false, reason: 'MASTER_WALLET_PRIVATE_KEY not set' };
              } else {
                const fundAmount = sweepGasNeeded.mul(3);
                const masterWallet = new ethers.Wallet(masterWalletKey, provider);
                const gasTx = await masterWallet.sendTransaction({ to: customer.x402_wallet_address, value: fundAmount });
                const gasReceipt = await gasTx.wait();
                // Use a fresh provider to ensure balance is updated
                await new Promise(r => setTimeout(r, 1000)); // 1s delay for state propagation
                results.gasFunded = { txHash: gasTx.hash, amount: ethers.utils.formatEther(fundAmount) + ' ETH', network: sweepNetwork };
              }
            } else {
              results.gasFunded = { status: 'already has gas' };
            }
            
            // Step 2: Sweep USDC from deposit wallet to platform wallet
            const encryptedKey = JSON.parse(customer.x402_wallet_encrypted_key);
            const privateKey = decryptPrivateKey(encryptedKey);
            // Create a fresh provider connection to ensure updated balance
            const freshProvider = new ethers.providers.JsonRpcProvider(networkConfig.rpc);
            const depositWallet = new ethers.Wallet(privateKey, freshProvider);
            const contractWithSigner = usdcContract.connect(depositWallet);
            const amountWei = ethers.utils.parseUnits(balanceUsdc.toFixed(6), 6);
            
            const tx = await contractWithSigner.transfer(X402_CONFIG.paymentWallet, amountWei, { gasLimit: 100000 });
            const receipt = await tx.wait();
            results.sweepResult = { success: true, txHash: tx.hash, amount: balanceUsdc, network: sweepNetwork };
            
            // Drain leftover ETH back to master wallet
            try {
              const masterWalletKey = (process.env.MASTER_WALLET_PRIVATE_KEY || '').trim();
              if (masterWalletKey) {
                const masterWallet = new ethers.Wallet(masterWalletKey, provider);
                const remEth = await provider.getBalance(customer.x402_wallet_address);
                const drainFeeData = await provider.getFeeData();
                const drainGasPrice = drainFeeData.maxFeePerGas || drainFeeData.gasPrice;
                const drainCost = drainGasPrice.mul(21000).mul(3);
                if (remEth.gt(drainCost)) {
                  const drainAmount = remEth.sub(drainGasPrice.mul(21000).mul(2));
                  const drainTx = await depositWallet.sendTransaction({
                    to: masterWallet.address,
                    value: drainAmount,
                    gasLimit: 21000
                  });
                  await drainTx.wait();
                  results.ethDrained = { txHash: drainTx.hash, amount: ethers.utils.formatEther(drainAmount) };
                  console.log(`[AdminSweep] ETH drained to master: ${drainTx.hash} (${ethers.utils.formatEther(drainAmount)} ETH)`);
                }
              }
            } catch (drainErr) {
              console.warn('[AdminSweep] ETH drain failed:', drainErr.message);
              results.ethDrainError = drainErr.message;
            }
            
            // Log as confirmed
            await db.query(`
              INSERT INTO x402_prepaid_payments 
              (customer_id, tx_hash, network, amount_usdc, credits_granted, from_wallet, to_wallet, confirmations, status, verified_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, 1, 'confirmed', NOW())
              ON CONFLICT (tx_hash) DO NOTHING
            `, [customer.id, tx.hash, sweepNetwork, balanceUsdc, correctCredits || 0, customer.x402_wallet_address, X402_CONFIG.paymentWallet]);
            
            // Clean pending_sweep since we've actually swept
            await db.query("DELETE FROM x402_prepaid_payments WHERE customer_id = $1 AND status = 'pending_sweep'", [customer.id]);
          } else {
            results.sweepResult = { success: false, reason: 'No USDC to sweep or no wallet key' };
          }
        } catch (err) {
          results.sweepError = err.message;
        }
      }
      
      // Insert a pending_sweep record to prevent auto-grant from double-crediting
      // (the correct credits are already set above)
      if (correctCredits !== undefined) {
        const depositHash = crypto.createHash('sha256').update(`${walletAddress}-manual-fix-${correctCredits}`).digest('hex').slice(0, 40);
        await db.query(`
          INSERT INTO x402_prepaid_payments 
          (customer_id, tx_hash, network, amount_usdc, credits_granted, from_wallet, to_wallet, confirmations, status, verified_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, 1, 'pending_sweep', NOW())
          ON CONFLICT (tx_hash) DO NOTHING
        `, [customer.id, `dep-${depositHash}`, network || 'arbitrum', (correctCredits || 0) / 1000, correctCredits || 0, walletAddress, X402_CONFIG.paymentWallet]);
      }
      
      // Get final state
      const finalResult = await db.query('SELECT x402_prepaid_credits FROM customers WHERE id = $1', [customer.id]);
      results.finalCredits = parseInt(finalResult.rows[0]?.x402_prepaid_credits || 0);
      
      return res.status(200).json({ success: true, ...results });
    }

    // =========================================================================
    // CRON: Auto-sweep ALL deposit wallets (grant credits + sweep USDC + drain ETH)
    // Call via cron every 2-5 min: GET /api/cron/sweep-all?secret=CRON_SECRET
    // Or manually: POST /api/cron/sweep-all { secret }
    // =========================================================================
    if ((path === '/api/cron/sweep-all') && (method === 'GET' || method === 'POST')) {
      const cronSecret = queryParams.secret || req.headers['authorization'] || (req.body && req.body.secret);
      const expectedSecret = process.env.CRON_SECRET || process.env.ADMIN_SECRET || process.env.X402_WALLET_SECRET;
      if (!expectedSecret || (cronSecret !== expectedSecret && cronSecret !== `Bearer ${expectedSecret}`)) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const masterWalletKey = (process.env.MASTER_WALLET_PRIVATE_KEY || '').trim();
      if (!masterWalletKey) {
        return res.status(500).json({ error: 'MASTER_WALLET_PRIVATE_KEY not set' });
      }

      const db = getPool();
      const wallets = await db.query(`
        SELECT c.id, c.email, c.x402_wallet_address, c.x402_wallet_encrypted_key
        FROM customers c
        WHERE c.x402_wallet_address IS NOT NULL AND c.x402_wallet_encrypted_key IS NOT NULL AND c.x402_enabled = true
      `);

      const summary = { checked: wallets.rows.length, granted: [], swept: [], drained: [], skipped: [], errors: [] };

      // --- Phase 1: Parallel balance scan (fast — ~2s for all wallets) ---
      const balanceChecks = [];
      for (const cust of wallets.rows) {
        for (const [netKey, netConfig] of Object.entries(X402_CONFIG.networks)) {
          balanceChecks.push(
            (async () => {
              try {
                const provider = new ethers.providers.JsonRpcProvider(netConfig.rpc);
                const usdcContract = new ethers.Contract(netConfig.usdc, ['function balanceOf(address) view returns (uint256)'], provider);
                const [usdcBal, ethBal] = await Promise.all([
                  usdcContract.balanceOf(cust.x402_wallet_address),
                  provider.getBalance(cust.x402_wallet_address)
                ]);
                return { cust, netKey, netConfig, usdcBal: Number(ethers.utils.formatUnits(usdcBal, 6)), ethBal, provider };
              } catch (e) {
                return { cust, netKey, netConfig, usdcBal: 0, ethBal: ethers.BigNumber.from(0), error: e.message };
              }
            })()
          );
        }
      }
      const allBalances = await Promise.all(balanceChecks);

      // --- Phase 2: Process only wallets that need action (sequential, but few) ---
      for (const b of allBalances) {
        if (b.error) { summary.errors.push({ wallet: b.cust.x402_wallet_address, network: b.netKey, error: b.error }); continue; }
        const { cust, netKey, netConfig, usdcBal, ethBal, provider } = b;

        try {
          // Nothing to do — skip
          if (usdcBal < 0.01) {
            // Check if leftover ETH worth draining
            const feeData = await provider.getFeeData();
            const gp = feeData.maxFeePerGas || feeData.gasPrice;
            if (ethBal.gt(gp.mul(21000).mul(3))) {
              const encKey = JSON.parse(cust.x402_wallet_encrypted_key);
              const pk = decryptPrivateKey(encKey);
              const dw = new ethers.Wallet(pk, provider);
              const drainAmt = ethBal.sub(gp.mul(21000).mul(3).div(2));
              if (drainAmt.gt(0)) {
                const tx = await dw.sendTransaction({ to: new ethers.Wallet(masterWalletKey).address, value: drainAmt, gasLimit: 21000 });
                summary.drained.push({ wallet: cust.x402_wallet_address, network: netKey, amount: ethers.utils.formatEther(drainAmt), txHash: tx.hash });
              }
            }
            continue;
          }

          // --- Grant credits ---
          if (usdcBal >= 5.0) {
            try {
              const gr = await autoGrantCreditsFromWallet(cust.id, netKey);
              if (gr.granted) summary.granted.push({ wallet: cust.x402_wallet_address, network: netKey, amount: gr.amount, credits: gr.creditsGranted });
            } catch (ge) { console.warn('[SweepAll] Grant:', ge.message); }
          }

          // --- Sweep ---
          const pendingResult = await db.query(
            "SELECT id FROM x402_prepaid_payments WHERE customer_id = $1 AND network = $2 AND status = 'pending_sweep' LIMIT 1",
            [cust.id, netKey]
          );
          if (pendingResult.rows.length === 0) {
            summary.skipped.push({ wallet: cust.x402_wallet_address, network: netKey, reason: 'no pending_sweep' });
            continue;
          }

          const encKey = JSON.parse(cust.x402_wallet_encrypted_key);
          const privateKey = decryptPrivateKey(encKey);
          let depositWallet = new ethers.Wallet(privateKey, provider);

          // Fund gas if needed
          const feeData = await provider.getFeeData();
          const effectiveGasPrice = feeData.maxFeePerGas || feeData.gasPrice;
          const sweepGasNeeded = effectiveGasPrice.mul(100000);
          if (ethBal.lt(sweepGasNeeded.mul(2))) {
            const masterWallet = new ethers.Wallet(masterWalletKey, provider);
            const gasTx = await masterWallet.sendTransaction({ to: cust.x402_wallet_address, value: sweepGasNeeded.mul(3) });
            await gasTx.wait();
            const fp = new ethers.providers.JsonRpcProvider(netConfig.rpc);
            depositWallet = new ethers.Wallet(privateKey, fp);
          }

          // Sweep USDC
          const sweepContract = new ethers.Contract(netConfig.usdc, [
            'function balanceOf(address) view returns (uint256)',
            'function transfer(address to, uint256 amount) returns (bool)'
          ], depositWallet);
          const freshBal = await sweepContract.balanceOf(cust.x402_wallet_address);
          const freshUsdc = Number(ethers.utils.formatUnits(freshBal, 6));
          if (freshUsdc < 0.01) {
            await db.query("UPDATE x402_prepaid_payments SET status = 'confirmed' WHERE id = $1", [pendingResult.rows[0].id]);
            continue;
          }
          const tx = await sweepContract.transfer(X402_CONFIG.paymentWallet, ethers.utils.parseUnits(freshUsdc.toFixed(6), 6), { gasLimit: 100000 });
          await db.query("UPDATE x402_prepaid_payments SET tx_hash = $1, status = 'confirmed' WHERE id = $2", [tx.hash, pendingResult.rows[0].id]);
          summary.swept.push({ wallet: cust.x402_wallet_address, network: netKey, amount: freshUsdc, txHash: tx.hash });

          // Drain leftover ETH (fire-and-forget)
          try {
            const remEth = await provider.getBalance(cust.x402_wallet_address);
            const drainGP = (await provider.getFeeData()).maxFeePerGas || effectiveGasPrice;
            if (remEth.gt(drainGP.mul(21000).mul(3))) {
              const drainTx = await depositWallet.sendTransaction({
                to: new ethers.Wallet(masterWalletKey).address,
                value: remEth.sub(drainGP.mul(21000).mul(3).div(2)),
                gasLimit: 21000
              });
              summary.drained.push({ wallet: cust.x402_wallet_address, network: netKey, amount: ethers.utils.formatEther(remEth.sub(drainGP.mul(21000).mul(3).div(2))), txHash: drainTx.hash });
            }
          } catch (de) { /* non-critical */ }

        } catch (err) {
          console.error(`[SweepAll] ${cust.x402_wallet_address} ${netKey}:`, err.message);
          summary.errors.push({ wallet: cust.x402_wallet_address, network: netKey, error: err.message });
        }
      }

      return res.status(200).json({ success: true, ...summary });
    }

    // =========================================================================
    // ADMIN: Batch drain ETH from all deposit wallets back to master
    // Call manually or via cron: POST /api/admin/drain-eth { secret }
    // =========================================================================
    if (url === '/api/admin/drain-eth' && method === 'POST') {
      const adminSecret = process.env.ADMIN_SECRET || process.env.X402_WALLET_SECRET;
      const { secret } = req.body || {};
      if (!secret || secret !== adminSecret) {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      const masterWalletKey = (process.env.MASTER_WALLET_PRIVATE_KEY || '').trim();
      if (!masterWalletKey) {
        return res.status(500).json({ error: 'MASTER_WALLET_PRIVATE_KEY not set' });
      }
      
      const db = getPool();
      // Exclude wallets with pending_sweep — they need ETH to complete the sweep
      const wallets = await db.query(`
        SELECT c.id, c.email, c.x402_wallet_address, c.x402_wallet_encrypted_key
        FROM customers c
        WHERE c.x402_wallet_address IS NOT NULL AND c.x402_wallet_encrypted_key IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM x402_prepaid_payments p
          WHERE p.customer_id = c.id AND p.status = 'pending_sweep'
        )
      `);
      
      const results = { walletsChecked: wallets.rows.length, drained: [], skipped: [], errors: [], totalRecovered: {} };
      
      for (const cust of wallets.rows) {
        for (const [netName, netConfig] of Object.entries(X402_CONFIG.networks)) {
          try {
            const provider = new ethers.providers.JsonRpcProvider(netConfig.rpc);
            const balance = await provider.getBalance(cust.x402_wallet_address);
            
            // Use EIP-1559 fee data to calculate if drain is worthwhile
            const feeData = await provider.getFeeData();
            const gasPrice = feeData.maxFeePerGas || feeData.gasPrice;
            // Arbitrum needs higher gas for L1 data posting; use 50000 to be safe
            const gasLimit = netName === 'arbitrum' ? 50000 : 21000;
            const gasCost = gasPrice.mul(gasLimit);
            const minDrain = gasCost.mul(3); // Only drain if balance > 3x gas cost (profitable)
            
            if (balance.lte(minDrain)) {
              results.skipped.push({ wallet: cust.x402_wallet_address, network: netName, balance: ethers.utils.formatEther(balance), reason: 'dust' });
              continue;
            }
            
            const encryptedKey = JSON.parse(cust.x402_wallet_encrypted_key);
            const privateKey = decryptPrivateKey(encryptedKey);
            const depositWallet = new ethers.Wallet(privateKey, provider);
            const masterWallet = new ethers.Wallet(masterWalletKey, provider);
            
            // Leave 1.5x gas cost as buffer, drain the rest
            const drainAmount = balance.sub(gasCost.mul(3).div(2));
            
            if (drainAmount.lte(0)) {
              results.skipped.push({ wallet: cust.x402_wallet_address, network: netName, reason: 'balance too low after gas' });
              continue;
            }
            
            const tx = await depositWallet.sendTransaction({
              to: masterWallet.address,
              value: drainAmount,
              gasLimit: gasLimit,
              gasPrice: gasPrice
            });
            
            const ethDrained = ethers.utils.formatEther(drainAmount);
            console.log(`[DrainETH] ${cust.x402_wallet_address} on ${netName}: ${ethDrained} ETH -> master (${tx.hash})`);
            results.drained.push({ wallet: cust.x402_wallet_address, email: cust.email, network: netName, amount: ethDrained, txHash: tx.hash });
            results.totalRecovered[netName] = (parseFloat(results.totalRecovered[netName] || 0) + parseFloat(ethDrained)).toFixed(8);
          } catch (err) {
            results.errors.push({ wallet: cust.x402_wallet_address, network: netName, error: err.message });
          }
        }
      }
      
      return res.status(200).json({ success: true, ...results });
    }

    // =========================================================================
    // USDC PRO PAY-AS-YOU-GO SIGNUP (Create account + generate deposit wallet)
    // =========================================================================
    if (url === '/api/signup/usdc' && method === 'POST') {
      const { email, password, name, company } = req.body || {};

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const customerName = name || email.split('@')[0] || 'User';

      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }

      const db = getPool();

      // Check if email already exists
      const existingUser = await db.query('SELECT id, x402_wallet_address FROM customers WHERE LOWER(email) = LOWER($1)', [email]);
      if (existingUser.rows.length > 0) {
        if (existingUser.rows[0].x402_wallet_address) {
          return res.status(400).json({ 
            error: 'An account with this email already exists. Please login instead.',
            walletAddress: existingUser.rows[0].x402_wallet_address 
          });
        }
        return res.status(400).json({ error: 'An account with this email already exists. Please login instead.' });
      }

      // Hash password
      const passwordHash = hashPassword(password);

      // Create customer
      const customer = await createCustomer(email, customerName, company, null, passwordHash);

      // Generate API key with Pro-level rate limit (pay-as-you-go gets Pro access)
      const apiKey = await createApiKey(customer.id);
      const proRateLimit = 5000; // Pro-level: 5,000 req/hr
      await db.query('UPDATE api_keys SET rate_limit_requests = $1 WHERE id = $2', [proRateLimit, apiKey.id]);

      // Generate deposit wallet for the user
      let walletAddress = null;
      let walletError = null;

      try {
        const wallet = generateCustomerWallet(customer.id);
        const encryptedKey = encryptPrivateKey(wallet.privateKey);

        // Save wallet to database and enable pay-per-go
        await db.query(`
          UPDATE customers 
          SET x402_enabled = TRUE,
              x402_wallet_address = $1,
              x402_wallet_encrypted_key = $2
          WHERE id = $3
        `, [wallet.address, JSON.stringify(encryptedKey), customer.id]);

        walletAddress = wallet.address;

        // NOTE: No pre-funding gas at signup. Gas is funded on-demand by autoGrantCreditsFromWallet
        // when a USDC deposit is detected. This saves 0.0002 ETH × 2 networks per signup.
        console.log(`[USDC Signup] Wallet created: ${wallet.address} (gas will be funded on first deposit)`);
      } catch (err) {
        console.error('[USDC Signup] Wallet generation failed:', err.message);
        walletError = err.message;
      }

      return res.status(200).json({
        success: true,
        message: walletAddress 
          ? 'Pro Pay-As-You-Go account created! Deposit USDC to start.'
          : 'Account created! Wallet generation pending.',
        customer: {
          id: customer.id,
          email: customer.email,
          name: customer.name
        },
        apiKey: apiKey.api_key,
        plan: 'pro-paygo',
        wallet: walletAddress ? {
          address: walletAddress,
          networks: [
            { name: 'Base', chainId: 8453 },
            { name: 'Arbitrum One', chainId: 42161 }
          ],
          currency: 'USDC',
          minDeposit: 5,
          creditsPerDollar: 1000,
          costPerRequest: 0.001
        } : null,
        walletError: walletError,
        pricing: {
          creditsPerDollar: 1000,
          costPerRequest: '$0.001',
          note: 'Deposit any amount of USDC. Auto-converted to credits. 1,000 credits per $1.'
        },
        access: {
          level: 'pro',
          rateLimit: proRateLimit,
          features: ['Unlimited endpoints', 'Full dataset access', 'Real-time webhooks', 'CSV/JSON exports']
        }
      });
    }

    // =========================================================================
    // PAID TIER SIGNUP (Stripe Checkout)
    // =========================================================================
    // Create customer and Stripe Checkout session
    if (url === '/api/payments/create-customer' && method === 'POST') {
      const { email, password, name, company, plan, interval } = req.body || {};

      if (!email || !name) {
        return res.status(400).json({ error: 'Email and name are required' });
      }

      // Hash password if provided
      const passwordHash = password ? hashPassword(password) : null;

      // Determine billing interval (default to 'month' if not provided)
      const billingInterval = (interval === 'year' || interval === 'yearly') ? 'year' : 'month';

      // Determine price based on plan and interval
      const plans = {
        developer: {
          month: { name: 'Defeyes Developer', price: 4900, interval: 'month' },  // $49/month
          year: { name: 'Defeyes Developer (Annual)', price: 47000, interval: 'year' }  // $470/year
        },
        pro: {
          month: { name: 'Defeyes Pro', price: 19900, interval: 'month' },  // $199/month
          year: { name: 'Defeyes Pro (Annual)', price: 199000, interval: 'year' }  // $1,990/year
        }
      };
      
      // Get the selected plan based on plan type and billing interval
      const planType = plans[plan] || plans.pro;
      const selectedPlan = planType[billingInterval] || planType.month;

      // Create Stripe customer
      const stripeCustomer = await stripe.customers.create({
        email: email,
        name: name,
        metadata: {
          company: company || '',
          plan: plan || 'pro',
          source: 'defeyes-website'
        }
      });

      // Create customer in our database with Stripe ID and password
      const customer = await createCustomer(email, name, company, stripeCustomer.id, passwordHash);
      
      // Generate API key (will be activated after payment)
      const apiKey = await createApiKey(customer.id);

      // Create Stripe Checkout Session with inline pricing
      const session = await stripe.checkout.sessions.create({
        customer: stripeCustomer.id,
        customer_email: email, // Pre-fill email (already in customer, but explicit is better)
        payment_method_types: ['card'],
        billing_address_collection: 'required', // Stripe will collect address but name/email are pre-filled
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: selectedPlan.name,
              description: `Access to Defeyes DeFi Intelligence API - ${plan === 'developer' ? '500 req/hour' : '5,000 req/hour'}`,
            },
            unit_amount: selectedPlan.price,
            recurring: {
              interval: selectedPlan.interval,
            },
          },
          quantity: 1,
        }],
        mode: 'subscription',
        success_url: `https://defeyes.com/dashboard?session_id={CHECKOUT_SESSION_ID}&api_key=${apiKey.api_key}`,
        cancel_url: 'https://defeyes.com/payment?cancelled=true',
        metadata: {
          customer_id: customer.id.toString(),
          api_key: apiKey.api_key
        }
      });

      return res.status(200).json({
        success: true,
        customer,
        stripeCustomerId: stripeCustomer.id,
        checkoutUrl: session.url,
        message: 'Redirecting to payment...'
      });
    }

    // =========================================================================
    // UPGRADE EXISTING USER (Stripe Checkout)
    // =========================================================================
    if (url === '/api/payments/create-checkout' && method === 'POST') {
      const apiKey = req.headers['x-api-key'];
      if (!apiKey) {
        return res.status(401).json({ error: 'API key required' });
      }

      const { plan, email, interval } = req.body || {};
      if (!plan) {
        return res.status(400).json({ error: 'Plan is required (developer or pro)' });
      }

      const db = getPool();

      // Get customer from API key
      const customerQuery = `
        SELECT c.id, c.email, c.name, c.stripe_customer_id
        FROM customers c
        JOIN api_keys ak ON ak.customer_id = c.id
        WHERE ak.api_key = $1 AND ak.is_active = true
      `;
      const customerResult = await db.query(customerQuery, [apiKey]);

      if (customerResult.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid API key' });
      }

      const customer = customerResult.rows[0];
      const customerEmail = email || customer.email;

      // Determine billing interval (default to 'month' if not provided)
      const billingInterval = (interval === 'year' || interval === 'yearly') ? 'year' : 'month';

      // Get Price ID from subscription_plans table
      const planQuery = `
        SELECT id, stripe_price_id, name, billing_interval, price_cents
        FROM subscription_plans 
        WHERE LOWER(name) = LOWER($1) AND billing_interval = $2
        LIMIT 1
      `;
      const planResult = await db.query(planQuery, [plan, billingInterval]);
      
      if (planResult.rows.length === 0) {
        return res.status(400).json({ 
          error: `Price ID not configured for ${plan} (${billingInterval}). Please add stripe_price_id to subscription_plans table.` 
        });
      }
      
      const selectedPlan = planResult.rows[0];
      const priceId = selectedPlan.stripe_price_id;

      // Get or create Stripe customer
      let stripeCustomerId = customer.stripe_customer_id;
      if (!stripeCustomerId) {
        const stripeCustomer = await stripe.customers.create({
          email: customerEmail,
          name: customer.name,
          metadata: {
            customer_id: customer.id.toString(),
            source: 'defeyes-upgrade'
          }
        });
        stripeCustomerId = stripeCustomer.id;
        
        // Update customer with Stripe ID
        await db.query('UPDATE customers SET stripe_customer_id = $1 WHERE id = $2', [stripeCustomerId, customer.id]);
      }

      // Create Stripe Checkout Session using Price ID
      const session = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        payment_method_types: ['card'],
        line_items: [{
          price: priceId,
          quantity: 1,
        }],
        mode: 'subscription',
        success_url: `https://defeyes.com/dashboard?session_id={CHECKOUT_SESSION_ID}&upgraded=true`,
        cancel_url: 'https://defeyes.com/upgrade?cancelled=true',
        metadata: {
          customer_id: customer.id.toString(),
          plan: plan,
          billing_interval: billingInterval
        }
      });

      return res.status(200).json({
        success: true,
        checkoutUrl: session.url,
        message: 'Redirecting to checkout...'
      });
    }

    // =========================================================================
    // UPDATE SUBSCRIPTION (Upgrade/Downgrade)
    // =========================================================================
    if (url === '/api/subscription/update' && method === 'POST') {
      const apiKey = req.headers['x-api-key'];
      if (!apiKey) {
        return res.status(401).json({ error: 'API key required' });
      }

      const { plan, interval } = req.body || {};
      if (!plan) {
        return res.status(400).json({ error: 'Plan is required (developer or pro)' });
      }

      const db = getPool();

      // Get customer from API key
      const customerQuery = `
        SELECT c.id, c.email, c.name, c.stripe_customer_id
        FROM customers c
        JOIN api_keys ak ON ak.customer_id = c.id
        WHERE ak.api_key = $1 AND ak.is_active = true
      `;
      const customerResult = await db.query(customerQuery, [apiKey]);

      if (customerResult.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid API key' });
      }

      const customer = customerResult.rows[0];

      if (!customer.stripe_customer_id) {
        return res.status(400).json({ error: 'No Stripe customer found. Please create a subscription first.' });
      }

      // Get current subscription
      const subscriptions = await stripe.subscriptions.list({
        customer: customer.stripe_customer_id,
        status: 'active',
        limit: 1
      });

      if (subscriptions.data.length === 0) {
        return res.status(400).json({ error: 'No active subscription found' });
      }

      const currentSubscription = subscriptions.data[0];
      const subscriptionItem = currentSubscription.items.data[0];

      // Determine billing interval
      const billingInterval = (interval === 'year' || interval === 'yearly') ? 'year' : 'month';

      // Get price based on plan and interval
      const plans = {
        developer: {
          month: { price: 4900, interval: 'month' },
          year: { price: 47000, interval: 'year' }
        },
        pro: {
          month: { price: 19900, interval: 'month' },
          year: { price: 199000, interval: 'year' }
        }
      };

      const planType = plans[plan];
      if (!planType) {
        return res.status(400).json({ error: 'Invalid plan. Use "developer" or "pro"' });
      }

      const selectedPlan = planType[billingInterval] || planType.month;

      // Get Price ID from subscription_plans table
      // Try to match by name and billing_interval, with fallback to name only
      let planQuery;
      let planParams;
      
      // First try to find exact match (name + billing_interval)
      planQuery = `
        SELECT id, stripe_price_id, name, billing_interval
        FROM subscription_plans 
        WHERE LOWER(name) = LOWER($1) AND billing_interval = $2
        LIMIT 1
      `;
      planParams = [plan, billingInterval];
      
      let planResult = await db.query(planQuery, planParams);
      
      // If no exact match, try to find by name only (for backward compatibility)
      if (planResult.rows.length === 0) {
        planQuery = `
          SELECT id, stripe_price_id, name, billing_interval
          FROM subscription_plans 
          WHERE LOWER(name) = LOWER($1)
          ORDER BY billing_interval DESC NULLS LAST
          LIMIT 1
        `;
        planParams = [plan];
        planResult = await db.query(planQuery, planParams);
      }

      let newPriceId;
      if (planResult.rows.length > 0 && planResult.rows[0].stripe_price_id) {
        // Use stored Price ID
        newPriceId = planResult.rows[0].stripe_price_id;
      } else {
        // Fallback: Try to find Price ID by matching current subscription's interval
        // Or use environment variables as fallback
        const envPriceKey = `STRIPE_${plan.toUpperCase()}_PRICE_ID_${billingInterval === 'year' ? 'YEARLY' : 'MONTHLY'}`;
        newPriceId = process.env[envPriceKey];
        
        if (!newPriceId) {
          return res.status(400).json({ 
            error: `Price ID not configured for ${plan} (${billingInterval}). Please add stripe_price_id to subscription_plans table or set ${envPriceKey} environment variable.` 
          });
        }
      }

      try {
        // Update subscription
        const updatedSubscription = await stripe.subscriptions.update(
          currentSubscription.id,
          {
            items: [{
              id: subscriptionItem.id,
              price: newPriceId,
            }],
            proration_behavior: 'always_invoice', // Prorate the difference
          }
        );

        // Update database (webhook will also handle this, but update immediately for better UX)
        // Get the plan_id that matches both name and billing_interval
        const planIdQuery = `
          SELECT id FROM subscription_plans 
          WHERE LOWER(name) = LOWER($1) AND billing_interval = $2
          LIMIT 1
        `;
        const planIdResult = await db.query(planIdQuery, [plan, billingInterval]);
        
        if (planIdResult.rows.length > 0) {
          const updateQuery = `
            UPDATE subscriptions
            SET plan_id = $1,
                updated_at = NOW()
            WHERE customer_id = $2 AND stripe_subscription_id = $3
          `;
          await db.query(updateQuery, [planIdResult.rows[0].id, customer.id, currentSubscription.id]);
        }

        return res.status(200).json({
          success: true,
          message: `Subscription updated to ${plan}`,
          subscription: {
            id: updatedSubscription.id,
            status: updatedSubscription.status,
            current_period_end: new Date(updatedSubscription.current_period_end * 1000).toISOString()
          }
        });

      } catch (error) {
        console.error('Subscription update error:', error);
        return res.status(500).json({ 
          error: 'Failed to update subscription',
          details: error.message 
        });
      }
    }

    // =========================================================================
    // CANCEL SUBSCRIPTION (Downgrade to Free)
    // =========================================================================
    if (url === '/api/subscription/cancel' && method === 'POST') {
      const apiKey = req.headers['x-api-key'];
      if (!apiKey) {
        return res.status(401).json({ error: 'API key required' });
      }

      const db = getPool();

      // Get customer from API key
      const customerQuery = `
        SELECT c.id, c.stripe_customer_id
        FROM customers c
        JOIN api_keys ak ON ak.customer_id = c.id
        WHERE ak.api_key = $1 AND ak.is_active = true
      `;
      const customerResult = await db.query(customerQuery, [apiKey]);

      if (customerResult.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid API key' });
      }

      const customer = customerResult.rows[0];

      if (!customer.stripe_customer_id) {
        return res.status(400).json({ error: 'No Stripe customer found' });
      }

      // Get current subscription
      const subscriptions = await stripe.subscriptions.list({
        customer: customer.stripe_customer_id,
        status: 'active',
        limit: 1
      });

      if (subscriptions.data.length === 0) {
        return res.status(400).json({ error: 'No active subscription found' });
      }

      try {
        // Cancel at period end (downgrade to Free)
        const canceledSubscription = await stripe.subscriptions.update(
          subscriptions.data[0].id,
          { cancel_at_period_end: true }
        );

        // Update database
        const updateQuery = `
          UPDATE subscriptions
          SET cancel_at_period_end = true,
              updated_at = NOW()
          WHERE customer_id = $1 AND stripe_subscription_id = $2
        `;
        await db.query(updateQuery, [customer.id, subscriptions.data[0].id]);

        return res.status(200).json({
          success: true,
          message: 'Subscription will cancel at the end of the billing period',
          cancel_at: canceledSubscription.cancel_at 
            ? new Date(canceledSubscription.cancel_at * 1000).toISOString() 
            : new Date(canceledSubscription.current_period_end * 1000).toISOString()
        });

      } catch (error) {
        console.error('Subscription cancel error:', error);
        return res.status(500).json({ 
          error: 'Failed to cancel subscription',
          details: error.message 
        });
      }
    }

    // Rate limit public/sensitive endpoints
    const rateLimitedEndpoints = ['/api/test-db', '/api/health', '/api/stats', '/api/signup', '/api/auth/login'];
    if (rateLimitedEndpoints.some(ep => url === ep || url.startsWith(ep + '?') || url.startsWith(ep + '/'))) {
      const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
      if (!checkPublicRateLimit(clientIp)) {
        return res.status(429).json({ error: 'Too many requests. Please try again later.' });
      }
    }

    // Test database connection (simple)
    if (url === '/api/test-db') {
      const db = getPool();
      const result = await db.query('SELECT NOW() as time');
      return res.status(200).json({
        status: 'ok',
        database: 'connected',
        time: result.rows[0].time
      });
    }

    // Debug endpoint - show actual connection config
    if (url === '/api/debug') {
      return res.status(200).json({
        config: {
          host: 'aws-1-us-east-2.pooler.supabase.com',
          port: 6543,
          database: 'postgres',
          user: 'postgres.gaeauxyyfqavpqythore',
          ssl: true
        },
        note: 'Using Supabase Shared Pooler (Supavisor) - IPv4 compatible',
        nodeEnv: process.env.NODE_ENV
      });
    }

    // Health / event listener status endpoint
    if (url === '/api/health' || url.startsWith('/api/health?')) {
      const db = getPool();
      try {
        // Check event listener checkpoint (persisted by the local server)
        let checkpoint = null;
        try {
          const cpResult = await db.query(
            `SELECT last_processed_tx, rvm_head, updated_at FROM event_listener_checkpoint WHERE id = 'main'`
          );
          if (cpResult.rows.length > 0) {
            const cp = cpResult.rows[0];
            const lastNum = parseInt(cp.last_processed_tx, 16);
            const headNum = cp.rvm_head ? parseInt(cp.rvm_head, 16) : null;
            const staleSec = (Date.now() - new Date(cp.updated_at).getTime()) / 1000;
            checkpoint = {
              last_processed: lastNum,
              rvm_head: headNum,
              gap: headNum ? headNum - lastNum : null,
              updated_at: cp.updated_at,
              stale_seconds: Math.round(staleSec),
              status: staleSec < 30 ? 'active' : staleSec < 300 ? 'slow' : 'stale'
            };
          }
        } catch (e) { /* checkpoint table may not exist */ }

        // Check most recent event stored
        const recentResult = await db.query(`
          SELECT 
            MAX(enriched_at) as last_enriched,
            MAX(event_timestamp) as last_event_timestamp,
            COUNT(*) FILTER (WHERE enriched_at > NOW() - INTERVAL '5 minutes') as events_last_5m,
            COUNT(*) FILTER (WHERE enriched_at > NOW() - INTERVAL '1 hour') as events_last_hour
          FROM enriched_events
          WHERE action_type IS NOT NULL AND action_type != 'UNKNOWN'
        `);
        const recent = recentResult.rows[0] || {};
        const lastEnrichedAge = recent.last_enriched 
          ? Math.round((Date.now() - new Date(recent.last_enriched).getTime()) / 1000) 
          : null;

        const healthy = checkpoint 
          ? checkpoint.status === 'active' 
          : (lastEnrichedAge !== null && lastEnrichedAge < 300);

        return res.status(200).json({
          status: healthy ? 'healthy' : 'degraded',
          event_listener: checkpoint || { status: 'no_checkpoint' },
          database: {
            last_enriched_at: recent.last_enriched,
            last_enriched_age_seconds: lastEnrichedAge,
            last_event_timestamp: recent.last_event_timestamp,
            events_last_5m: parseInt(recent.events_last_5m) || 0,
            events_last_hour: parseInt(recent.events_last_hour) || 0
          },
          server_time: new Date().toISOString()
        });
      } catch (err) {
        return res.status(500).json({ status: 'error', error: err.message });
      }
    }

    // Stats endpoint - real-time data for landing page
    if (url === '/api/stats' || url.startsWith('/api/stats?')) {
      const db = getPool();
      
      // Get total enriched events
      const totalResult = await db.query('SELECT COUNT(*) as count FROM enriched_events');
      const totalEvents = parseInt(totalResult.rows[0].count);
      
      // Get unique wallets (origin_user)
      const walletsResult = await db.query('SELECT COUNT(DISTINCT origin_user) as count FROM enriched_events WHERE origin_user IS NOT NULL');
      const uniqueWallets = parseInt(walletsResult.rows[0].count);
      
      // Get classification rate (events with action_type != UNKNOWN)
      const classifiedResult = await db.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN action_type IS NOT NULL AND action_type != 'UNKNOWN' THEN 1 END) as classified
        FROM enriched_events
      `);
      const total = parseInt(classifiedResult.rows[0].total);
      const classified = parseInt(classifiedResult.rows[0].classified);
      const classificationRate = total > 0 ? ((classified / total) * 100).toFixed(1) : '0';
      
      // Get protocol breakdown (all protocols, case-insensitive grouping)
      const protocolsResult = await db.query(`
        SELECT LOWER(protocol_name) as protocol_name, COUNT(*) as count 
        FROM enriched_events 
        WHERE protocol_name IS NOT NULL 
        GROUP BY LOWER(protocol_name)
        ORDER BY count DESC
      `);
      const protocolBreakdown = {};
      protocolsResult.rows.forEach(row => {
        // Title case the protocol name
        const name = row.protocol_name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        protocolBreakdown[name] = parseInt(row.count);
      });
      
      return res.status(200).json({
        enriched_events: totalEvents,
        unique_wallets: uniqueWallets,
        enrichment_progress: classificationRate + '%',
        protocol_breakdown: protocolBreakdown,
        last_updated: new Date().toISOString()
      });
    }

    if (url === '/api/v1/market-pulse' || url.startsWith('/api/v1/market-pulse?')) {
      // Mirror the in-memory TTL on the CDN so warm visitors get an edge hit.
      res.setHeader('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=60');
      if (marketPulseCache.data && (Date.now() - marketPulseCache.timestamp) < MARKET_PULSE_TTL_MS) {
        return res.status(200).json(marketPulseCache.data);
      }

      const db = getPool();
      const rows = await fetchMarketPulseRows(db);
      let priceMap = null;
      try {
        await ensureTokenPriceTable(db);
        priceMap = await fetchTokenPriceMap(db);
      } catch (err) {
        console.warn('[market-pulse] token price map failed:', err.message);
      }
      const payload = buildMarketPulse(rows, priceMap);
      marketPulseCache.timestamp = Date.now();
      marketPulseCache.data = payload;
      return res.status(200).json(payload);
    }

    if (url === '/api/v1/ticker-data' || url.startsWith('/api/v1/ticker-data?')) {
      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
      if (tickerDataCache.data && (Date.now() - tickerDataCache.timestamp) < TICKER_DATA_TTL_MS) {
        return res.status(200).json(tickerDataCache.data);
      }
      const db = getPool();
      const payload = await fetchTickerData(db);
      tickerDataCache.timestamp = Date.now();
      tickerDataCache.data = payload;
      return res.status(200).json(payload);
    }

    if (url === '/api/v1/explorer-volume' || url.startsWith('/api/v1/explorer-volume?')) {
      res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=600');
      if (explorerVolumeCache.data && (Date.now() - explorerVolumeCache.timestamp) < EXPLORER_VOLUME_TTL_MS) {
        return res.status(200).json(explorerVolumeCache.data);
      }

      const db = getPool();
      await ensureTokenPriceTable(db).catch((err) => {
        console.warn('[explorer-volume] token price table ensure failed:', err.message);
      });
      const rows = await fetchExplorerVolumeRows(db);
      let priceMap = await fetchTokenPriceMap(db).catch(() => ({}));
      if (!priceMap || Object.keys(priceMap).length === 0) {
        try {
          await refreshTokenPriceCacheFromCoinGecko(db);
          tokenPriceMemCache.timestamp = 0;
          tokenPriceMemCache.map = null;
          priceMap = await fetchTokenPriceMap(db);
        } catch (err) {
          console.warn('[explorer-volume] CoinGecko price refresh failed:', err.message);
          priceMap = priceMap && Object.keys(priceMap).length ? priceMap : {};
        }
      }
      const summary = buildExplorerVolumeSummary(rows, priceMap);
      const payload = {
        ...summary,
        price_cache: {
          symbols: Object.keys(priceMap || {}).length,
          chain: TOKEN_PRICE_CHAIN
        }
      };
      explorerVolumeCache.timestamp = Date.now();
      explorerVolumeCache.data = payload;
      return res.status(200).json(payload);
    }

    if (url === '/api/cron/token-prices' || url.startsWith('/api/cron/token-prices?')) {
      if (method !== 'GET' && method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
      }
      if (!isAuthorizedCronRequest(req)) {
        return res.status(401).json({ error: 'Unauthorized - cron endpoint requires secret' });
      }

      const db = getPool();
      try {
        const summary = await refreshTokenPriceCacheFromCoinGecko(db);
        tokenPriceMemCache.timestamp = 0;
        tokenPriceMemCache.map = null;
        return res.status(200).json({
          ok: true,
          ...summary
        });
      } catch (err) {
        console.error('[cron/token-prices]', err);
        return res.status(500).json({ error: err.message || String(err) });
      }
    }

    if (url === '/api/cron/market-pulse-insight' || url.startsWith('/api/cron/market-pulse-insight?')) {
      if (method !== 'GET' && method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
      }
      if (!isAuthorizedCronRequest(req)) {
        return res.status(401).json({ error: 'Unauthorized - cron endpoint requires secret' });
      }

      const db = getPool();
      await ensureMarketPulseInsightTable(db).catch((err) => {
        console.warn('[PulseInsightCron] cache table ensure failed:', err.message);
      });

      const cacheRow = await readMarketPulseInsightCacheRow(db);
      const refreshed = await scheduleMarketPulseInsightRefresh(db, cacheRow || null);
      const refreshedRow = await readMarketPulseInsightCacheRow(db);
      return res.status(200).json({
        ok: true,
        refreshed_at: new Date().toISOString(),
        cache_status: refreshedRow && isMarketPulseCacheFresh(refreshedRow) ? 'fresh' : 'stale',
        provider: inferPulseInsightProvider(refreshed.payload?.source, refreshed.modelName),
        model_name: refreshed.modelName || null,
        source: refreshed.payload?.source || null,
        pulse_mode: refreshed.payload?.pulse_mode || null,
        risk_level: refreshed.payload?.risk_level || null,
        confidence: refreshed.payload?.confidence ?? null,
        headline: refreshed.payload?.headline || null,
        summary: refreshed.payload?.summary || null,
        ribbon_line: refreshed.payload?.ribbon_line || null,
        cache_created_at: refreshedRow?.created_at || null,
        cache_expires_at: refreshedRow?.expires_at || null
      });
    }

    if (url === '/api/v1/market-pulse-insight' || url.startsWith('/api/v1/market-pulse-insight?')) {
      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
      const db = getPool();
      await ensureMarketPulseInsightTable(db).catch((err) => {
        console.warn('[PulseInsight] cache table ensure failed:', err.message);
      });

      const cacheRow = await readMarketPulseInsightCacheRow(db);

      if (cacheRow?.payload_json && isMarketPulseCacheFresh(cacheRow)) {
        return res.status(200).json(
          buildMarketPulseInsightResponse(cacheRow.payload_json, cacheRow, { stale: false })
        );
      }

      if (cacheRow?.payload_json) {
        return res.status(200).json(
          buildMarketPulseInsightResponse(cacheRow.payload_json, cacheRow, {
            stale: true,
            refreshing: false
          })
        );
      }

      const fallbackSnapshot = {
        as_of: new Date().toISOString(),
        window: '4h'
      };
      const fallbackPayload = pulseInsightFallback(fallbackSnapshot, 'Initial insight generation in progress');
      return res.status(200).json(
        buildMarketPulseInsightResponse(fallbackPayload, null, {
          cached: false,
          stale: true,
          refreshing: false,
          source: 'fallback'
        })
      );
    }

    // =========================================================================
    // PROFILE & BILLING ENDPOINTS
    // =========================================================================

    // Get profile
    if (url === '/api/profile' && method === 'GET') {
      const apiKey = req.headers['x-api-key'];
      if (!apiKey) return res.status(401).json({ error: 'API key required' });

      const db = getPool();
      const query = `
        SELECT c.id, c.name, c.email, c.company, c.stripe_customer_id, c.created_at
        FROM customers c
        JOIN api_keys ak ON ak.customer_id = c.id
        WHERE ak.api_key = $1 AND ak.is_active = true
      `;
      const result = await db.query(query, [apiKey]);
      
      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid API key' });
      }

      const customer = result.rows[0];
      return res.status(200).json({
        id: customer.id,
        name: customer.name,
        email: customer.email,
        company: customer.company,
        createdAt: customer.created_at
      });
    }

    // Update profile
    if (url === '/api/profile' && method === 'PUT') {
      const apiKey = req.headers['x-api-key'];
      if (!apiKey) return res.status(401).json({ error: 'API key required' });

      const { name, company } = req.body || {};
      const db = getPool();

      // Get customer ID
      const keyQuery = 'SELECT customer_id FROM api_keys WHERE api_key = $1 AND is_active = true';
      const keyResult = await db.query(keyQuery, [apiKey]);
      
      if (keyResult.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid API key' });
      }

      const customerId = keyResult.rows[0].customer_id;

      // Update customer
      await db.query(
        'UPDATE customers SET name = COALESCE($1, name), company = $2 WHERE id = $3',
        [name, company, customerId]
      );

      return res.status(200).json({ success: true, message: 'Profile updated' });
    }

    // Create billing portal session
    if (url === '/api/billing/portal' && method === 'POST') {
      const apiKey = req.headers['x-api-key'];
      if (!apiKey) return res.status(401).json({ error: 'API key required' });

      const db = getPool();
      const query = `
        SELECT c.stripe_customer_id
        FROM customers c
        JOIN api_keys ak ON ak.customer_id = c.id
        WHERE ak.api_key = $1 AND ak.is_active = true
      `;
      const result = await db.query(query, [apiKey]);
      
      if (result.rows.length === 0 || !result.rows[0].stripe_customer_id) {
        return res.status(400).json({ error: 'No billing account found' });
      }

      const stripeCustomerId = result.rows[0].stripe_customer_id;

      // Create Stripe billing portal session
      const session = await stripe.billingPortal.sessions.create({
        customer: stripeCustomerId,
        return_url: 'https://defeyes.com/profile'
      });

      return res.status(200).json({ url: session.url });
    }

    // Revoke all API keys
    if (url === '/api/keys/revoke-all' && method === 'POST') {
      const apiKey = req.headers['x-api-key'];
      if (!apiKey) return res.status(401).json({ error: 'API key required' });

      const db = getPool();

      // Get customer ID
      const keyQuery = 'SELECT customer_id FROM api_keys WHERE api_key = $1 AND is_active = true';
      const keyResult = await db.query(keyQuery, [apiKey]);
      
      if (keyResult.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid API key' });
      }

      const customerId = keyResult.rows[0].customer_id;

      // Revoke all keys
      await db.query('UPDATE api_keys SET is_active = false WHERE customer_id = $1', [customerId]);

      return res.status(200).json({ success: true, message: 'All API keys revoked' });
    }

    // Delete account
    if (url === '/api/account' && method === 'DELETE') {
      const apiKey = req.headers['x-api-key'];
      if (!apiKey) return res.status(401).json({ error: 'API key required' });

      const db = getPool();

      // Get customer ID
      const keyQuery = 'SELECT customer_id FROM api_keys WHERE api_key = $1 AND is_active = true';
      const keyResult = await db.query(keyQuery, [apiKey]);
      
      if (keyResult.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid API key' });
      }

      const customerId = keyResult.rows[0].customer_id;

      // Delete in order (due to foreign keys)
      await db.query('DELETE FROM api_usage WHERE api_key_id IN (SELECT id FROM api_keys WHERE customer_id = $1)', [customerId]);
      await db.query('DELETE FROM rate_limit_counters WHERE api_key_id IN (SELECT id FROM api_keys WHERE customer_id = $1)', [customerId]);
      await db.query('DELETE FROM api_keys WHERE customer_id = $1', [customerId]);
      await db.query('DELETE FROM subscriptions WHERE customer_id = $1', [customerId]);
      await db.query('DELETE FROM payments WHERE customer_id = $1', [customerId]);
      await db.query('DELETE FROM customers WHERE id = $1', [customerId]);

      return res.status(200).json({ success: true, message: 'Account deleted' });
    }

    // =========================================================================
    // AUTHENTICATION ENDPOINTS
    // =========================================================================

    // Email + Password Login
    if (url === '/api/auth/login' && method === 'POST') {
      const { email, password } = req.body || {};
      
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const db = getPool();
      
      // Find customer by email
      const query = `
        SELECT c.id, c.email, c.name, c.password_hash, ak.api_key
        FROM customers c
        LEFT JOIN api_keys ak ON ak.customer_id = c.id AND ak.is_active = true
        WHERE LOWER(c.email) = LOWER($1)
        ORDER BY ak.created_at DESC
        LIMIT 1
      `;
      const result = await db.query(query, [email]);
      
      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const customer = result.rows[0];
      
      // Check if customer has a password set
      if (!customer.password_hash) {
        return res.status(401).json({ 
          error: 'No password set for this account. Please use API key login or reset your password.' 
        });
      }

      // Verify password
      if (!verifyPassword(password, customer.password_hash)) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // If no API key, create one
      let apiKey = customer.api_key;
      if (!apiKey) {
        const newKey = await createApiKey(customer.id);
        apiKey = newKey.api_key;
      }

      return res.status(200).json({
        success: true,
        message: 'Login successful',
        apiKey: apiKey,
        customer: {
          id: customer.id,
          email: customer.email,
          name: customer.name
        }
      });
    }

    // Google Sign-In (login or signup via Google ID token)
    if (url === '/api/auth/google-login' && method === 'POST') {
      const { id_token, plan, paymentMethod } = req.body || {};

      if (!id_token) {
        return res.status(400).json({ error: 'Google ID token is required' });
      }

      // Verify the token with Google's tokeninfo endpoint
      let googleUser;
      try {
        const tokenRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(id_token)}`);
        if (!tokenRes.ok) {
          return res.status(401).json({ error: 'Invalid Google token' });
        }
        googleUser = await tokenRes.json();

        const expectedClientId = process.env.GOOGLE_CLIENT_ID;
        if (expectedClientId && googleUser.aud !== expectedClientId) {
          return res.status(401).json({ error: 'Token audience mismatch' });
        }
      } catch (err) {
        console.error('Google token verification failed:', err);
        return res.status(401).json({ error: 'Failed to verify Google token' });
      }

      const googleId = googleUser.sub;
      const email = googleUser.email;
      const name = googleUser.name || googleUser.given_name || email.split('@')[0];

      if (!email) {
        return res.status(400).json({ error: 'Google account has no email' });
      }

      const db = getPool();

      // Check if user already exists (by google_id or email)
      const existingByGoogle = await db.query(
        'SELECT c.id, c.email, c.name, c.google_id FROM customers c WHERE c.google_id = $1 LIMIT 1',
        [googleId]
      );

      let customer;
      let isNewUser = false;

      if (existingByGoogle.rows.length > 0) {
        customer = existingByGoogle.rows[0];
      } else {
        // Check by email (user may have signed up with email/password before)
        const existingByEmail = await db.query(
          'SELECT c.id, c.email, c.name, c.google_id FROM customers c WHERE LOWER(c.email) = LOWER($1) LIMIT 1',
          [email]
        );

        if (existingByEmail.rows.length > 0) {
          customer = existingByEmail.rows[0];
          // Link Google ID to existing account
          await db.query('UPDATE customers SET google_id = $1 WHERE id = $2', [googleId, customer.id]);
        } else {
          // New user — create account
          isNewUser = true;
          const insertResult = await db.query(
            `INSERT INTO customers (email, name, google_id) VALUES ($1, $2, $3)
             RETURNING id, email, name, google_id, created_at`,
            [email, name, googleId]
          );
          customer = insertResult.rows[0];
        }
      }

      // Ensure user has an active API key
      const keyResult = await db.query(
        'SELECT api_key FROM api_keys WHERE customer_id = $1 AND is_active = true ORDER BY created_at DESC LIMIT 1',
        [customer.id]
      );

      let apiKey;
      if (keyResult.rows.length > 0) {
        apiKey = keyResult.rows[0].api_key;
      } else {
        const newKey = await createApiKey(customer.id);
        apiKey = newKey.api_key;
        // Free tier rate limit for new signups
        await db.query('UPDATE api_keys SET rate_limit_requests = 50 WHERE customer_id = $1 AND api_key = $2', [customer.id, apiKey]);
      }

      return res.status(200).json({
        success: true,
        message: isNewUser ? 'Account created with Google' : 'Logged in with Google',
        isNewUser,
        apiKey,
        customer: {
          id: customer.id,
          email: customer.email || email,
          name: customer.name || name
        }
      });
    }

    // Send magic link / lookup by email
    if (url === '/api/auth/magic-link' && method === 'POST') {
      const { email } = req.body || {};
      
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      const db = getPool();
      
      // Find customer by email
      const customerQuery = `
        SELECT c.id, c.email, c.name, ak.api_key
        FROM customers c
        JOIN api_keys ak ON ak.customer_id = c.id AND ak.is_active = true
        WHERE LOWER(c.email) = LOWER($1)
        ORDER BY ak.created_at DESC
        LIMIT 1
      `;
      const result = await db.query(customerQuery, [email]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'No account found with this email' });
      }

      // In production, you'd send an email with a magic link
      // For now, we'll return a hint that they should use their API key
      // TODO: Implement actual email sending with SendGrid/Resend
      
      return res.status(200).json({
        success: true,
        message: 'If an account exists, a login link has been sent.',
        // For development, include a hint
        hint: 'Check your email for the API key, or use the API Key tab'
      });
    }

    // Lookup API key by email (for password-less login)
    if (url === '/api/auth/lookup' && method === 'POST') {
      const { email } = req.body || {};
      
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      const db = getPool();
      
      const query = `
        SELECT c.id, c.email, c.name, ak.api_key
        FROM customers c
        JOIN api_keys ak ON ak.customer_id = c.id AND ak.is_active = true
        WHERE LOWER(c.email) = LOWER($1)
        ORDER BY ak.created_at DESC
        LIMIT 1
      `;
      const result = await db.query(query, [email]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'No account found' });
      }

      // Return masked API key for security
      const apiKey = result.rows[0].api_key;
      const maskedKey = apiKey.substring(0, 8) + '...' + apiKey.substring(apiKey.length - 4);
      
      return res.status(200).json({
        found: true,
        email: result.rows[0].email,
        maskedApiKey: maskedKey,
        message: 'Account found. Use your API key to sign in.'
      });
    }

    // =========================================================================
    // WEBHOOK API ENDPOINTS
    // =========================================================================

    // Helper function to authenticate API key and get customer
    async function authenticateWebhookRequest(apiKey) {
      if (!apiKey) {
        return { error: 'API key required', status: 401 };
      }

      const db = getPool();
      const customerQuery = `
        SELECT c.id, c.email, c.name,
               ak.id as api_key_id, ak.api_key
        FROM customers c
        JOIN api_keys ak ON ak.customer_id = c.id
        WHERE ak.api_key = $1 AND ak.is_active = true
        LIMIT 1
      `;
      const result = await db.query(customerQuery, [apiKey]);
      
      if (result.rows.length === 0) {
        return { error: 'Invalid API key', status: 401 };
      }

      const customer = result.rows[0];

      // Check if customer has Pro plan subscription
      const planQuery = await db.query(`
        SELECT sp.name 
        FROM subscriptions s
        JOIN subscription_plans sp ON s.plan_id = sp.id
        WHERE s.customer_id = $1 AND s.status = 'active' AND LOWER(sp.name) = 'pro'
        LIMIT 1
      `, [customer.id]);

      if (planQuery.rows.length === 0) {
        return { 
          error: 'Webhooks are only available for Pro plan subscribers. Please upgrade to Pro to use webhooks.', 
          status: 403 
        };
      }

      return { customer, db };
    }

    // List webhooks
    if (url === '/api/webhooks' && method === 'GET') {
      try {
        const apiKey = req.headers['x-api-key'];
        const auth = await authenticateWebhookRequest(apiKey);
        if (auth.error) {
          return res.status(auth.status).json({ error: auth.error });
        }

        const webhookService = new WebhookService(auth.db);
        const webhooks = await webhookService.getWebhooks(auth.customer.id);
        
        return res.status(200).json({
          success: true,
          webhooks: webhooks.map(w => ({
            id: w.id,
            url: w.url,
            description: w.description,
            filters: w.filters,
            status: w.status,
            created_at: w.created_at,
            last_triggered_at: w.last_triggered_at,
            stats: {
              total_deliveries: parseInt(w.total_deliveries || 0),
              successful_deliveries: parseInt(w.successful_deliveries || 0),
              failed_deliveries: parseInt(w.failed_deliveries || 0)
            }
          }))
        });
      } catch (error) {
        console.error('Webhook list error:', error);
        return res.status(500).json({ error: 'Failed to list webhooks', message: error.message });
      }
    }

    // Create webhook
    if (url === '/api/webhooks' && method === 'POST') {
      try {
        const apiKey = req.headers['x-api-key'];
        const auth = await authenticateWebhookRequest(apiKey);
        if (auth.error) {
          return res.status(auth.status).json({ error: auth.error });
        }

        const { url: webhookUrl, description, filters } = req.body || {};

        if (!webhookUrl) {
          return res.status(400).json({ error: 'Webhook URL is required' });
        }

        const webhookService = new WebhookService(auth.db);
        const webhook = await webhookService.createWebhook(
          auth.customer.id,
          auth.customer.api_key_id,
          webhookUrl,
          description || '',
          filters || {}
        );

        return res.status(201).json({
          success: true,
          webhook: {
            id: webhook.id,
            url: webhook.url,
            description: webhook.description,
            filters: webhook.filters,
            status: webhook.status,
            created_at: webhook.created_at
          },
          message: 'Webhook created successfully'
        });
      } catch (error) {
        console.error('Webhook create error:', error);
        return res.status(500).json({ error: 'Failed to create webhook', message: error.message });
      }
    }

    // Update webhook
    if (url.startsWith('/api/webhooks/') && method === 'PUT') {
      try {
        const apiKey = req.headers['x-api-key'];
        const auth = await authenticateWebhookRequest(apiKey);
        if (auth.error) {
          return res.status(auth.status).json({ error: auth.error });
        }

        const webhookId = url.split('/api/webhooks/')[1]?.split('?')[0];
        if (!webhookId) {
          return res.status(400).json({ error: 'Webhook ID required' });
        }

        const webhookService = new WebhookService(auth.db);
        const webhook = await webhookService.updateWebhook(webhookId, auth.customer.id, req.body || {});

        return res.status(200).json({
          success: true,
          webhook: {
            id: webhook.id,
            url: webhook.url,
            description: webhook.description,
            filters: webhook.filters,
            status: webhook.status,
            updated_at: webhook.updated_at
          }
        });
      } catch (error) {
        console.error('Webhook update error:', error);
        return res.status(500).json({ error: 'Failed to update webhook', message: error.message });
      }
    }

    // Delete webhook
    if (url.startsWith('/api/webhooks/') && method === 'DELETE') {
      try {
        const apiKey = req.headers['x-api-key'];
        const auth = await authenticateWebhookRequest(apiKey);
        if (auth.error) {
          return res.status(auth.status).json({ error: auth.error });
        }

        const webhookId = url.split('/api/webhooks/')[1]?.split('?')[0];
        if (!webhookId) {
          return res.status(400).json({ error: 'Webhook ID required' });
        }

        const webhookService = new WebhookService(auth.db);
        await webhookService.deleteWebhook(webhookId, auth.customer.id);

        return res.status(200).json({ success: true, message: 'Webhook deleted successfully' });
      } catch (error) {
        console.error('Webhook delete error:', error);
        return res.status(500).json({ error: 'Failed to delete webhook', message: error.message });
      }
    }

    // Test webhook
    if (url.includes('/api/webhooks/') && url.includes('/test') && method === 'POST') {
      try {
        const apiKey = req.headers['x-api-key'];
        const auth = await authenticateWebhookRequest(apiKey);
        if (auth.error) {
          return res.status(auth.status).json({ error: auth.error });
        }

        const webhookId = url.split('/api/webhooks/')[1]?.split('/test')[0];
        if (!webhookId) {
          return res.status(400).json({ error: 'Webhook ID required' });
        }

        const webhookService = new WebhookService(auth.db);
        const result = await webhookService.testWebhook(webhookId, auth.customer.id);

        return res.status(200).json({
          success: true,
          message: 'Test webhook sent',
          result: {
            success: result.success,
            statusCode: result.statusCode
          }
        });
      } catch (error) {
        console.error('Webhook test error:', error);
        return res.status(500).json({ error: 'Failed to test webhook', message: error.message });
      }
    }

    // Get webhook delivery logs
    if (url.includes('/api/webhooks/') && url.includes('/logs') && method === 'GET') {
      try {
        const apiKey = req.headers['x-api-key'];
        const auth = await authenticateWebhookRequest(apiKey);
        if (auth.error) {
          return res.status(auth.status).json({ error: auth.error });
        }

        const webhookId = url.split('/api/webhooks/')[1]?.split('/logs')[0];
        if (!webhookId) {
          return res.status(400).json({ error: 'Webhook ID required' });
        }

        const urlParams = new URL(url, 'http://localhost').searchParams;
        const limit = parseInt(urlParams.get('limit') || '50', 10);
        const offset = parseInt(urlParams.get('offset') || '0', 10);

        const webhookService = new WebhookService(auth.db);
        const logs = await webhookService.getDeliveryLogs(webhookId, auth.customer.id, limit, offset);

        return res.status(200).json({
          success: true,
          logs: logs.map(log => ({
            id: log.id,
            ref_tx_hash: log.ref_tx_hash,
            status: log.status,
            http_status_code: log.http_status_code,
            error_message: log.error_message,
            attempt_number: log.attempt_number,
            created_at: log.created_at,
            delivered_at: log.delivered_at
          }))
        });
      } catch (error) {
        console.error('Webhook logs error:', error);
        return res.status(500).json({ error: 'Failed to get webhook logs', message: error.message });
      }
    }

    // Internal webhook trigger endpoint (for enrichment pipeline)
    if (url === '/api/webhooks/trigger-internal' && method === 'POST') {
      try {
        // Check for internal secret (set in environment)
        const internalSecret = req.headers['authorization'];
        const expectedSecret = process.env.WEBHOOK_INTERNAL_SECRET || 'defeyes-internal-webhook-secret';
        
        if (internalSecret !== `Bearer ${expectedSecret}`) {
          return res.status(401).json({ error: 'Unauthorized - internal endpoint' });
        }

        const event = req.body.event || req.body;

        if (!event) {
          return res.status(400).json({ error: 'Event data required' });
        }

        const db = getPool();
        const webhookService = new WebhookService(db);
        const triggered = await webhookService.triggerWebhooks(event);

        return res.status(200).json({
          success: true,
          triggered: triggered.length,
          webhook_ids: triggered
        });
      } catch (error) {
        console.error('Webhook trigger error:', error);
        return res.status(500).json({ error: 'Failed to trigger webhooks', message: error.message });
      }
    }

    // =========================================================================
    // DASHBOARD API ENDPOINTS
    // =========================================================================

    // Get customer info and usage by API key
    if ((url === '/api/usage' || url.startsWith('/api/usage?')) && method === 'GET') {
      const apiKey = req.headers['x-api-key'];
      
      if (!apiKey) {
        return res.status(401).json({ error: 'API key required. Add X-API-Key header.' });
      }

      const db = getPool();
      
      // Get customer by API key
      const customerQuery = `
        SELECT c.id, c.email, c.name, c.company, c.stripe_customer_id, c.created_at,
               ak.id as api_key_id, ak.api_key, ak.rate_limit_requests,
               COALESCE(sp.name, 'Free') as plan_name, 
               sp.api_requests_limit
        FROM customers c
        JOIN api_keys ak ON ak.customer_id = c.id
        LEFT JOIN subscriptions s ON s.customer_id = c.id AND s.status = 'active'
        LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
        WHERE ak.api_key = $1 AND ak.is_active = true
        ORDER BY s.created_at DESC NULLS LAST
        LIMIT 1
      `;
      const customerResult = await db.query(customerQuery, [apiKey]);
      
      if (customerResult.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid API key' });
      }
      
      const customer = customerResult.rows[0];
      
      // Check if USDC pay-as-you-go user should get Pro access
      let usdcCredits = 0;
      let usdcEnabled = false;
      if (customer.plan_name === 'Free' || !customer.plan_name) {
        const creditsResult = await db.query(
          'SELECT COALESCE(x402_prepaid_credits, 0) as credits, x402_enabled FROM customers WHERE id = $1',
          [customer.id]
        );
        usdcCredits = parseInt(creditsResult.rows[0]?.credits || 0);
        usdcEnabled = creditsResult.rows[0]?.x402_enabled || false;
        if (usdcCredits > 0) {
          customer.plan_name = 'Pro';
          customer.plan_source = 'usdc_credits';
        }
      }

      // Log for debugging
      console.log('[API Usage] Customer data:', {
        id: customer.id,
        email: customer.email,
        plan_name: customer.plan_name,
        api_requests_limit: customer.api_requests_limit,
        usdc_credits: usdcCredits
      });
      
      // Get usage period from query
      const urlObj = new URL(url, 'http://localhost');
      const period = urlObj.searchParams.get('period') || '24h';
      
    let timeFilter = "AND created_at > NOW() - INTERVAL '24 hours'";
    if (period === '7d') timeFilter = "AND created_at > NOW() - INTERVAL '7 days'";
    if (period === '30d') timeFilter = "AND created_at > NOW() - INTERVAL '30 days'";

      // Get usage stats
    const usageQuery = `
      SELECT
        COUNT(*) as total_requests,
        COUNT(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 END) as successful_requests,
        COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_requests,
          COALESCE(AVG(response_time_ms), 0) as avg_response_time,
        SUM(CASE WHEN created_at > NOW() - INTERVAL '1 hour' THEN 1 ELSE 0 END) as requests_last_hour
      FROM api_usage
        WHERE api_key_id = $1 ${timeFilter}
    `;
      const usageResult = await db.query(usageQuery, [customer.api_key_id]);
      const usage = usageResult.rows[0];

    // Get rate limit status
    const rateLimitQuery = `
        SELECT request_count, window_start
        FROM rate_limit_counters
        WHERE api_key_id = $1 AND window_start >= NOW() - INTERVAL '1 hour'
        ORDER BY window_start DESC
        LIMIT 1
      `;
      const rateLimitResult = await db.query(rateLimitQuery, [customer.api_key_id]);
      const currentUsage = rateLimitResult.rows[0]?.request_count || 0;
      const rateLimit = customer.rate_limit_requests || customer.api_requests_limit || 1000;

      return res.status(200).json({
      customer: {
        id: customer.id,
        email: customer.email,
          name: customer.name,
          plan: customer.plan_name || 'Free',
          planSource: customer.plan_source || 'subscription',
          apiRequestsLimit: rateLimit,
          usdcCredits: usdcCredits || 0
      },
      usage: {
        period,
        totalRequests: parseInt(usage.total_requests) || 0,
        successfulRequests: parseInt(usage.successful_requests) || 0,
        errorRequests: parseInt(usage.error_requests) || 0,
        avgResponseTime: parseFloat(usage.avg_response_time) || 0,
        requestsLastHour: parseInt(usage.requests_last_hour) || 0
      },
        rateLimit: {
          limit: rateLimit,
          currentUsage: currentUsage,
          remaining: Math.max(0, rateLimit - currentUsage),
          resetTime: new Date(Date.now() + 3600000).toISOString()
        }
      });
    }

    // Get customer's API keys
    if (url === '/api/keys' && method === 'GET') {
      const apiKey = req.headers['x-api-key'];
      
      if (!apiKey) {
        return res.status(401).json({ error: 'API key required' });
      }

      const db = getPool();
      
      // Get customer ID from API key
      const customerQuery = `
        SELECT c.id FROM customers c
        JOIN api_keys ak ON ak.customer_id = c.id
        WHERE ak.api_key = $1 AND ak.is_active = true
      `;
      const customerResult = await db.query(customerQuery, [apiKey]);
      
      if (customerResult.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid API key' });
      }

      // Get all API keys for this customer
      const keysQuery = `
        SELECT id, api_key, name, is_active, created_at
        FROM api_keys
        WHERE customer_id = $1
        ORDER BY created_at DESC
      `;
      const keysResult = await db.query(keysQuery, [customerResult.rows[0].id]);

      return res.status(200).json({
        keys: keysResult.rows.map(k => ({
          id: k.id,
          apiKey: k.api_key,
          name: k.name,
          isActive: k.is_active,
          createdAt: k.created_at
        }))
      });
    }

    // Get customer's subscriptions
    if (url === '/api/subscriptions' && method === 'GET') {
      const apiKey = req.headers['x-api-key'];
      
      if (!apiKey) {
        return res.status(401).json({ error: 'API key required' });
      }

      const db = getPool();
      
      // Get customer ID from API key
      const customerQuery = `
        SELECT c.id, c.stripe_customer_id FROM customers c
        JOIN api_keys ak ON ak.customer_id = c.id
        WHERE ak.api_key = $1 AND ak.is_active = true
      `;
      const customerResult = await db.query(customerQuery, [apiKey]);
      
      if (customerResult.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid API key' });
      }

      const customer = customerResult.rows[0];

      // Get subscriptions
      const subsQuery = `
        SELECT s.*, sp.name as plan_name, sp.price_cents, sp.billing_interval
        FROM subscriptions s
        JOIN subscription_plans sp ON s.plan_id = sp.id
        WHERE s.customer_id = $1
        ORDER BY s.created_at DESC
      `;
      const subsResult = await db.query(subsQuery, [customer.id]);

      return res.status(200).json({
        subscriptions: subsResult.rows.map(s => ({
          id: s.id,
          planName: s.plan_name,
          status: s.status,
          priceCents: s.price_cents,
          billingInterval: s.billing_interval,
          currentPeriodStart: s.current_period_start,
          currentPeriodEnd: s.current_period_end,
          createdAt: s.created_at
        })),
        stripeCustomerId: customer.stripe_customer_id
      });
    }

    // Regenerate API key
    if (url === '/api/keys/regenerate' && method === 'POST') {
      const apiKey = req.headers['x-api-key'];
      
      if (!apiKey) {
        return res.status(401).json({ error: 'API key required' });
      }

      const db = getPool();
      
      // Get customer ID from API key
      const customerQuery = `
        SELECT c.id, ak.id as key_id FROM customers c
        JOIN api_keys ak ON ak.customer_id = c.id
        WHERE ak.api_key = $1 AND ak.is_active = true
      `;
      const customerResult = await db.query(customerQuery, [apiKey]);
      
      if (customerResult.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid API key' });
      }

      const customerId = customerResult.rows[0].id;
      const oldKeyId = customerResult.rows[0].key_id;

      // Deactivate old key
      await db.query('UPDATE api_keys SET is_active = false WHERE id = $1', [oldKeyId]);

      // Create new key
      const newApiKey = generateApiKey();
      const insertQuery = `
        INSERT INTO api_keys (customer_id, api_key, name)
        VALUES ($1, $2, 'Regenerated Key')
        RETURNING id, api_key, name, created_at
      `;
      const newKeyResult = await db.query(insertQuery, [customerId, newApiKey]);

      return res.status(200).json({
        success: true,
        newKey: {
          id: newKeyResult.rows[0].id,
          apiKey: newKeyResult.rows[0].api_key,
          name: newKeyResult.rows[0].name,
          createdAt: newKeyResult.rows[0].created_at
        },
        message: 'API key regenerated. Old key has been deactivated.'
      });
    }

    // Reactive Network RSC Events endpoint (for live monitor)
    if (url === '/api/rsc-events' && method === 'POST') {
      const { rscAddress, limit = 50 } = req.body || {};
      
      if (!rscAddress) {
        return res.status(400).json({ error: 'rscAddress is required' });
      }

      try {
        const REACTIVE_RPC = (process.env.REACTIVE_RPC || 'https://mainnet-rpc.rnk.dev').trim().replace(/[\r\n]/g, '');
        const ARBITRUM_RPC = (process.env.ARBITRUM_RPC || process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc').trim().replace(/[\r\n]/g, '');
        const reactiveProvider = new ethers.providers.JsonRpcProvider(REACTIVE_RPC);
        const arbitrumProvider = new ethers.providers.JsonRpcProvider(ARBITRUM_RPC);

        // RSC ABI for event decoding
        const rscAbi = [
          'event ReactHandled(uint256 indexed chainId, address indexed emitter, uint256 indexed txHash, uint256 logIndex)',
          'event Callback(uint256 indexed chain_id, address indexed _contract, uint64 indexed gas_limit, bytes payload)',
          'event StrategyUpdate(uint256 aaveApy, uint256 compoundApy, uint256 spread, bool rebalanced)'
        ];
        const rscInterface = new ethers.utils.Interface(rscAbi);

        // Aave Pool ABI for decoding ReserveDataUpdated
        const aavePoolAbi = [
          'event ReserveDataUpdated(address indexed reserve, uint256 liquidityRate, uint256 stableBorrowRate, uint256 variableBorrowRate, uint256 liquidityIndex, uint256 variableBorrowIndex)'
        ];
        const aaveInterface = new ethers.utils.Interface(aavePoolAbi);
        const RAY = ethers.BigNumber.from(10).pow(27);

        // Get wallet address from environment (for Reactscan URLs)
        const walletAddress = process.env.REACTIVE_PRIVATE_KEY 
          ? new ethers.Wallet(process.env.REACTIVE_PRIVATE_KEY).address 
          : null;

        // Query events from Reactive Network
        const currentBlock = await reactiveProvider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 10000); // Last ~10k blocks

        // Get all event types
        const reactHandledTopic = ethers.utils.id('ReactHandled(uint256,address,uint256,uint256)');
        const callbackTopic = ethers.utils.id('Callback(uint256,address,uint64,bytes)');
        const strategyUpdateTopic = ethers.utils.id('StrategyUpdate(uint256,uint256,uint256,bool)');

        const allLogs = await reactiveProvider.getLogs({
          address: rscAddress,
          topics: [[reactHandledTopic, callbackTopic, strategyUpdateTopic]],
          fromBlock,
          toBlock: 'latest'
        });

        // Process and decode events
        const events = [];
        const eventCounts = { ReactHandled: 0, Callback: 0, StrategyUpdate: 0 };
        const apyStats = { aave: [], compound: [] };
        let rebalances = 0;

        // Sort by block number (most recent first)
        allLogs.sort((a, b) => b.blockNumber - a.blockNumber);

        // Process up to limit events
        for (const log of allLogs.slice(0, limit)) {
          // Validate log has required fields
          if (!log.topics || !Array.isArray(log.topics) || log.topics.length === 0) {
            console.warn(`Skipping log with invalid topics: ${log.transactionHash}`);
            continue;
          }
          
          if (!log.data) {
            console.warn(`Skipping log with no data: ${log.transactionHash}`);
            continue;
          }

          const topic0 = log.topics[0];
          let eventType = 'Unknown';
          let decoded = null;
          let apyQuery = null;
          let originEvent = null;
          let strategyUpdate = null;

          try {
            // Only decode if we have a valid topic match
            if (topic0 === reactHandledTopic) {
              eventType = 'ReactHandled';
              // Verify topics array has enough elements for ReactHandled (needs 4 topics: signature + 3 indexed params)
              if (log.topics && log.topics.length >= 4 && log.topics[1] && log.topics[2] && log.topics[3]) {
                try {
                  decoded = rscInterface.decodeEventLog('ReactHandled', log.data, log.topics);
                  eventCounts.ReactHandled++;
                } catch (decodeErr) {
                  console.warn(`Failed to decode ReactHandled event for tx ${log.transactionHash}: ${decodeErr.message}`);
                  continue;
                }
              } else {
                console.warn(`ReactHandled event has invalid topics: length=${log.topics?.length}, topics[1]=${log.topics?.[1]}, topics[2]=${log.topics?.[2]}, topics[3]=${log.topics?.[3]} for tx ${log.transactionHash}`);
                continue;
              }

              // Try to fetch original Aave event from Arbitrum
              try {
                const chainId = decoded.chainId.toNumber();
                if (chainId === 42161) { // Arbitrum
                  const txHash = '0x' + decoded.txHash.toHexString().slice(2).padStart(64, '0');
                  const logIndex = decoded.logIndex.toNumber();
                  
                  // Get transaction receipt
                  const receipt = await arbitrumProvider.getTransactionReceipt(txHash);
                  if (!receipt) {
                    console.warn(`[API] No receipt found for tx ${txHash}`);
                  } else if (!receipt.logs || receipt.logs.length <= logIndex) {
                    console.warn(`[API] Tx ${txHash} has ${receipt.logs?.length || 0} logs, but need logIndex ${logIndex}`);
                  } else {
                    const aaveLog = receipt.logs[logIndex];
                    const reserveDataTopic = ethers.utils.id('ReserveDataUpdated(address,uint256,uint256,uint256,uint256,uint256)');
                    
                    if (aaveLog.topics && aaveLog.topics.length > 0 && aaveLog.topics[0] === reserveDataTopic) {
                      const aaveDecoded = aaveInterface.decodeEventLog('ReserveDataUpdated', aaveLog.data, aaveLog.topics);
                      
                      // Validate reserve address (skip zero address)
                      const reserveAddr = aaveDecoded.reserve.toLowerCase();
                      if (reserveAddr === '0x0000000000000000000000000000000000000000') {
                        console.warn(`[API] Skipping zero-address reserve for tx ${txHash}, logIndex ${logIndex}`);
                      } else {
                        // IMPORTANT: liquidityRate is per-second in RAY format, need to multiply by SECONDS_PER_YEAR for annualized APY
                        const SECONDS_PER_YEAR = 31536000; // 365 * 24 * 60 * 60
                        const liquidityRateBps = aaveDecoded.liquidityRate.mul(SECONDS_PER_YEAR).mul(10000).div(RAY).toNumber();
                        const liquidityRatePercent = liquidityRateBps / 100.0;
                        
                        // DEBUG: Log for verification
                        if (liquidityRatePercent < 0.1 || liquidityRatePercent > 10) {
                          console.warn(`[API] Unusual APY value: ${liquidityRatePercent.toFixed(4)}% for reserve ${reserveAddr}, tx ${txHash.slice(0, 16)}..., raw rate: ${aaveDecoded.liquidityRate.toString()}`);
                        }
                        
                        originEvent = {
                          address: aaveLog.address,
                          blockNumber: aaveLog.blockNumber,
                          transactionHash: aaveLog.transactionHash,
                          logIndex: aaveLog.logIndex,
                          topics: aaveLog.topics,
                          data: aaveLog.data,
                          decoded: {
                            reserve: aaveDecoded.reserve,
                            liquidityRate: aaveDecoded.liquidityRate.toString(),
                            liquidityRateBps,
                            liquidityRatePercent,
                            stableBorrowRate: aaveDecoded.stableBorrowRate.toString(),
                            variableBorrowRate: aaveDecoded.variableBorrowRate.toString(),
                            liquidityIndex: aaveDecoded.liquidityIndex.toString(),
                            variableBorrowIndex: aaveDecoded.variableBorrowIndex.toString()
                          }
                        };
                        
                        if (liquidityRatePercent >= 0.1) {
                          apyStats.aave.push(liquidityRatePercent);
                        }
                      }
                    } else {
                      // Try to find ReserveDataUpdated in any log if logIndex doesn't match
                      const reserveDataLog = receipt.logs.find(l => l.topics && l.topics[0] === reserveDataTopic);
                      if (reserveDataLog) {
                        const aaveDecoded = aaveInterface.decodeEventLog('ReserveDataUpdated', reserveDataLog.data, reserveDataLog.topics);
                        
                        // Validate reserve address (skip zero address)
                        const reserveAddr = aaveDecoded.reserve.toLowerCase();
                        if (reserveAddr === '0x0000000000000000000000000000000000000000') {
                          console.warn(`[API] Skipping zero-address reserve in fallback search for tx ${txHash.slice(0, 16)}...`);
                        } else {
                          // IMPORTANT: liquidityRate is per-second in RAY format, need to multiply by SECONDS_PER_YEAR for annualized APY
                          const SECONDS_PER_YEAR = 31536000; // 365 * 24 * 60 * 60
                          const liquidityRateBps = aaveDecoded.liquidityRate.mul(SECONDS_PER_YEAR).mul(10000).div(RAY).toNumber();
                          const liquidityRatePercent = liquidityRateBps / 100.0;
                          
                          // DEBUG: Log for verification
                          if (liquidityRatePercent < 0.1 || liquidityRatePercent > 10) {
                            console.warn(`[API] Unusual APY value (fallback): ${liquidityRatePercent.toFixed(4)}% for reserve ${reserveAddr}, tx ${txHash.slice(0, 16)}..., raw rate: ${aaveDecoded.liquidityRate.toString()}`);
                          }
                          
                          originEvent = {
                          address: reserveDataLog.address,
                          blockNumber: reserveDataLog.blockNumber,
                          transactionHash: reserveDataLog.transactionHash,
                          logIndex: reserveDataLog.logIndex,
                          topics: reserveDataLog.topics,
                          data: reserveDataLog.data,
                          decoded: {
                            reserve: aaveDecoded.reserve,
                            liquidityRate: aaveDecoded.liquidityRate.toString(),
                            liquidityRateBps,
                            liquidityRatePercent,
                            stableBorrowRate: aaveDecoded.stableBorrowRate.toString(),
                            variableBorrowRate: aaveDecoded.variableBorrowRate.toString(),
                            liquidityIndex: aaveDecoded.liquidityIndex.toString(),
                            variableBorrowIndex: aaveDecoded.variableBorrowIndex.toString()
                          }
                        };
                        
                          if (liquidityRatePercent >= 0.1) {
                            apyStats.aave.push(liquidityRatePercent);
                          }
                        }
                      } else {
                        console.warn(`[API] Tx ${txHash} does not contain ReserveDataUpdated event`);
                      }
                    }
                  }
                }
              } catch (err) {
                console.error(`[API] Error fetching origin event for tx ${txHash}:`, err.message);
              }
            } else if (topic0 === callbackTopic) {
              eventType = 'Callback';
              // Verify topics array has enough elements for Callback (needs 4 topics: signature + 3 indexed params)
              if (log.topics && log.topics.length >= 4 && log.topics[1] && log.topics[2] && log.topics[3]) {
                try {
                  decoded = rscInterface.decodeEventLog('Callback', log.data, log.topics);
                  eventCounts.Callback++;
                } catch (decodeErr) {
                  console.warn(`Failed to decode Callback event for tx ${log.transactionHash}: ${decodeErr.message}`);
                  continue;
                }
              } else {
                console.warn(`Callback event has invalid topics: length=${log.topics?.length}, topics[1]=${log.topics?.[1]}, topics[2]=${log.topics?.[2]}, topics[3]=${log.topics?.[3]} for tx ${log.transactionHash}`);
                continue;
              }

              // Decode APY query from payload
              const payload = decoded.payload;
              if (payload && payload.length >= 266) {
                const functionSelector = payload.slice(0, 10);
                
                // queryAaveApy() selector: 0xeb45e4d1
                if (functionSelector === '0xeb45e4d1') {
                  const paramData = payload.slice(10);
                  if (paramData.length >= 256) {
                    const assetAddr = '0x' + paramData.slice(64, 128).slice(-40).toLowerCase();
                    const param3 = ethers.BigNumber.from('0x' + paramData.slice(128, 192));
                    const param4 = ethers.BigNumber.from('0x' + paramData.slice(192, 256));
                    
                    const apyBps = param3.toNumber();
                    const apyPercent = apyBps / 100.0;
                    
                    if (apyPercent >= 0.1) {
                      apyQuery = {
                        assetAddress: assetAddr,
                        apyBps,
                        apyPercent,
                        protocol: 'Aave',
                        queryTimestamp: param4.toNumber(),
                        transactionTimestamp: (await reactiveProvider.getBlock(log.blockNumber)).timestamp
                      };
                      apyStats.aave.push(apyPercent);
                    }
                  }
                }
                // queryCompoundApy() selector: 0xcb3dd0fd
                else if (functionSelector === '0xcb3dd0fd') {
                  const paramData = payload.slice(10);
                  if (paramData.length >= 256) {
                    const assetAddr = '0x' + paramData.slice(64, 128).slice(-40).toLowerCase();
                    const param3 = ethers.BigNumber.from('0x' + paramData.slice(128, 192));
                    const param4 = ethers.BigNumber.from('0x' + paramData.slice(192, 256));
                    
                    const apyBps = param3.toNumber();
                    const apyPercent = apyBps / 100.0;
                    
                    if (apyPercent >= 0.1) {
                      apyQuery = {
                        assetAddress: assetAddr,
                        apyBps,
                        apyPercent,
                        protocol: 'Compound',
                        queryTimestamp: param4.toNumber(),
                        transactionTimestamp: (await reactiveProvider.getBlock(log.blockNumber)).timestamp
                      };
                      apyStats.compound.push(apyPercent);
                    }
                  }
                }
              }
            } else if (topic0 === strategyUpdateTopic) {
              eventType = 'StrategyUpdate';
              // StrategyUpdate is not indexed, so it only needs topic0
              if (log.topics && log.topics.length >= 1 && topic0) {
                try {
                  decoded = rscInterface.decodeEventLog('StrategyUpdate', log.data, log.topics);
                  eventCounts.StrategyUpdate++;
                } catch (decodeErr) {
                  console.warn(`Failed to decode StrategyUpdate event for tx ${log.transactionHash}: ${decodeErr.message}`);
                  continue;
                }
              } else {
                console.warn(`StrategyUpdate event has invalid topics: length=${log.topics?.length}, topic0=${topic0} for tx ${log.transactionHash}`);
                continue;
              }

              const aaveApyBps = decoded.aaveApy.toNumber();
              const compoundApyBps = decoded.compoundApy.toNumber();
              const spreadBps = decoded.spread.toNumber();
              
              strategyUpdate = {
                aaveApyBps,
                aaveApyPercent: aaveApyBps / 100.0,
                compoundApyBps,
                compoundApyPercent: compoundApyBps / 100.0,
                spreadBps,
                spreadPercent: spreadBps / 100.0,
                rebalanced: decoded.rebalanced
              };
              
              if (decoded.rebalanced) {
                rebalances++;
              }
            }
          } catch (err) {
            console.error('Error decoding event:', err.message);
            continue;
          }

          // Get transaction number for Reactscan URLs
          let transactionNumber = null;
          try {
            const tx = await reactiveProvider.getTransaction(log.transactionHash);
            if (tx && tx.transactionIndex !== null) {
              transactionNumber = '0x' + tx.transactionIndex.toString(16);
            }
          } catch (err) {
            // Transaction number not available
          }

          // Ensure topics is always a valid array
          const topics = Array.isArray(log.topics) && log.topics.length > 0 
            ? log.topics 
            : (eventType === 'ReactHandled' ? [reactHandledTopic] 
               : eventType === 'Callback' ? [callbackTopic]
               : eventType === 'StrategyUpdate' ? [strategyUpdateTopic]
               : []);
          
          events.push({
            transactionHash: log.transactionHash,
            blockNumber: log.blockNumber,
            topics: topics, // Always ensure valid topics array
            data: log.data || '0x',
            address: log.address || log.transactionHash,
            eventType,
            transactionNumber,
            originEvent,
            apyQuery,
            strategyUpdate,
            receivedAt: Math.floor(Date.now() / 1000),
            correlationId: log.transactionHash // Use tx hash as correlation ID
          });
        }

        // Calculate APY statistics
        const summary = {
          totalEvents: events.length,
          byType: eventCounts,
          rebalances,
          apyStats: {
            aave: apyStats.aave.length > 0 ? {
              latest: apyStats.aave[0] || 0,
              avg: apyStats.aave.reduce((a, b) => a + b, 0) / apyStats.aave.length || 0,
              count: apyStats.aave.length
            } : null,
            compound: apyStats.compound.length > 0 ? {
              latest: apyStats.compound[0] || 0,
              avg: apyStats.compound.reduce((a, b) => a + b, 0) / apyStats.compound.length || 0,
              count: apyStats.compound.length
            } : null
          }
        };

        return res.status(200).json({
          success: true,
          count: events.length,
          transactionsQueried: new Set(events.map(e => e.transactionHash)).size,
          events,
          summary,
          metadata: {
            walletAddress,
            headNumber: currentBlock.toString(16),
            rpcUrl: REACTIVE_RPC
          }
        });
      } catch (error) {
        console.error('RSC Events API Error:', error);
        return res.status(500).json({
          error: 'Failed to fetch RSC events',
          message: error.message
        });
      }
    }

    // Process webhook retry queue - call this to retry failed webhook deliveries
    if (url === '/api/webhooks/process-retries' && method === 'POST') {
      try {
        const db = getPool();
        const webhookService = new WebhookService(db);
        
        const result = await webhookService.processDeliveryQueue();
        
        return res.status(200).json({
          success: true,
          message: 'Retry queue processed',
          processed: result?.processed || 0,
          total: result?.total || 0
        });
      } catch (error) {
        console.error('Process retries error:', error);
        return res.status(500).json({ 
          error: 'Failed to process retries', 
          message: error.message 
        });
      }
    }

    // Poll for new events and trigger webhooks automatically
    // This endpoint can be called periodically (every 1-5 minutes) to trigger webhooks
    // Works independently of the explorer page - webhooks will fire automatically
    if (url.startsWith('/api/webhooks/poll-and-trigger') && method === 'GET') {
      try {
        // Skip secret check for now to test
        // TODO: Re-enable after testing
        // const secret = req.query.secret || req.headers['authorization'];
        // const expectedSecret = process.env.WEBHOOK_POLL_SECRET || process.env.CRON_SECRET || 'defeyes-webhook-poll-secret';

        const db = getPool();
        const webhookService = new WebhookService(db);

        // Find events enriched in the last 30 seconds that haven't triggered webhooks yet
        // We use a 30-second window to catch very recent events
        const thirtySecondsAgo = new Date(Date.now() - 30000); // 30 seconds ago
        
        const result = await db.query(`
          SELECT 
            e.ref_tx_hash,
            e.protocol_name,
            e.action_type,
            e.origin_user,
            e.origin_to,
            e.block_number,
            e.gas_used,
            e.token_in_symbol,
            e.token_in_amount,
            e.token_out_symbol,
            e.token_out_amount,
            e.event_timestamp,
            e.enriched_at
          FROM enriched_events e
          WHERE e.enriched_at >= $1
            AND e.enriched_at <= NOW()
            AND e.action_type IS NOT NULL 
            AND e.action_type != 'UNKNOWN'
            AND NOT EXISTS (
              SELECT 1 FROM webhook_deliveries wd 
              WHERE wd.ref_tx_hash = e.ref_tx_hash
            )
          ORDER BY e.enriched_at DESC
          LIMIT 100
        `, [thirtySecondsAgo.toISOString()]);

        const events = result.rows;
        let triggeredCount = 0;
        const errors = [];

        // Trigger webhooks for each event
        for (const event of events) {
          try {
            const triggered = await webhookService.triggerWebhooks(event);
            if (triggered.length > 0) {
              triggeredCount += triggered.length;
            }
          } catch (error) {
            errors.push({ event_id: event.id, error: error.message });
            console.error('Error triggering webhooks for event:', event.id, error);
          }
        }

        return res.status(200).json({
          success: true,
          events_processed: events.length,
          webhooks_triggered: triggeredCount,
          errors: errors.length > 0 ? errors : undefined,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Poll and trigger error:', error);
        return res.status(500).json({ 
          error: 'Failed to poll and trigger webhooks', 
          message: error.message 
        });
      }
    }

    // Cron job endpoint to automatically trigger webhooks for new events
    // This runs hourly via Vercel Cron Jobs (Hobby plan allows 1 per day, Pro allows more)
    // Also works as a manual trigger endpoint
    if (url === '/api/cron/trigger-webhooks' && method === 'GET') {
      try {
        // Verify cron secret (set in Vercel environment variables)
        // For manual triggers, pass Authorization: Bearer <CRON_SECRET> or ?secret=<CRON_SECRET>
        const cronSecret = req.headers['authorization'] || req.query.secret;
        const expectedSecret = process.env.CRON_SECRET;
        if (!expectedSecret) {
          return res.status(503).json({ error: 'Cron endpoint misconfigured (CRON_SECRET not set)' });
        }
        if (cronSecret !== expectedSecret && cronSecret !== `Bearer ${expectedSecret}`) {
          return res.status(401).json({ error: 'Unauthorized - cron endpoint requires secret' });
        }

        const db = getPool();
        const webhookService = new WebhookService(db);

        // Find events enriched in the last hour that haven't triggered webhooks yet
        // We use a 1-hour window to catch events that were enriched
        const oneHourAgo = new Date(Date.now() - 3600000); // 1 hour ago
        
        const result = await db.query(`
          SELECT 
            id,
            ref_tx_hash,
            protocol_name,
            action_type,
            origin_user,
            block_number,
            gas_used,
            gas_price_gwei,
            tx_cost_eth,
            value_eth,
            token_in_symbol,
            token_in_amount,
            token_out_symbol,
            token_out_amount,
            asset_symbol,
            token_amount,
            event_timestamp,
            enriched_at,
            created_at
          FROM enriched_events
          WHERE enriched_at >= $1
            AND enriched_at <= NOW()
          ORDER BY enriched_at DESC
          LIMIT 200
        `, [oneHourAgo.toISOString()]);

        const events = result.rows;
        let triggeredCount = 0;
        const errors = [];

        // Trigger webhooks for each event
        for (const event of events) {
          try {
            const triggered = await webhookService.triggerWebhooks(event);
            if (triggered.length > 0) {
              triggeredCount += triggered.length;
            }
          } catch (error) {
            errors.push({ event_id: event.id, error: error.message });
            console.error('Error triggering webhooks for event:', event.id, error);
          }
        }

        return res.status(200).json({
          success: true,
          events_processed: events.length,
          webhooks_triggered: triggeredCount,
          errors: errors.length > 0 ? errors : undefined,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Cron webhook trigger error:', error);
        return res.status(500).json({ 
          error: 'Failed to trigger webhooks', 
          message: error.message 
        });
      }
    }

    // Telegram cron endpoints moved to telegram-api/ (separate Vercel project: defeyes-telegram-api)
    // - /api/cron/monitor-health
    // - /api/cron/feed-to-telegram
    // - /api/cron/insight-to-telegram

    // =========================================================================
    // LIVE MONITOR ENDPOINTS
    // =========================================================================
    
    // Get wallet address from environment (prioritize Reactive Network wallet)
    if (url === '/api/wallet' && method === 'GET') {
      try {
        // Try to get Reactive Network wallet first (for live monitor)
        const reactivePrivateKey = process.env.NEW_REACTIVE_PRIVATE_KEY || process.env.REACTIVE_PRIVATE_KEY;
        if (reactivePrivateKey) {
          // Clean the private key (remove whitespace, ensure 0x prefix)
          let cleanKey = reactivePrivateKey.trim();
          if (!cleanKey.startsWith('0x')) {
            cleanKey = '0x' + cleanKey;
          }
          
          // Validate private key format
          if (cleanKey.length !== 66) {
            console.error('Wallet endpoint: Invalid private key length:', cleanKey.length);
            return res.status(500).json({ 
              error: 'Invalid private key format',
              message: 'Private key must be 66 characters (including 0x prefix)',
              debug: { keyLength: cleanKey.length, hasNewKey: !!process.env.NEW_REACTIVE_PRIVATE_KEY, hasOldKey: !!process.env.REACTIVE_PRIVATE_KEY }
            });
          }
          
          try {
            const REACTIVE_RPC = process.env.REACTIVE_RPC || 'https://mainnet-rpc.rnk.dev';
            const provider = new ethers.providers.JsonRpcProvider(REACTIVE_RPC, {
              name: 'reactive',
              chainId: 1597
            });
            const wallet = new ethers.Wallet(cleanKey, provider);
            return res.status(200).json({ address: wallet.address });
          } catch (walletError) {
            console.error('Wallet endpoint: Failed to create wallet:', walletError);
            return res.status(500).json({ 
              error: 'Failed to initialize wallet',
              message: walletError.message,
              type: 'WALLET_INIT_ERROR'
            });
          }
        }
        
        // Fallback to other wallet addresses
        const walletAddress = process.env.WALLET_ADDRESS || process.env.X402_WALLET || X402_CONFIG.paymentWallet;
        if (!walletAddress) {
          return res.status(404).json({ error: 'Wallet address not configured' });
        }
        return res.status(200).json({ address: walletAddress });
      } catch (error) {
        console.error('Wallet endpoint error:', error);
        console.error('Error stack:', error.stack);
        return res.status(500).json({ 
          error: 'Failed to get wallet address', 
          message: error.message,
          type: error.name || 'UNKNOWN_ERROR'
        });
      }
    }
    
    // =========================================================================
    // WALLET PERSONA GENERATION (AI-powered)
    // =========================================================================
    if ((url === '/api/wallet/persona' || url.startsWith('/api/wallet/persona?')) && method === 'GET') {
      const personaStart = Date.now();
      try {
        const urlObj = new URL(url, 'http://localhost');
        const walletAddress = urlObj.searchParams.get('address');
        const forceRefresh = urlObj.searchParams.get('refresh') === '1' || urlObj.searchParams.get('refresh') === 'true';
        
        if (!walletAddress || !ethers.utils.isAddress(walletAddress)) {
          return res.status(400).json({ 
            error: 'Invalid wallet address',
            message: 'Please provide a valid Ethereum address via ?address= parameter'
          });
        }
        
        // Import persona service
        const personaService = require('./services/personaService');
        
        // Get wallet events to calculate statistics
        const db = getPool();
        const eventsQuery = `
          SELECT 
            ref_tx_hash,
            protocol_name,
            action_type,
            value_eth,
            token_in_symbol,
            token_in_amount,
            token_out_symbol,
            token_out_amount,
            asset_symbol,
            event_timestamp,
            gas_used,
            apy_percent
          FROM enriched_events
          WHERE LOWER(origin_user) = LOWER($1)
            AND action_type IS NOT NULL
            AND action_type != 'UNKNOWN'
            AND action_type != 'RESERVE_DATA_UPDATED'
          ORDER BY event_timestamp DESC
          LIMIT 500
        `;
        
        const result = await db.query(eventsQuery, [walletAddress]);
        const events = result.rows;
        
        if (events.length === 0) {
          return res.status(200).json({
            type: 'New Wallet',
            description: 'No activity detected yet',
            cached: false
          });
        }
        
        // Calculate wallet statistics (same logic as frontend aggregateStats)
        const stats = calculateWalletStats(events);
        
        // Generate persona using AI (forceRefresh bypasses cache when ?refresh=1)
        const persona = await personaService.generateWalletPersona(stats, walletAddress, forceRefresh);
        const personaMs = Date.now() - personaStart;
        console.log(`[PERSONA] ${walletAddress.slice(0, 10)}... ${persona.cached ? 'cache_hit' : 'generated'} ${personaMs}ms`);
        
        return res.status(200).json({
          type: persona.type,
          description: persona.description,
          walletAddress,
          totalEvents: stats.totalEvents,
          sampledCount: stats.sampledCount,
          cached: persona.cached === true,
          source: persona.source || 'ai'
        });
      } catch (error) {
        const personaMs = Date.now() - personaStart;
        console.error('[PERSONA] error', error.message, `${personaMs}ms`);
        return res.status(500).json({
          error: 'Failed to generate persona',
          message: error.message,
          type: 'Fallback',
          description: 'DeFi participant'
        });
      }
    }
    
    // Check contract status (balance, reserves, debt)
    if (url === '/api/status' && method === 'POST') {
      try {
        const { rscAddress } = req.body || {};
        if (!rscAddress) {
          return res.status(400).json({ error: 'rscAddress is required' });
        }
        
        // Reactive Network configuration
        const REACTIVE_RPC = process.env.REACTIVE_RPC || 'https://mainnet-rpc.rnk.dev';
        const SYSTEM_CONTRACT = '0x0000000000000000000000000000000000fffFfF';
        
        const SYSTEM_ABI = [
          'function debts(address) view returns (uint256)',
          'function reserves(address) view returns (uint256)'
        ];
        
        // Create provider and contract instances
        const reactiveProvider = new ethers.providers.JsonRpcProvider(REACTIVE_RPC, {
          name: 'reactive',
          chainId: 1597
        });
        
        const systemContract = new ethers.Contract(SYSTEM_CONTRACT, SYSTEM_ABI, reactiveProvider);
        
        // Query contract state
        const [balance, reserves, debt] = await Promise.all([
          reactiveProvider.getBalance(rscAddress),
          systemContract.reserves(rscAddress),
          systemContract.debts(rscAddress)
        ]);
        
        // Format as strings (in REACT, 18 decimals)
        const balanceFormatted = ethers.utils.formatEther(balance);
        const reservesFormatted = ethers.utils.formatEther(reserves);
        const debtFormatted = ethers.utils.formatEther(debt);
        
        return res.status(200).json({
          balance: balanceFormatted,
          reserves: reservesFormatted,
          debt: debtFormatted
        });
      } catch (error) {
        console.error('Status endpoint error:', error);
        return res.status(500).json({ 
          error: 'Failed to check contract status', 
          message: error.message 
        });
      }
    }

    // =========================================================================
    // FUND ENDPOINTS (Reactive Network)
    // =========================================================================
    
    // Fund contract reserves (using old wallet)
    if (url === '/api/fund' && method === 'POST') {
      try {
        const { rscAddress, amount } = req.body || {};
        if (!rscAddress || !amount) {
          return res.status(400).json({ error: 'rscAddress and amount are required' });
        }
        
        const REACTIVE_RPC = (process.env.REACTIVE_RPC || 'https://mainnet-rpc.rnk.dev').trim().replace(/[\r\n]/g, '');
        let REACTIVE_PRIVATE_KEY = process.env.REACTIVE_PRIVATE_KEY;
        const SYSTEM_CONTRACT = '0x0000000000000000000000000000000000fffFfF';
        
        if (!REACTIVE_PRIVATE_KEY) {
          return res.status(500).json({ error: 'REACTIVE_PRIVATE_KEY not configured' });
        }
        
        // Clean the private key (remove whitespace/newlines, ensure 0x prefix)
        REACTIVE_PRIVATE_KEY = REACTIVE_PRIVATE_KEY.trim().replace(/[\r\n]/g, '');
        if (!REACTIVE_PRIVATE_KEY.startsWith('0x')) {
          REACTIVE_PRIVATE_KEY = '0x' + REACTIVE_PRIVATE_KEY;
        }
        
        const SYSTEM_ABI = [
          'function debts(address) view returns (uint256)',
          'function reserves(address) view returns (uint256)',
          'function depositTo(address) payable'
        ];
        
        const provider = new ethers.providers.JsonRpcProvider(REACTIVE_RPC, {
          name: 'reactive',
          chainId: 1597
        });
        
        const wallet = new ethers.Wallet(REACTIVE_PRIVATE_KEY, provider);
        const systemContract = new ethers.Contract(SYSTEM_CONTRACT, SYSTEM_ABI, wallet);
        
        // Check current status
        const [balance, debt, reserves] = await Promise.all([
          provider.getBalance(rscAddress),
          systemContract.debts(rscAddress),
          systemContract.reserves(rscAddress)
        ]);
        
        // Fund reserves via depositTo (automatically settles debt)
        const amountWei = ethers.utils.parseEther(amount.toString());
        const tx = await systemContract.depositTo(rscAddress, { value: amountWei });
        await tx.wait();
        
        // Get updated status
        const [newBalance, newDebt, newReserves] = await Promise.all([
          provider.getBalance(rscAddress),
          systemContract.debts(rscAddress),
          systemContract.reserves(rscAddress)
        ]);
        
        return res.status(200).json({
          success: true,
          txHash: tx.hash,
          walletAddress: wallet.address,
          balance: ethers.utils.formatEther(newBalance),
          reserves: ethers.utils.formatEther(newReserves),
          debt: ethers.utils.formatEther(newDebt)
        });
      } catch (error) {
        console.error('Fund endpoint error:', error);
        return res.status(500).json({ 
          error: 'Failed to fund contract', 
          message: error.message 
        });
      }
    }
    
    // Fund contract reserves (using new wallet)
    if (url === '/api/fund-new-wallet' && method === 'POST') {
      try {
        const { rscAddress, amount } = req.body || {};
        if (!rscAddress || !amount) {
          return res.status(400).json({ error: 'rscAddress and amount are required' });
        }
        
        // Clean RPC URL (remove trailing whitespace/newlines)
        const REACTIVE_RPC = (process.env.REACTIVE_RPC || 'https://mainnet-rpc.rnk.dev').trim().replace(/[\r\n]/g, '');
        let REACTIVE_PRIVATE_KEY = process.env.NEW_REACTIVE_PRIVATE_KEY || process.env.REACTIVE_PRIVATE_KEY;
        const SYSTEM_CONTRACT = '0x0000000000000000000000000000000000fffFfF';
        
        if (!REACTIVE_PRIVATE_KEY) {
          console.error('Fund-new-wallet: Missing private key. NEW_REACTIVE_PRIVATE_KEY:', !!process.env.NEW_REACTIVE_PRIVATE_KEY, 'REACTIVE_PRIVATE_KEY:', !!process.env.REACTIVE_PRIVATE_KEY);
          return res.status(500).json({ 
            error: 'NEW_REACTIVE_PRIVATE_KEY or REACTIVE_PRIVATE_KEY not configured',
            debug: {
              hasNewKey: !!process.env.NEW_REACTIVE_PRIVATE_KEY,
              hasOldKey: !!process.env.REACTIVE_PRIVATE_KEY,
              rpc: REACTIVE_RPC
            }
          });
        }
        
        // Clean the private key (remove whitespace/newlines, ensure 0x prefix)
        REACTIVE_PRIVATE_KEY = REACTIVE_PRIVATE_KEY.trim().replace(/[\r\n]/g, '');
        if (!REACTIVE_PRIVATE_KEY.startsWith('0x')) {
          REACTIVE_PRIVATE_KEY = '0x' + REACTIVE_PRIVATE_KEY;
        }
        
        // Validate private key format (should be 66 chars: 0x + 64 hex chars)
        if (REACTIVE_PRIVATE_KEY.length !== 66) {
          console.error('Fund-new-wallet: Invalid private key length:', REACTIVE_PRIVATE_KEY.length);
          return res.status(500).json({ 
            error: 'Invalid private key format',
            message: 'Private key must be 66 characters (including 0x prefix)',
            debug: { keyLength: REACTIVE_PRIVATE_KEY.length }
          });
        }
        
        const SYSTEM_ABI = [
          'function debts(address) view returns (uint256)',
          'function reserves(address) view returns (uint256)',
          'function depositTo(address) payable'
        ];
        
        // Create provider with timeout
        const provider = new ethers.providers.JsonRpcProvider(REACTIVE_RPC, {
          name: 'reactive',
          chainId: 1597
        });
        
        // Set timeout for provider calls (30 seconds)
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('RPC timeout after 30 seconds')), 30000)
        );
        
        let wallet, systemContract;
        try {
          wallet = new ethers.Wallet(REACTIVE_PRIVATE_KEY, provider);
          systemContract = new ethers.Contract(SYSTEM_CONTRACT, SYSTEM_ABI, wallet);
          console.log('Fund-new-wallet: Wallet address:', wallet.address);
        } catch (err) {
          console.error('Fund-new-wallet: Failed to create wallet/contract:', err);
          console.error('Error details:', {
            message: err.message,
            code: err.code,
            stack: err.stack
          });
          return res.status(500).json({ 
            error: 'Failed to initialize wallet',
            message: err.message,
            type: 'WALLET_INIT_ERROR',
            code: err.code || 'UNKNOWN'
          });
        }
        
        // Check current status with timeout
        let balance, debt, reserves;
        try {
          [balance, debt, reserves] = await Promise.race([
            Promise.all([
              provider.getBalance(rscAddress),
              systemContract.debts(rscAddress),
              systemContract.reserves(rscAddress)
            ]),
            timeoutPromise
          ]);
        } catch (err) {
          console.error('Fund-new-wallet: Failed to get status:', err);
          return res.status(500).json({ 
            error: 'Failed to query contract status',
            message: err.message,
            type: err.message.includes('timeout') ? 'RPC_TIMEOUT' : 'RPC_ERROR'
          });
        }
        
        // Fund reserves via depositTo (automatically settles debt)
        const amountWei = ethers.utils.parseEther(amount.toString());
        
        // Check wallet balance before sending
        const walletBalance = await Promise.race([
          provider.getBalance(wallet.address),
          timeoutPromise
        ]);
        
        const feeData = await Promise.race([
          provider.getFeeData(),
          timeoutPromise
        ]);
        const gasPrice = feeData.gasPrice || ethers.BigNumber.from('1000000000');
        const estimatedGas = ethers.BigNumber.from(100000);
        const gasCost = estimatedGas.mul(gasPrice);
        const totalNeeded = amountWei.add(gasCost);
        
        if (walletBalance.lt(totalNeeded)) {
          return res.status(400).json({ 
            error: 'Insufficient wallet balance',
            walletBalance: ethers.utils.formatEther(walletBalance),
            required: ethers.utils.formatEther(totalNeeded),
            amount: ethers.utils.formatEther(amountWei),
            gasEstimate: ethers.utils.formatEther(gasCost)
          });
        }
        
        let tx;
        try {
          tx = await Promise.race([
            systemContract.depositTo(rscAddress, { value: amountWei }),
            timeoutPromise
          ]);
          await Promise.race([
            tx.wait(),
            timeoutPromise
          ]);
        } catch (err) {
          console.error('Fund-new-wallet: Transaction failed:', err);
          return res.status(500).json({ 
            error: 'Transaction failed',
            message: err.message,
            txHash: tx?.hash || null,
            type: err.message.includes('timeout') ? 'TX_TIMEOUT' : 'TX_ERROR'
          });
        }
        
        // Get updated status
        let newBalance, newDebt, newReserves;
        try {
          [newBalance, newDebt, newReserves] = await Promise.race([
            Promise.all([
              provider.getBalance(rscAddress),
              systemContract.debts(rscAddress),
              systemContract.reserves(rscAddress)
            ]),
            timeoutPromise
          ]);
        } catch (err) {
          console.error('Fund-new-wallet: Failed to get updated status:', err);
          // Transaction succeeded but status check failed - still return success
          return res.status(200).json({
            success: true,
            txHash: tx.hash,
            walletAddress: wallet.address,
            warning: 'Transaction succeeded but status check failed',
            error: err.message
          });
        }
        
        return res.status(200).json({
          success: true,
          txHash: tx.hash,
          walletAddress: wallet.address,
          balance: ethers.utils.formatEther(newBalance),
          reserves: ethers.utils.formatEther(newReserves),
          debt: ethers.utils.formatEther(newDebt)
        });
      } catch (error) {
        console.error('Fund-new-wallet endpoint error:', error);
        console.error('Error stack:', error.stack);
        return res.status(500).json({ 
          error: 'Failed to fund contract', 
          message: error.message,
          type: error.name || 'UNKNOWN_ERROR'
        });
      }
    }

    // 404 for unknown routes
    return res.status(404).json({ error: 'Not found', path: url });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      hint: 'Check database connection and environment variables'
    });
  }
};
