-- IPOR Fusion Yield Optimizer Dashboard
-- Dune Analytics Query
-- Monitors StrategyUpdate events and calculates performance metrics

-- StrategyUpdate Event Structure:
-- event StrategyUpdate(uint256 aaveApy, uint256 compoundApy, uint256 spread, bool rebalanced);

WITH strategy_events AS (
    SELECT
        block_time,
        tx_hash,
        "aaveApy" / 100.0 as aave_apy_pct,
        "compoundApy" / 100.0 as compound_apy_pct,
        "spread" / 100.0 as spread_pct,
        "rebalanced" as was_rebalanced
    FROM ethereum.logs
    WHERE contract_address = '0x...' -- RSC_ADDRESS (update with actual address)
        AND topic0 = '0x...' -- StrategyUpdate topic0 (keccak256("StrategyUpdate(uint256,uint256,uint256,bool))")
        AND block_time >= NOW() - INTERVAL '30 days'
),

rebalance_summary AS (
    SELECT
        DATE_TRUNC('day', block_time) as day,
        COUNT(*) FILTER (WHERE was_rebalanced = true) as rebalance_count,
        COUNT(*) as total_updates,
        AVG(spread_pct) as avg_spread,
        MAX(spread_pct) as max_spread,
        AVG(aave_apy_pct) as avg_aave_apy,
        AVG(compound_apy_pct) as avg_compound_apy
    FROM strategy_events
    GROUP BY DATE_TRUNC('day', block_time)
)

SELECT
    day,
    total_updates,
    rebalance_count,
    ROUND(avg_spread, 4) as avg_spread_pct,
    ROUND(max_spread, 4) as max_spread_pct,
    ROUND(avg_aave_apy, 4) as avg_aave_apy_pct,
    ROUND(avg_compound_apy, 4) as avg_compound_apy_pct,
    ROUND((rebalance_count::float / NULLIF(total_updates, 0)) * 100, 2) as rebalance_rate_pct
FROM rebalance_summary
ORDER BY day DESC;

-- Additional Metrics Query (Overall Performance)
-- SELECT
--     COUNT(*) FILTER (WHERE was_rebalanced = true) as total_rebalances,
--     COUNT(*) as total_events,
--     AVG(spread_pct) as avg_spread_all_time,
--     MAX(spread_pct) as max_spread_all_time,
--     MIN(spread_pct) as min_spread_all_time
-- FROM strategy_events;

