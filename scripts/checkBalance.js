const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function checkBalance() {
    const ARBITRUM_RPC = process.env.ARBITRUM_RPC || process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc";
    const PRIVATE_KEY = process.env.PRIVATE_KEY || process.env.ARBITRUM_PRIVATE_KEY;
    
    let walletAddress;
    
    if (PRIVATE_KEY) {
        const wallet = new ethers.Wallet(PRIVATE_KEY);
        walletAddress = wallet.address;
    } else {
        // Use known deployer address if no private key in env
        walletAddress = "0x3737a882E03b7ABABaa7cCCC2d2982c2E071F963";
        console.log("⚠️  No PRIVATE_KEY in .env, using known deployer address");
    }
    
    const provider = new ethers.providers.JsonRpcProvider(ARBITRUM_RPC);
    
    console.log("=".repeat(60));
    console.log("💰 ARBITRUM ETH BALANCE CHECK");
    console.log("=".repeat(60));
    console.log("");
    console.log("Wallet Address:", walletAddress);
    console.log("Network: Arbitrum One (Chain ID: 42161)");
    console.log("");
    
    try {
        const balance = await provider.getBalance(walletAddress);
        const balanceEth = ethers.utils.formatEther(balance);
        const balanceWei = balance.toString();
        
        console.log("=".repeat(60));
        console.log("📊 BALANCE INFORMATION");
        console.log("=".repeat(60));
        console.log("");
        console.log(`ETH Balance: ${balanceEth} ETH`);
        console.log(`Wei Balance: ${balanceWei} wei`);
        console.log("");
        
        // Status indicators
        const balanceNum = parseFloat(balanceEth);
        
        if (balanceNum === 0) {
            console.log("⚠️  WARNING: Zero balance!");
            console.log("   Need to fund this wallet for transactions.");
        } else if (balanceNum < 0.001) {
            console.log("⚠️  WARNING: Very low balance!");
            console.log(`   Only ${balanceEth} ETH - may not be enough for operations.`);
        } else if (balanceNum < 0.01) {
            console.log("ℹ️  Balance sufficient for small operations.");
        } else {
            console.log("✅ Balance sufficient for operations.");
        }
        
        console.log("");
        
        // Check if sufficient for Guardian funding
        if (balanceNum >= 0.01) {
            console.log("✅ Sufficient balance to fund Guardian wallet (0.01 ETH)");
        } else {
            const needed = (0.01 - balanceNum).toFixed(6);
            console.log(`⚠️  Need ${needed} more ETH to fund Guardian wallet`);
        }
        
        console.log("");
        
        // Show on Arbiscan
        console.log("🔗 View on Arbiscan:");
        console.log(`   https://arbiscan.io/address/${walletAddress}`);
        console.log("");
        
        // Recent transactions check
        try {
            const txCount = await provider.getTransactionCount(walletAddress);
            console.log(`Total Transactions: ${txCount}`);
            
            if (txCount > 0) {
                console.log("   (This wallet has been used before)");
            } else {
                console.log("   (New wallet - no transactions yet)");
            }
        } catch (e) {
            // Ignore if can't get tx count
        }
        
        console.log("");
        
    } catch (error) {
        console.log("❌ Error checking balance!");
        console.log(`Error: ${error.message}`);
        process.exit(1);
    }
}

checkBalance().catch(console.error);

