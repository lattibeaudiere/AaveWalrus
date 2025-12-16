-- PostgreSQL Schema for Aave Dataset Storage
-- Includes Walrus Protocol integration for decentralized blob storage

-- Assets table (for reference, e.g., USDC, WETH, WBTC, USDT)
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    address VARCHAR(42) UNIQUE NOT NULL,  -- e.g., 0x... USDC address on Arbitrum
    symbol VARCHAR(10) NOT NULL,  -- e.g., USDC
    name VARCHAR(50),
    chain_id INTEGER DEFAULT 42161,  -- Arbitrum
    created_at TIMESTAMP DEFAULT NOW()
);

-- Main events table with Walrus integration
CREATE TABLE IF NOT EXISTS aave_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_address VARCHAR(42) REFERENCES assets(address) ON DELETE SET NULL,
    
    -- Event Type
    event_type VARCHAR(50),  -- 'ReactHandled', 'Callback', 'StrategyUpdate'
    
    -- Metadata (stored in PostgreSQL for fast queries)
    supply_apy_ray NUMERIC(30,0),  -- Raw RAY format (1e27, needs NUMERIC not BIGINT)
    borrow_apy_ray NUMERIC(30,0),
    stable_borrow_rate_ray NUMERIC(30,0),
    variable_borrow_rate_ray NUMERIC(30,0),
    supply_apy_bps INTEGER,  -- Basis points
    borrow_apy_bps INTEGER,
    stable_borrow_rate_bps INTEGER,
    variable_borrow_rate_bps INTEGER,
    supply_apy_percent NUMERIC(10,4),  -- Human-readable percent
    borrow_apy_percent NUMERIC(10,4),
    stable_borrow_rate_percent NUMERIC(10,4),
    variable_borrow_rate_percent NUMERIC(10,4),
    
    -- Interest Indices
    liquidity_index NUMERIC(30,0),
    variable_borrow_index NUMERIC(30,0),
    
    -- Timestamps
    block_timestamp TIMESTAMP NOT NULL,
    server_timestamp TIMESTAMP DEFAULT NOW(),
    transaction_timestamp BIGINT,  -- Unix timestamp from block
    
    -- Transaction Info
    tx_hash VARCHAR(66) NOT NULL,  -- 0x...
    block_number BIGINT NOT NULL,
    transaction_number VARCHAR(50),  -- Reactive Network transaction number
    correlation_id VARCHAR(255),  -- Links related events
    
    -- Strategy Data (for StrategyUpdate events)
    aave_apy_bps INTEGER,
    compound_apy_bps INTEGER,
    spread_bps INTEGER,
    rebalanced BOOLEAN,
    direction VARCHAR(20),  -- 'AaveToCompound', 'CompoundToAave', 'Equal'
    higher_apy VARCHAR(20),  -- 'Aave', 'Compound', 'Equal'
    
    -- Full data (can be NULL after Walrus backup)
    full_data JSONB,  -- Complete decoded event JSON
    
    -- Walrus integration
    walrus_blob_id VARCHAR(255),  -- Reference to Walrus storage
    walrus_backed_up_at TIMESTAMP,  -- When backed up to Walrus
    
    -- Indexes for performance
    UNIQUE (tx_hash, asset_address, event_type)  -- Prevent duplicates
);

-- Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_events_asset_address ON aave_events(asset_address);
CREATE INDEX IF NOT EXISTS idx_events_block_timestamp ON aave_events(block_timestamp);
CREATE INDEX IF NOT EXISTS idx_events_server_timestamp ON aave_events(server_timestamp);
CREATE INDEX IF NOT EXISTS idx_events_tx_hash ON aave_events(tx_hash);
CREATE INDEX IF NOT EXISTS idx_events_walrus_blob_id ON aave_events(walrus_blob_id);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON aave_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_correlation_id ON aave_events(correlation_id);
CREATE INDEX IF NOT EXISTS idx_events_supply_apy_percent ON aave_events(supply_apy_percent);

-- Function to update server_timestamp (if needed for updates)
CREATE OR REPLACE FUNCTION update_server_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.server_timestamp = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for server_timestamp
CREATE TRIGGER update_events_server_timestamp 
    BEFORE UPDATE ON aave_events
    FOR EACH ROW 
    EXECUTE FUNCTION update_server_timestamp_column();

-- Insert known assets
INSERT INTO assets (address, symbol, name, chain_id) VALUES
    ('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 'USDC', 'USD Coin', 42161),
    ('0x82e64f49Ed5EC1bC6e43DAD4FC8Af9bb3A2312EE', 'WETH', 'Wrapped Ether', 42161),
    ('0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f', 'WBTC', 'Wrapped Bitcoin', 42161),
    ('0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', 'USDT', 'Tether USD', 42161)
ON CONFLICT (address) DO NOTHING;

