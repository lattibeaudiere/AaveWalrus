# Detailed Breakdown: Aave Data Capture & Frontend Flow

## 🎯 Application Overview

This is an **autonomous yield optimization system** that:
1. **Monitors** Aave V3 and Compound V3 APY rates on Arbitrum
2. **Automatically rebalances** USDC between protocols when spread > 30 bps
3. **Captures comprehensive APY data** for dataset building and analysis

---

## 📊 Aave Data Being Captured

### 1. Event Source: Aave V3 ReserveDataUpdated

**What Triggers Data Capture:**
- **Event:** `ReserveDataUpdated(address indexed reserve, uint256 liquidityRate, uint256 stableBorrowRate, uint256 variableBorrowRate, uint256 liquidityIndex, uint256 variableBorrowIndex)`
- **Contract:** Aave V3 Pool (`0x794a61358D6845594F94dc1DB02A252b5b4814aD`) on Arbitrum
- **Frequency:** ~6,480 events/day across all assets

**When This Event Fires:**
- User deposits assets into Aave
- User withdraws assets from Aave
- User borrows assets
- User repays loans
- Interest accrues on the pool
- APY rates change (even by 0.01%)

### 2. Assets Being Monitored

**Multi-Asset Coverage:**
- **USDC:** ~3.22% APY (most frequent, ~1,000-2,000 events/day)
- **WETH:** ~1.72% APY
- **WBTC:** ~0.02% APY
- **USDT:** Also monitored

**Why Multiple Assets:**
- Build comprehensive dataset across DeFi markets
- Track cross-asset correlations
- Enable multi-asset trading strategies
- Provide richer dataset for commercial sales

### 3. Data Points Captured Per Event

**From ReserveDataUpdated Event:**
```javascript
{
  // Reserve Information
  reserve: "0x...",                    // Asset address (USDC, WETH, etc.)
  
  // APY Rates (in RAY format: 1e27, converted to bps/percent)
  liquidityRate: "302342251068641",     // Supply APY (raw)
  liquidityRateBps: "302",              // Supply APY in basis points
  liquidityRatePercent: 3.02,           // Supply APY as percentage
  
  stableBorrowRate: "...",             // Stable borrow rate
  variableBorrowRate: "...",            // Variable borrow rate
  
  // Interest Indices
  liquidityIndex: "...",                // Current liquidity index
  variableBorrowIndex: "..."            // Current borrow index
}
```

**Additional Metadata Captured:**
- `blockNumber`: Block where event occurred
- `transactionHash`: Transaction hash
- `transactionTimestamp`: Block timestamp
- `receivedAt`: Server-side timestamp (ensures every event has timestamp)
- `correlationId`: Links related events from same transaction
- `eventType`: 'ReactHandled', 'Callback', or 'StrategyUpdate'

### 4. Three Types of Events Captured

#### A. ReactHandled Events
**What:** Reactive Network detects Aave event and calls our contract
**Contains:**
- Reference to original Aave event (chainId, emitter, txHash, logIndex)
- Server fetches full event from Arbitrum and decodes it
- Complete APY data extracted

**Data Flow:**
```
Aave emits ReserveDataUpdated
  ↓
Reactive Network detects event
  ↓
Calls FusionReactiveRSC.react()
  ↓
Contract emits ReactHandled event
  ↓
server.js fetches original event from Arbitrum
  ↓
Decodes ReserveDataUpdated event
  ↓
Extracts APY values (converts RAY to bps/percent)
  ↓
Sends to frontend
```

#### B. Callback Events
**What:** RSC emits callbacks for execution on Arbitrum
**Types:**
- `queryAaveApy()` - Records Aave APY data (function selector: `0xeb45e4d1`)
- `queryCompoundApy()` - Queries Compound APY (function selector: `0xcb3dd0fd`)
- `executeReaction()` - Rebalancing execution (function selector: `0x90b87782`)

**Aave APY Query Callback Data:**
```javascript
{
  protocol: "Aave",
  assetAddress: "0x...",
  apyBps: 322,                    // APY in basis points
  apyPercent: 3.22,               // APY as percentage
  queryTimestamp: 1765824439,     // When query was made
  transactionTimestamp: 1765824439
}
```

**Why Callbacks Are Needed:**
- Record APY data for dataset building
- Track percent changes between events
- Build comprehensive historical record
- Support multi-asset data collection

#### C. StrategyUpdate Events
**What:** RSC emits after comparing Aave vs Compound APY
**Contains:**
```javascript
{
  aaveApyBps: "322",
  aaveApyPercent: 3.22,
  compoundApyBps: "265",
  compoundApyPercent: 2.65,
  spreadBps: "57",                // Difference in basis points
  spreadPercent: 0.57,             // Difference as percentage
  rebalanced: true,                // Whether rebalance occurred
  direction: "AaveToCompound",     // Which way funds moved
  higherApy: "Aave"                // Which protocol has higher APY
}
```

---

## 🔄 Data Flow: From Blockchain to Frontend

### Step-by-Step Flow

```
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: Aave Protocol (Arbitrum Chain 42161)                │
│                                                              │
│ User deposits/withdraws → ReserveDataUpdated event emitted  │
│ Contains: liquidityRate, borrowRates, indices               │
└────────────────────────────┬────────────────────────────────┘
                              │
                              │ Event Logged on Arbitrum
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: Reactive Network (Chain 1597)                       │
│                                                              │
│ Subscription matches ReserveDataUpdated event                │
│ Calls FusionReactiveRSC.react() function                    │
│ Contract emits ReactHandled event                           │
└────────────────────────────┬────────────────────────────────┘
                              │
                              │ ReactHandled Event
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 3: server.js API (Node.js Backend)                     │
│                                                              │
│ 1. Fetches transactions from Reactive Network RPC           │
│ 2. Gets logs for each transaction                            │
│ 3. Filters for ReactHandled, Callback, StrategyUpdate events │
│ 4. For ReactHandled:                                         │
│    - Fetches original Aave event from Arbitrum               │
│    - Decodes ReserveDataUpdated event                       │
│    - Converts RAY format to bps/percent                      │
│ 5. For Callback:                                             │
│    - Decodes payload (queryAaveApy, queryCompoundApy, etc.)│
│    - Extracts APY values                                     │
│ 6. For StrategyUpdate:                                       │
│    - Decodes strategy comparison data                        │
│    - Calculates spread and direction                        │
│ 7. Adds metadata:                                            │
│    - receivedAt (server timestamp)                          │
│    - correlationId (links related events)                    │
│    - eventType                                               │
│ 8. Returns JSON response                                    │
└────────────────────────────┬────────────────────────────────┘
                              │
                              │ HTTP POST /api/rsc-events
                              │ JSON Response
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 4: Frontend (live-monitor.html)                         │
│                                                              │
│ 1. Polls /api/rsc-events every few seconds                  │
│ 2. Receives events array with all decoded data              │
│ 3. Displays events in real-time table                       │
│ 4. Shows:                                                     │
│    - APY values (Aave, Compound)                            │
│    - Spread calculations                                     │
│    - Rebalancing decisions                                  │
│    - Transaction links (Reactscan, Arbiscan)                  │
│    - Timestamps and correlation IDs                          │
│ 5. Updates summary statistics                               │
│    - Total events                                            │
│    - Events by type                                          │
│    - APY statistics (min, max, avg, latest)                 │
│    - Rebalance count                                         │
└─────────────────────────────────────────────────────────────┘
```

### Code Flow in server.js

**Key Function: `/api/rsc-events` endpoint**

```javascript
// 1. Get RVM ID from RSC address
const mapping = await callRnkRpc('rnk_getRnkAddressMapping', [rscAddress]);
const rvmId = mapping.rvmId;

// 2. Get latest transaction number
const headNumber = await callRnkRpc('rnk_getHeadNumber', [rvmId]);

// 3. Get transactions (last N transactions)
const transactions = await callRnkRpc('rnk_getTransactions', [rvmId, fromHex, limitHex]);

// 4. For each transaction, get logs
for (const tx of transactions) {
  const logs = await callRnkRpc('rnk_getTransactionLogs', [rvmId, tx.number]);
  
  // 5. Filter and decode events
  for (const log of logs) {
    if (topic0 === reactHandledTopic) {
      // Decode ReactHandled event
      const decoded = reactHandledIface.decodeEventLog('ReactHandled', log.data, log.topics);
      
      // Fetch original Aave event from Arbitrum
      const originEvent = await fetchOriginAaveEvent(
        decoded.chainId,
        decoded.emitter,
        decoded.txHash,
        decoded.logIndex
      );
      
      // Decode ReserveDataUpdated event
      const decodedAave = aaveEventIface.decodeEventLog('ReserveDataUpdated', ...);
      
      // Convert RAY to percentage
      const liquidityRatePercent = decodedAave.liquidityRate.mul(100).div(RAY);
      
      // Add to eventData
      eventData.originEvent.decoded = {
        reserve: decodedAave.reserve,
        liquidityRatePercent: parseFloat(liquidityRatePercent.toString()) / 100,
        // ... more fields
      };
    }
    
    if (topic0 === callbackTopic) {
      // Decode Callback event
      const decoded = callbackIface.decodeEventLog('Callback', log.data, log.topics);
      
      // Extract function selector from payload
      const functionSelector = decoded.payload.slice(0, 10);
      
      if (functionSelector === '0xeb45e4d1') { // queryAaveApy
        // Decode APY query parameters
        eventData.apyQuery = {
          protocol: 'Aave',
          assetAddress: assetAddr,
          apyBps: apyBps,
          apyPercent: apyBps / 100,
          // ...
        };
      }
    }
    
    if (topic0 === strategyUpdateTopic) {
      // Decode StrategyUpdate event
      const decoded = strategyUpdateIface.decodeEventLog('StrategyUpdate', ...);
      
      eventData.strategyUpdate = {
        aaveApyPercent: parseFloat(decoded.aaveApy.toString()) / 100,
        compoundApyPercent: parseFloat(decoded.compoundApy.toString()) / 100,
        spreadPercent: parseFloat(decoded.spread.toString()) / 100,
        rebalanced: decoded.rebalanced,
        // ...
      };
    }
    
    events.push(eventData);
  }
}

// 6. Return events as JSON
res.json({
  events: events,
  count: events.length,
  summary: { /* statistics */ },
  metadata: { /* context */ }
});
```

### Frontend Polling

**Key Function: `pollReactive()`**

```javascript
async function pollReactive() {
  // 1. Call API
  const response = await fetch('/api/rsc-events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      rscAddress: state.config.rsc,
      limit: 50
    })
  });
  
  const data = await response.json();
  
  // 2. Process each event
  data.events.forEach(event => {
    // Convert to log format
    const log = {
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash,
      topics: event.topics,
      data: event.data,
      originEvent: event.originEvent,        // Aave event data
      callbackData: event.callbackData,      // Callback data
      apyQuery: event.apyQuery,              // APY query data
      strategyUpdate: event.strategyUpdate,  // Strategy data
      receivedAt: event.receivedAt,
      correlationId: event.correlationId,
      eventType: event.eventType
    };
    
    // 3. Display event
    handleReactiveLog(log);
  });
  
  // 4. Update summary statistics
  if (data.summary) {
    displaySummary(data.summary);
  }
}

// Poll every few seconds
setInterval(pollReactive, 5000);
```

---

## 💾 Dataset Storage Layer: Intention & Design

### Primary Purpose

The dataset storage layer is designed to **capture and preserve comprehensive APY data** from Aave V3 across multiple assets for:

1. **Research & Analysis**
   - Academic research on DeFi yield dynamics
   - Market microstructure studies
   - APY prediction model development
   - Volatility analysis

2. **Trading Strategy Development**
   - Backtesting yield optimization strategies
   - Identifying arbitrage opportunities
   - Multi-asset correlation analysis
   - Historical pattern recognition

3. **Commercial Dataset Sales**
   - Selling high-frequency APY data to quant trading firms
   - Providing data feeds to analytics platforms
   - Supporting research institutions
   - Enabling competitive intelligence for DeFi protocols

### Current Implementation Status

**⚠️ CRITICAL: The dataset storage layer is NOT YET FULLY IMPLEMENTED**

**What's Working:**
- ✅ Real-time event capture via `server.js` API
- ✅ Event decoding (APY values, timestamps, changes)
- ✅ Frontend display in dashboard
- ✅ Event correlation and metadata

**What's Missing:**
- ❌ **Persistent storage** - Events are NOT saved to database/file system
- ❌ **Data export** - No way to export data for analysis
- ❌ **Historical queries** - Can only see recent events
- ❌ **Data retention** - Events are lost when server restarts

**The Data is Ephemeral:**
- Events only exist in memory during API call
- Frontend only shows recent events (last 50 transactions)
- No historical data available
- Data lost if server restarts

### Why Build Dataset Storage Layer

**Data Volume:**
- ~6,480 events/day (all assets)
- ~194,400 events/month
- Multiple assets: USDC, WETH, WBTC, USDT
- Complete APY history with percent changes

**Data Value:**
- High-frequency APY data (sub-minute granularity)
- Multi-asset coverage
- Complete historical record
- Real-time capture with no delays
- Rich metadata (timestamps, correlation IDs, transaction hashes)

**Market Opportunity:**
- Quant trading firms: $500-5,000/month
- Research institutions: $100-500/month
- DeFi analytics platforms: $500-2,000/month
- DeFi protocols: $200-1,000/month
- **Total Addressable Market:** $20,000-50,000/month (conservative)

**Cost vs Value:**
- Current cost: ~$110/month (Reactive Network callbacks)
- Break-even: 1 customer
- ROI Potential: 5-50x

### What Needs to Be Built

#### 1. Persistent Storage Backend

**Options:**

**A. File-Based Storage (Quick Start)**
- **Pros:** Simple, fast to implement, easy export
- **Cons:** Limited query capabilities, not scalable
- **Best For:** Quick prototype, small datasets
- **Implementation:** JSONL files (one per day)

**B. Time-Series Database (Recommended)**
- **Pros:** Optimized for time-series data, efficient queries
- **Cons:** Requires database setup
- **Best For:** Production, large datasets
- **Options:** TimescaleDB (PostgreSQL extension), InfluxDB

**C. SQL Database**
- **Pros:** Structured queries, relational integrity
- **Cons:** May need optimization for time-series
- **Best For:** Complex queries, relational data
- **Options:** PostgreSQL, MySQL

**D. NoSQL Database**
- **Pros:** Flexible schema, easy scaling
- **Cons:** Less structured queries
- **Best For:** Evolving event structure
- **Options:** MongoDB, DynamoDB

**Recommended Approach:**
- **Phase 1:** File-based (JSONL) for immediate storage
- **Phase 2:** Migrate to TimescaleDB for production

#### 2. Data Schema Design

**Core Event Table Structure:**

```sql
CREATE TABLE apy_events (
    id SERIAL PRIMARY KEY,
    
    -- Event Identification
    event_type VARCHAR(50),           -- 'ReactHandled', 'Callback', 'StrategyUpdate'
    transaction_hash VARCHAR(66),     -- Transaction hash
    transaction_number BIGINT,        -- Reactive Network transaction number
    block_number BIGINT,              -- Block number
    transaction_timestamp BIGINT,     -- Block timestamp
    received_at BIGINT,               -- Server-side timestamp
    correlation_id VARCHAR(100),     -- Links related events
    
    -- APY Data
    protocol VARCHAR(20),             -- 'Aave', 'Compound'
    asset_address VARCHAR(42),        -- Token address (USDC, WETH, etc.)
    apy_bps INTEGER,                  -- APY in basis points
    apy_percent DECIMAL(10,4),       -- APY as percentage
    
    -- Strategy Data (for StrategyUpdate events)
    aave_apy_bps INTEGER,
    compound_apy_bps INTEGER,
    spread_bps INTEGER,
    rebalanced BOOLEAN,
    direction VARCHAR(20),            -- 'AaveToCompound', 'CompoundToAave', 'Equal'
    
    -- Raw Event Data
    raw_event_data JSONB,            -- Complete event structure (for flexibility)
    
    -- Indexes for fast queries
    INDEX idx_timestamp (received_at),
    INDEX idx_asset (asset_address),
    INDEX idx_protocol (protocol),
    INDEX idx_correlation (correlation_id),
    INDEX idx_event_type (event_type)
);
```

#### 3. Data Capture Pipeline

**Current Flow:**
```
Reactive Network → server.js API → Frontend Display
```

**Needed Flow:**
```
Reactive Network → server.js API → Storage Layer → Database/File
                                      ↓
                                   Frontend Display
```

**Implementation Steps:**

1. **Add Storage Module to server.js**
   ```javascript
   // After event processing in /api/rsc-events endpoint
   // Store each event to database/file
   for (const eventData of events) {
     await storage.saveEvent(eventData);
   }
   ```

2. **Create Storage Interface**
   ```javascript
   // storage/eventStorage.js
   class EventStorage {
     async saveEvent(event) {
       // Save to database/file
     }
     
     async getEvents(filters) {
       // Query events with filters
     }
     
     async exportEvents(format, filters) {
       // Export to CSV/JSON/Parquet
     }
   }
   ```

3. **Implement Storage Backend**
   - File-based: Write to JSONL files
   - Database: Insert into SQL/NoSQL database
   - Hybrid: Both for redundancy

#### 4. Data Export & Analysis Tools

**Export Formats:**
- CSV (for Excel, Python pandas)
- JSON (for programmatic access)
- Parquet (for big data analysis)
- SQL dump (for database import)

**Analysis Capabilities:**
- Time-series queries (APY over time)
- Asset-specific queries (USDC only, WETH only)
- Spread analysis (Aave vs Compound)
- Rebalancing frequency analysis
- Percent change calculations

---

## 📈 Data Volume & Statistics

### Current Data Capture

**Per Day:**
- ~6,480 events/day (all assets combined)
- ~1,000-2,000 events/day (USDC only)
- Multiple assets: USDC, WETH, WBTC, USDT

**Per Month:**
- ~194,400 events/month (all assets)
- ~30,000-60,000 events/month (USDC only)

**Data Points Per Event:**
- APY value (basis points and percentage)
- Asset address
- Timestamp (block time + server time)
- Transaction hash
- Block number
- Percent change (calculated)
- Protocol identifier
- Correlation ID (links related events)

### Cost Analysis

**Current System (Comprehensive Data Capture):**
- Per Event: $0.000560 (callback cost)
- Daily: $3.63/day (6,480 events)
- Monthly: $108.87/month
- Annual: $1,324.49/year

**Cost Justification:**
- High-frequency data (~6,480 events/day)
- Multi-asset coverage
- Complete historical record
- Real-time capture
- Rich metadata

---

## 🎯 Summary

### What the App Does

1. **Autonomous Yield Optimization**
   - Monitors Aave and Compound APY rates
   - Automatically rebalances when spread > 30 bps
   - Executes via IPOR Fusion Vault

2. **Dataset Collection (Current State)**
   - Captures all APY events in real-time
   - Decodes and enriches event data
   - Displays in frontend dashboard
   - **⚠️ NOT YET PERSISTED TO STORAGE**

### Dataset Storage Layer Intention

**Purpose:** Build a comprehensive, high-frequency APY dataset for:
- Research and analysis
- Trading strategy development
- Commercial dataset sales
- Competitive intelligence

**Current Status:** Data capture working, persistence needed

**What to Build:**
1. Persistent storage backend (file or database)
2. Data export tools (CSV, JSON, Parquet)
3. Query and analysis capabilities
4. Historical data management

**Value Proposition:**
- High-frequency data (~6,480 events/day)
- Multi-asset coverage (USDC, WETH, WBTC, USDT)
- Complete historical record
- Real-time capture with no delays

**Market Opportunity:**
- TAM: $20,000-50,000/month (realistic)
- Break-even: 1 customer
- ROI: 5-50x potential

---

**Status:** ✅ Data capture working | ⏳ Storage layer needs implementation  
**Priority:** High - Data is currently ephemeral and lost if not stored  
**Timeline:** 1-2 days for basic file storage, 3-5 days for database integration

