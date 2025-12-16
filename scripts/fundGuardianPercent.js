const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

/**
 * Fund the Guardian wallet with a percentage of main wallet balance
 */
async function fundGuardianPercent() {
    console.log("=".repeat(60));
    console.log("💰 FUNDING GUARDIAN WALLET (20% of balance)");
    console.log("=".repeat(60));
    console.log("");
    
    const ARBITRUM_RPC = process.env.ARBITRUM_RPC || process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc";
    const PRIVATE_KEY = process.env.PRIVATE_KEY || process.env.ARBITRUM_PRIVATE_KEY;
    const GUARDIAN_ADDRESS = process.env.GUARDIAN_ADDRESS;
    const PERCENTAGE = 0.20; // 20%
    
    if (!PRIVATE_KEY) {
        throw new Error("PRIVATE_KEY or ARBITRUM_PRIVATE_KEY must be set in .env");
    }
    
    if (!GUARDIAN_ADDRESS) {
        throw new Error("GUARDIAN_ADDRESS must be set in .env");
    }
    
    const provider = new ethers.providers.JsonRpcProvider(ARBITRUM_RPC);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    
    console.log("Configuration:");
    console.log(`  From: ${wallet.address} (main wallet)`);
    console.log(`  To: ${GUARDIAN_ADDRESS} (Guardian wallet)`);
    console.log(`  Network: Arbitrum One (42161)`);
    console.log(`  Percentage: ${(PERCENTAGE * 100).toFixed(0)}%`);
    console.log("");
    
    // Check main wallet balance
    const balance = await provider.getBalance(wallet.address);
    const balanceEth = ethers.utils.formatEther(balance);
    console.log(`  Main wallet balance: ${balanceEth} ETH`);
    
    if (parseFloat(balanceEth) < 0.0001) {
        console.log("\n  ⚠️  WARNING: Very low balance! Transaction may fail");
        return;
    }
    
    // Calculate 20% (leave some for gas)
    // Reserve ~0.0001 ETH for gas, then take 20% of remainder
    const gasReserve = ethers.utils.parseEther("0.0001");
    const availableBalance = balance.sub(gasReserve);
    
    if (availableBalance.lte(0)) {
        console.log("\n  ⚠️  WARNING: Insufficient balance after gas reserve!");
        return;
    }
    
    const amountToSend = availableBalance.mul(Math.floor(PERCENTAGE * 10000)).div(10000); // 20% = 2000/10000
    const amountEth = ethers.utils.formatEther(amountToSend);
    
    console.log("");
    console.log("=".repeat(60));
    console.log("📊 CALCULATION");
    console.log("=".repeat(60));
    console.log(`Total Balance: ${balanceEth} ETH`);
    console.log(`Gas Reserve: 0.0001 ETH`);
    console.log(`Available: ${ethers.utils.formatEther(availableBalance)} ETH`);
    console.log(`${(PERCENTAGE * 100).toFixed(0)}% of Available: ${amountEth} ETH`);
    console.log("");
    
    // Check Guardian balance
    const guardianBalance = await provider.getBalance(GUARDIAN_ADDRESS);
    const guardianBalanceEth = ethers.utils.formatEther(guardianBalance);
    console.log(`Guardian current balance: ${guardianBalanceEth} ETH`);
    console.log("");
    
    if (parseFloat(amountEth) < 0.00001) {
        console.log("⚠️  Amount too small! (< 0.00001 ETH)");
        console.log("   Transaction would likely fail or cost more in gas than value");
        return;
    }
    
    console.log("=".repeat(60));
    console.log("📤 SENDING TRANSACTION");
    console.log("=".repeat(60));
    console.log("");
    console.log(`Amount: ${amountEth} ETH`);
    console.log(`Gas Limit: 21000 (standard transfer)`);
    console.log("");
    console.log("Sending transaction...");
    console.log("-".repeat(60));
    
    try {
        // Get fee data for Arbitrum
        const feeData = await provider.getFeeData();
        
        // Estimate gas first
        let gasLimit;
        try {
            const estimatedGas = await provider.estimateGas({
                from: wallet.address,
                to: GUARDIAN_ADDRESS,
                value: amountToSend,
            });
            // Add 10% buffer for safety
            gasLimit = estimatedGas.mul(110).div(100);
        } catch (e) {
            // Fallback to 21000 if estimation fails
            gasLimit = ethers.BigNumber.from(21000);
        }
        
        // Arbitrum minimum gas price is typically 0.1 gwei
        const minGasPrice = ethers.utils.parseUnits("0.1", "gwei");
        
        // Use legacy transaction for Arbitrum (more reliable)
        const gasPrice = feeData.gasPrice && feeData.gasPrice.gte(minGasPrice)
            ? feeData.gasPrice
            : minGasPrice;
        
        const tx = await wallet.sendTransaction({
            to: GUARDIAN_ADDRESS,
            value: amountToSend,
            gasLimit: gasLimit,
            gasPrice: gasPrice,
        });
        
        console.log(`\n  Transaction hash: ${tx.hash}`);
        console.log(`  Waiting for confirmation...`);
        
        const receipt = await tx.wait();
        
        console.log("\n" + "=".repeat(60));
        console.log("✅ TRANSACTION CONFIRMED");
        console.log("=".repeat(60));
        console.log(`\nBlock: ${receipt.blockNumber}`);
        console.log(`Gas Used: ${receipt.gasUsed.toString()}`);
        const finalGasPrice = tx.gasPrice || (receipt.gasPrice || gasPrice);
        console.log(`Gas Price: ${ethers.utils.formatUnits(finalGasPrice, "gwei")} gwei`);
        
        const gasCost = receipt.gasUsed.mul(finalGasPrice);
        const gasCostEth = ethers.utils.formatEther(gasCost);
        console.log(`Gas Cost: ${gasCostEth} ETH`);
        console.log(`Status: ${receipt.status === 1 ? '✅ Success' : '❌ Failed'}`);
        
        // Check final balances
        const finalMainBalance = await provider.getBalance(wallet.address);
        const finalMainBalanceEth = ethers.utils.formatEther(finalMainBalance);
        
        const finalGuardianBalance = await provider.getBalance(GUARDIAN_ADDRESS);
        const finalGuardianBalanceEth = ethers.utils.formatEther(finalGuardianBalance);
        
        console.log("");
        console.log("=".repeat(60));
        console.log("💰 FINAL BALANCES");
        console.log("=".repeat(60));
        console.log("");
        console.log("Main Wallet:");
        console.log(`  Before: ${balanceEth} ETH`);
        console.log(`  After:  ${finalMainBalanceEth} ETH`);
        console.log(`  Change: ${(parseFloat(balanceEth) - parseFloat(finalMainBalanceEth)).toFixed(8)} ETH`);
        console.log("");
        console.log("Guardian Wallet:");
        console.log(`  Before: ${guardianBalanceEth} ETH`);
        console.log(`  After:  ${finalGuardianBalanceEth} ETH`);
        console.log(`  Received: ${amountEth} ETH`);
        console.log("");
        
        console.log("🔗 View on Arbiscan:");
        console.log(`   Transaction: https://arbiscan.io/tx/${tx.hash}`);
        console.log(`   Main Wallet: https://arbiscan.io/address/${wallet.address}`);
        console.log(`   Guardian: https://arbiscan.io/address/${GUARDIAN_ADDRESS}`);
        console.log("");
        
        console.log("✅ Guardian wallet funded successfully!");
        console.log("");
        console.log("Next: Use Guardian address in Vault Builder:");
        console.log(`   ${GUARDIAN_ADDRESS}`);
        
    } catch (error) {
        console.log("\n❌ Transaction failed!");
        console.log(`Error: ${error.message}`);
        
        if (error.reason) {
            console.log(`Reason: ${error.reason}`);
        }
        
        if (error.transaction) {
            console.log(`Transaction hash: ${error.transaction.hash}`);
        }
        
        throw error;
    }
}

fundGuardianPercent().catch(console.error);

