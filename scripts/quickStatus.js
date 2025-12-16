const { ethers } = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

/**
 * Quick Status Check
 * Fast overview of system status
 */
async function quickStatus() {
    console.log("=".repeat(60));
    console.log("⚡ QUICK STATUS CHECK");
    console.log("=".repeat(60));
    console.log("");
    
    const ARBITRUM_RPC = process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc";
    const REACTIVE_RPC = process.env.REACTIVE_RPC || "https://mainnet-rpc.rnk.dev";
    const ADAPTER_ADDRESS = process.env.ADAPTER_ADDRESS;
    const RSC_ADDRESS = process.env.RSC_ADDRESS;
    const VAULT_ADDRESS = process.env.TARGET_VAULT;
    
    if (!ADAPTER_ADDRESS || !RSC_ADDRESS || !VAULT_ADDRESS) {
        console.log("⚠️  Missing addresses in .env");
        return;
    }
    
    const arbitrumProvider = new ethers.providers.JsonRpcProvider(ARBITRUM_RPC);
    const reactiveProvider = new ethers.providers.JsonRpcProvider(REACTIVE_RPC);
    
    console.log("📊 System Components:");
    console.log("-".repeat(60));
    console.log(`  Vault: ${VAULT_ADDRESS}`);
    console.log(`  Adapter: ${ADAPTER_ADDRESS}`);
    console.log(`  RSC: ${RSC_ADDRESS}`);
    console.log("");
    
    // Quick checks
    try {
        // Check RSC balance on Reactive Network
        const rscBalance = await reactiveProvider.getBalance(RSC_ADDRESS);
        const rscBalanceEth = ethers.utils.formatEther(rscBalance);
        console.log("💰 RSC Balance (Reactive Network):");
        console.log(`  ${rscBalanceEth} REACT`);
        
        if (parseFloat(rscBalanceEth) < 0.001) {
            console.log("  ⚠️  Low balance - may need funding");
        } else {
            console.log("  ✅ Sufficient balance");
        }
    } catch (error) {
        console.log("  ⚠️  Could not check RSC balance");
    }
    
    console.log("");
    
    try {
        // Check vault USDC balance
        const USDC = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
        const erc20ABI = ['function balanceOf(address) view returns (uint256)'];
        const usdc = new ethers.Contract(USDC, erc20ABI, arbitrumProvider);
        const vaultBalance = await usdc.balanceOf(VAULT_ADDRESS);
        const vaultBalanceUsd = parseFloat(ethers.utils.formatUnits(vaultBalance, 6));
        
        console.log("💰 Vault Balance (Arbitrum):");
        console.log(`  $${vaultBalanceUsd.toFixed(2)} USDC`);
        
        if (vaultBalanceUsd < 1000) {
            console.log("  ⚠️  Below minimum ($1,000)");
        } else {
            console.log("  ✅ Above minimum");
        }
    } catch (error) {
        console.log("  ⚠️  Could not check vault balance");
    }
    
    console.log("");
    console.log("✅ Status check complete");
    console.log("");
    console.log("📈 For detailed metrics:");
    console.log("  npm run health   # Full health report");
    console.log("  npm run profit   # Profitability analysis");
    console.log("  npm run monitor  # Live event stream");
    console.log("");
    console.log("=".repeat(60));
}

quickStatus().catch(console.error);

