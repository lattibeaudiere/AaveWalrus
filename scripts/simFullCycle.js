const { ethers } = require('hardhat');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

/**
 * Simulate Full Cycle Gas Usage
 * Estimates gas for complete strategy cycle
 */
async function main() {
    console.log("=".repeat(60));
    console.log("FULL CYCLE GAS SIMULATION");
    console.log("=".repeat(60));
    console.log("");
    
    // Gas estimates (from developer review)
    const aaveReactGas = 45000;
    const queryGas = 120000;
    const rebalanceGas = 180000;
    const totalCycleGas = aaveReactGas + queryGas + rebalanceGas;
    
    // Arbitrum gas pricing
    const gasPriceGwei = 0.1; // Current Arbitrum average
    const ethPriceUsd = 3500; // Approximate
    
    const gasCostEth = (totalCycleGas * gasPriceGwei) / 1e9;
    const gasCostUsd = gasCostEth * ethPriceUsd;
    
    console.log("Gas Breakdown:");
    console.log("-".repeat(60));
    console.log(`  Aave react: ${aaveReactGas.toLocaleString()} gas`);
    console.log(`  Query: ${queryGas.toLocaleString()} gas`);
    console.log(`  Rebalance: ${rebalanceGas.toLocaleString()} gas`);
    console.log(`  Total: ${totalCycleGas.toLocaleString()} gas`);
    console.log("");
    
    console.log("Cost Estimate (Arbitrum):");
    console.log("-".repeat(60));
    console.log(`  Gas Price: ${gasPriceGwei} gwei`);
    console.log(`  ETH Price: $${ethPriceUsd.toLocaleString()}`);
    console.log(`  Cycle Cost: ${gasCostEth.toFixed(6)} ETH`);
    console.log(`  Cycle Cost: $${gasCostUsd.toFixed(2)} USD`);
    console.log("");
    
    if (totalCycleGas <= 300000) {
        console.log("✅ Gas within target (< 300k)");
    } else if (totalCycleGas <= 500000) {
        console.log("⚠️  Gas slightly high - consider threshold adjustment");
    } else {
        console.log("❌ Gas too high - review and optimize");
    }
    
    console.log("");
    console.log("=".repeat(60));
}

main().catch(console.error);

