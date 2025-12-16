const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

/**
 * Fund the Atomist wallet from main wallet
 */
async function fundAtomistWallet() {
    console.log("=".repeat(60));
    console.log("💰 FUNDING ATOMIST WALLET");
    console.log("=".repeat(60));
    console.log("");
    
    const ARBITRUM_RPC = process.env.ARBITRUM_RPC || process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc";
    const PRIVATE_KEY = process.env.PRIVATE_KEY || process.env.ARBITRUM_PRIVATE_KEY;
    const ATOMIST_ADDRESS = process.env.ATOMIST_ADDRESS;
    const AMOUNT_ETH = "0.0009"; // Fixed amount
    
    if (!PRIVATE_KEY) {
        throw new Error("PRIVATE_KEY or ARBITRUM_PRIVATE_KEY must be set in .env");
    }
    
    if (!ATOMIST_ADDRESS) {
        throw new Error("ATOMIST_ADDRESS must be set in .env");
    }
    
    const provider = new ethers.providers.JsonRpcProvider(ARBITRUM_RPC);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    
    console.log("Configuration:");
    console.log(`  From: ${wallet.address} (main wallet)`);
    console.log(`  To: ${ATOMIST_ADDRESS} (Atomist wallet)`);
    console.log(`  Network: Arbitrum One (42161)`);
    console.log(`  Amount: ${AMOUNT_ETH} ETH`);
    console.log("");
    
    // Check main wallet balance
    const balance = await provider.getBalance(wallet.address);
    const balanceEth = ethers.utils.formatEther(balance);
    console.log(`  Main wallet balance: ${balanceEth} ETH`);
    
    const amountToSend = ethers.utils.parseEther(AMOUNT_ETH);
    const gasLimit = ethers.BigNumber.from(21000);
    
    // Estimate total cost (amount + gas)
    const feeData = await provider.getFeeData();
    const minGasPrice = ethers.utils.parseUnits("0.1", "gwei");
    const gasPrice = feeData.gasPrice && feeData.gasPrice.gte(minGasPrice)
        ? feeData.gasPrice
        : minGasPrice;
    
    const estimatedGasCost = gasLimit.mul(gasPrice);
    const totalCost = amountToSend.add(estimatedGasCost);
    const totalCostEth = ethers.utils.formatEther(totalCost);
    
    console.log("");
    console.log("=".repeat(60));
    console.log("📊 TRANSACTION DETAILS");
    console.log("=".repeat(60));
    console.log(`Amount to Send: ${AMOUNT_ETH} ETH`);
    console.log(`Estimated Gas: ${ethers.utils.formatEther(estimatedGasCost)} ETH`);
    console.log(`Total Cost: ${totalCostEth} ETH`);
    console.log("");
    
    if (balance.lt(totalCost)) {
        const shortfall = ethers.utils.formatEther(totalCost.sub(balance));
        console.log("❌ INSUFFICIENT BALANCE!");
        console.log(`   Balance: ${balanceEth} ETH`);
        console.log(`   Required: ${totalCostEth} ETH`);
        console.log(`   Shortfall: ${shortfall} ETH`);
        process.exit(1);
    }
    
    // Check Atomist balance
    const atomistBalance = await provider.getBalance(ATOMIST_ADDRESS);
    const atomistBalanceEth = ethers.utils.formatEther(atomistBalance);
    console.log(`Atomist current balance: ${atomistBalanceEth} ETH`);
    console.log("");
    
    console.log("=".repeat(60));
    console.log("📤 SENDING TRANSACTION");
    console.log("=".repeat(60));
    console.log("");
    console.log("Sending transaction...");
    console.log("-".repeat(60));
    
    try {
        // Estimate gas first
        let finalGasLimit;
        try {
            const estimatedGas = await provider.estimateGas({
                from: wallet.address,
                to: ATOMIST_ADDRESS,
                value: amountToSend,
            });
            finalGasLimit = estimatedGas.mul(110).div(100); // 10% buffer
        } catch (e) {
            finalGasLimit = gasLimit;
        }
        
        const tx = await wallet.sendTransaction({
            to: ATOMIST_ADDRESS,
            value: amountToSend,
            gasLimit: finalGasLimit,
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
        console.log(`Gas Price: ${ethers.utils.formatUnits(gasPrice, "gwei")} gwei`);
        
        const finalGasPrice = receipt.gasPrice || gasPrice;
        const gasCost = receipt.gasUsed.mul(finalGasPrice);
        const gasCostEth = ethers.utils.formatEther(gasCost);
        console.log(`Gas Cost: ${gasCostEth} ETH`);
        console.log(`Status: ${receipt.status === 1 ? '✅ Success' : '❌ Failed'}`);
        
        // Check final balances
        const finalMainBalance = await provider.getBalance(wallet.address);
        const finalMainBalanceEth = ethers.utils.formatEther(finalMainBalance);
        
        const finalAtomistBalance = await provider.getBalance(ATOMIST_ADDRESS);
        const finalAtomistBalanceEth = ethers.utils.formatEther(finalAtomistBalance);
        
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
        console.log("Atomist Wallet:");
        console.log(`  Before: ${atomistBalanceEth} ETH`);
        console.log(`  After:  ${finalAtomistBalanceEth} ETH`);
        console.log(`  Received: ${AMOUNT_ETH} ETH`);
        console.log("");
        
        console.log("🔗 View on Arbiscan:");
        console.log(`   Transaction: https://arbiscan.io/tx/${tx.hash}`);
        console.log(`   Main Wallet: https://arbiscan.io/address/${wallet.address}`);
        console.log(`   Atomist: https://arbiscan.io/address/${ATOMIST_ADDRESS}`);
        console.log("");
        
        console.log("✅ Atomist wallet funded successfully!");
        console.log("");
        console.log("Next: Use Atomist address in Vault Builder:");
        console.log(`   ${ATOMIST_ADDRESS}`);
        
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

fundAtomistWallet().catch(console.error);

