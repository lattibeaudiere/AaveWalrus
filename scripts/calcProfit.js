const { ethers } = require('hardhat');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

/**
 * Calculate Profitability
 * Estimates yield improvement and ROI
 */
async function main() {
    console.log("=".repeat(60));
    console.log("PROFITABILITY CALCULATOR");
    console.log("=".repeat(60));
    console.log("");
    
    const ARBITRUM_RPC = process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc";
    const QUERY_HELPER_ADDRESS = process.env.QUERY_HELPER_ADDRESS;
    const VAULT_ADDRESS = process.env.TARGET_VAULT;
    
    if (!QUERY_HELPER_ADDRESS) {
        console.log("⚠️  QUERY_HELPER_ADDRESS not set - using mock values");
    }
    
    const provider = new ethers.providers.JsonRpcProvider(ARBITRUM_RPC);
    
    // Mock values for demonstration
    let aaveApyBps = 320; // 3.2%
    let compoundApyBps = 350; // 3.5%
    
    // Try to get real APYs
    if (QUERY_HELPER_ADDRESS) {
        try {
            const QueryHelper = await ethers.getContractAt('QueryHelper', QUERY_HELPER_ADDRESS, provider);
            compoundApyBps = (await QueryHelper.getCompoundApy()).toNumber();
        } catch (error) {
            console.log("⚠️  Could not query real APY, using mock values");
        }
    }
    
    // Get vault balance (if possible)
    let vaultBalance = ethers.BigNumber.from(0);
    if (VAULT_ADDRESS) {
        try {
            const USDC = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
            const erc20ABI = ['function balanceOf(address) view returns (uint256)'];
            const usdc = new ethers.Contract(USDC, erc20ABI, provider);
            vaultBalance = await usdc.balanceOf(VAULT_ADDRESS);
        } catch (error) {
            console.log("⚠️  Could not get vault balance");
        }
    }
    
    const spreadBps = Math.abs(aaveApyBps - compoundApyBps);
    const spreadPct = spreadBps / 100;
    
    // Gas costs (per cycle)
    const gasPerCycle = 345000; // Average
    const gasPriceGwei = 0.1; // Arbitrum average
    const gasCostEth = (gasPerCycle * gasPriceGwei) / 1e9;
    const ethPriceUsd = 3500; // Approximate
    const gasCostUsd = gasCostEth * ethPriceUsd;
    
    // Profitability calculation
    const positionUsd = parseFloat(ethers.utils.formatUnits(vaultBalance, 6));
    const betterApy = Math.max(aaveApyBps, compoundApyBps) / 100;
    const worseApy = Math.min(aaveApyBps, compoundApyBps) / 100;
    const yieldGainBps = betterApy - worseApy;
    
    // Annual value of optimization
    const annualValueUsd = positionUsd > 0 
        ? (positionUsd * yieldGainBps) / 100 
        : 0;
    
    // Break-even point (how many rebalances needed to cover gas)
    const rebalancesPerYear = spreadBps >= 30 ? 20 : 0; // Estimate
    const annualGasCost = gasCostUsd * rebalancesPerYear;
    const netProfitUsd = annualValueUsd - annualGasCost;
    
    console.log("📊 Current Metrics:");
    console.log("-".repeat(60));
    console.log(`  Aave APY: ${aaveApyBps / 100}%`);
    console.log(`  Compound APY: ${compoundApyBps / 100}%`);
    console.log(`  Spread: ${spreadBps} bps (${spreadPct}%)`);
    console.log(`  Vault Balance: $${positionUsd > 0 ? positionUsd.toFixed(2) : 'N/A'}`);
    console.log("");
    
    console.log("💰 Profitability Analysis:");
    console.log("-".repeat(60));
    console.log(`  Gas per Cycle: ${gasCostUsd.toFixed(4)} USD`);
    console.log(`  Yield Gain: ${yieldGainBps.toFixed(2)}%`);
    console.log(`  Annual Value: $${annualValueUsd.toFixed(2)}`);
    console.log(`  Annual Gas Cost: $${annualGasCost.toFixed(2)}`);
    console.log(`  Net Profit: $${netProfitUsd.toFixed(2)}`);
    console.log("");
    
    if (spreadBps >= 30) {
        console.log("✅ REBALANCE OPPORTUNITY DETECTED");
        console.log(`   Spread (${spreadBps} bps) exceeds threshold (30 bps)`);
    } else {
        console.log("⏸️  NO REBALANCE NEEDED");
        console.log(`   Spread (${spreadBps} bps) below threshold (30 bps)`);
    }
    
    console.log("");
    console.log("=".repeat(60));
}

main().catch(console.error);

