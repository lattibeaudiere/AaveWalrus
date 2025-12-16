const ethers = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

/**
 * Fund the Guardian wallet from your main wallet
 */
async function fundGuardianWallet() {
    console.log("=".repeat(60));
    console.log("💰 FUNDING GUARDIAN WALLET");
    console.log("=".repeat(60));
    console.log("");
    
    const ARBITRUM_RPC = process.env.ARBITRUM_RPC || process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc";
    const PRIVATE_KEY = process.env.PRIVATE_KEY || process.env.ARBITRUM_PRIVATE_KEY;
    const GUARDIAN_ADDRESS = process.env.GUARDIAN_ADDRESS;
    
    if (!PRIVATE_KEY) {
        throw new Error("PRIVATE_KEY or ARBITRUM_PRIVATE_KEY must be set in .env");
    }
    
    if (!GUARDIAN_ADDRESS) {
        throw new Error("GUARDIAN_ADDRESS must be set in .env (run createGuardianWallet.js first)");
    }
    
    const provider = new ethers.providers.JsonRpcProvider(ARBITRUM_RPC);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    
    console.log("Configuration:");
    console.log(`  From: ${wallet.address} (main wallet)`);
    console.log(`  To: ${GUARDIAN_ADDRESS} (Guardian wallet)`);
    console.log(`  Network: Arbitrum One (42161)`);
    console.log("");
    
    // Check balance
    const balance = await provider.getBalance(wallet.address);
    const balanceEth = ethers.utils.formatEther(balance);
    console.log(`  Main wallet balance: ${balanceEth} ETH`);
    
    if (parseFloat(balanceEth) < 0.02) {
        console.log("\n  ⚠️  WARNING: Low balance! Need at least 0.02 ETH for funding");
        return;
    }
    
    // Amount to send (0.01 ETH)
    const amount = ethers.utils.parseEther("0.01");
    const amountEth = ethers.utils.formatEther(amount);
    
    console.log("");
    console.log("=".repeat(60));
    console.log("📤 SENDING TRANSACTION");
    console.log("=".repeat(60));
    console.log("");
    console.log(`Amount: ${amountEth} ETH`);
    console.log("");
    
    // Check Guardian balance first
    const guardianBalance = await provider.getBalance(GUARDIAN_ADDRESS);
    const guardianBalanceEth = ethers.utils.formatEther(guardianBalance);
    console.log(`Guardian current balance: ${guardianBalanceEth} ETH`);
    
    if (parseFloat(guardianBalanceEth) > 0) {
        console.log("  ℹ️  Guardian already has funds");
    }
    
    console.log("");
    console.log("Sending transaction...");
    console.log("-".repeat(60));
    
    try {
        const tx = await wallet.sendTransaction({
            to: GUARDIAN_ADDRESS,
            value: amount,
            gasLimit: 21000,
        });
        
        console.log(`\n  Transaction hash: ${tx.hash}`);
        console.log(`  Waiting for confirmation...`);
        
        const receipt = await tx.wait();
        
        console.log("\n" + "=".repeat(60));
        console.log("✅ TRANSACTION CONFIRMED");
        console.log("=".repeat(60));
        console.log(`\nBlock: ${receipt.blockNumber}`);
        console.log(`Gas Used: ${receipt.gasUsed.toString()}`);
        console.log(`Status: ${receipt.status === 1 ? 'Success' : 'Failed'}`);
        
        // Check final balance
        const finalGuardianBalance = await provider.getBalance(GUARDIAN_ADDRESS);
        const finalGuardianBalanceEth = ethers.utils.formatEther(finalGuardianBalance);
        
        console.log("");
        console.log("Guardian wallet balance:");
        console.log(`  Before: ${guardianBalanceEth} ETH`);
        console.log(`  After: ${finalGuardianBalanceEth} ETH`);
        console.log("");
        
        console.log("🔗 View on Arbiscan:");
        console.log(`   https://arbiscan.io/tx/${tx.hash}`);
        console.log("");
        
        console.log("✅ Guardian wallet funded and ready!");
        console.log("");
        console.log("Next: Use this address in Vault Builder:");
        console.log(`   ${GUARDIAN_ADDRESS}`);
        
    } catch (error) {
        console.log("\n❌ Transaction failed!");
        console.log(`Error: ${error.message}`);
        
        if (error.transaction) {
            console.log(`Transaction hash: ${error.transaction.hash}`);
        }
        
        throw error;
    }
}

fundGuardianWallet().catch(console.error);

