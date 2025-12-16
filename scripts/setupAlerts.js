const { ethers } = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

/**
 * Setup Monitoring Alerts
 * Configures alerts for Aave events and rebalance triggers
 */
async function main() {
    console.log("=".repeat(60));
    console.log("MONITORING ALERTS SETUP");
    console.log("=".repeat(60));
    console.log("");
    
    const AAVE_POOL = '0x794a61358D6845594F94dc1DB02A252b5b4814aD';
    const USDC_ADDRESS = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
    const RESERVE_DATA_UPDATED = '0x804c9b842b2748a22bb64b345453a3de7ca54a6ca45ce00d415894979e22897a';
    
    console.log("Arbiscan Alert Configuration:");
    console.log("-".repeat(60));
    console.log("Contract Address:", AAVE_POOL);
    console.log("Event Signature:", RESERVE_DATA_UPDATED);
    console.log("Filter (Topic1 - USDC):", ethers.utils.hexZeroPad(USDC_ADDRESS, 32));
    console.log("");
    
    console.log("🔔 Arbiscan Alert Setup:");
    console.log("1. Go to: https://arbiscan.io/address/" + AAVE_POOL);
    console.log("2. Click 'Logs' tab");
    console.log("3. Filter by:");
    console.log(`   - Topic0: ${RESERVE_DATA_UPDATED}`);
    console.log(`   - Topic1: ${ethers.utils.hexZeroPad(USDC_ADDRESS, 32)}`);
    console.log("4. Create alert → Email/Slack notification");
    console.log("");
    
    console.log("📊 StrategyUpdate Event Monitoring:");
    console.log("Monitor RSC address for StrategyUpdate events:");
    console.log("- Event: StrategyUpdate(uint256,uint256,uint256,bool)");
    console.log("- When: Every APY update or rebalance");
    console.log("- Check: Reactscan.io for Reactive Network events");
    console.log("");
    
    console.log("✅ Alert Configuration Complete");
    console.log("");
    console.log("Expected Triggers:");
    console.log("- Aave event: ~every 30-60 minutes");
    console.log("- Rebalance: When spread > 30 bps");
    console.log("");
}

main().catch(console.error);

