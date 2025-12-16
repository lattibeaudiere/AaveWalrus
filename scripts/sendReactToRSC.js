const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

/**
 * Send REACT tokens to the Reactive Smart Contract
 * Contract: 0x15725e58A3199122FcBb4d6F20573EEFd730781A (FusionReactiveRSC)
 * Network: Reactive Network (Chain 1597)
 */
async function sendReactToRSC() {
    console.log("=".repeat(60));
    console.log("⚡ SENDING REACT TOKENS TO RSC");
    console.log("=".repeat(60));
    console.log("");
    
    // Reactive Network configuration
    const REACTIVE_RPC = process.env.REACTIVE_RPC || "https://mainnet-rpc.rnk.dev";
    const REACTIVE_PRIVATE_KEY = process.env.REACTIVE_PRIVATE_KEY;
    
    // REACT token address on Reactive Network
    // Common REACT token address (may need verification)
    const REACT_TOKEN = process.env.REACT_TOKEN_ADDRESS || "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
    
    // RSC contract address
    const RSC_ADDRESS = "0x15725e58A3199122FcBb4d6F20573EEFd730781A";
    const AMOUNT_REACT = 4; // 4 REACT tokens
    
    if (!REACTIVE_PRIVATE_KEY) {
        throw new Error("REACTIVE_PRIVATE_KEY must be set in .env");
    }
    
    const provider = new ethers.providers.JsonRpcProvider(REACTIVE_RPC);
    const wallet = new ethers.Wallet(REACTIVE_PRIVATE_KEY, provider);
    
    console.log("Configuration:");
    console.log(`  Network: Reactive Network (Chain 1597)`);
    console.log(`  From: ${wallet.address}`);
    console.log(`  To: ${RSC_ADDRESS} (FusionReactiveRSC)`);
    console.log(`  Amount: ${AMOUNT_REACT} REACT`);
    console.log("");
    
    // Check if REACT is native token (ETH) or ERC20
    // On Reactive Network, REACT is typically the native token
    let isNativeToken = true;
    
    if (REACT_TOKEN && REACT_TOKEN.toLowerCase() !== "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee") {
        isNativeToken = false;
        console.log(`REACT Token (ERC20): ${REACT_TOKEN}`);
    } else {
        console.log("REACT (Native Token - treated as ETH on Reactive Network)");
    }
    
    console.log("");
    
    if (isNativeToken) {
        // Send native REACT (ETH) directly
        console.log("=".repeat(60));
        console.log("💰 CHECKING BALANCE");
        console.log("=".repeat(60));
        console.log("");
        
        const balance = await provider.getBalance(wallet.address);
        const balanceReact = ethers.utils.formatEther(balance);
        
        console.log(`Wallet balance: ${balanceReact} REACT`);
        
        const amountToSend = ethers.utils.parseEther(AMOUNT_REACT.toString());
        
        // Estimate gas
        const feeData = await provider.getFeeData();
        const gasLimit = ethers.BigNumber.from(21000);
        const gasPrice = feeData.gasPrice || ethers.BigNumber.from("1000000000"); // 1 gwei fallback
        
        const estimatedGasCost = gasLimit.mul(gasPrice);
        const totalCost = amountToSend.add(estimatedGasCost);
        const totalCostReact = ethers.utils.formatEther(totalCost);
        
        console.log("");
        console.log(`Amount to send: ${AMOUNT_REACT} REACT`);
        console.log(`Estimated gas: ${ethers.utils.formatEther(estimatedGasCost)} REACT`);
        console.log(`Total cost: ${totalCostReact} REACT`);
        console.log("");
        
        if (balance.lt(totalCost)) {
            const shortfall = ethers.utils.formatEther(totalCost.sub(balance));
            console.log("❌ INSUFFICIENT BALANCE!");
            console.log(`   Balance: ${balanceReact} REACT`);
            console.log(`   Required: ${totalCostReact} REACT`);
            console.log(`   Shortfall: ${shortfall} REACT`);
            process.exit(1);
        }
        
        // Check RSC balance
        const rscBalance = await provider.getBalance(RSC_ADDRESS);
        const rscBalanceReact = ethers.utils.formatEther(rscBalance);
        console.log(`RSC current balance: ${rscBalanceReact} REACT`);
        console.log("");
        
        console.log("=".repeat(60));
        console.log("📤 SENDING TRANSACTION");
        console.log("=".repeat(60));
        console.log("");
        console.log("Sending native REACT transfer...");
        console.log("-".repeat(60));
        
        try {
            // Estimate gas
            let finalGasLimit;
            try {
                const estimatedGas = await provider.estimateGas({
                    from: wallet.address,
                    to: RSC_ADDRESS,
                    value: amountToSend,
                });
                finalGasLimit = estimatedGas.mul(110).div(100);
            } catch (e) {
                finalGasLimit = gasLimit;
            }
            
            const tx = await wallet.sendTransaction({
                to: RSC_ADDRESS,
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
            const gasCostReact = ethers.utils.formatEther(gasCost);
            console.log(`Gas Cost: ${gasCostReact} REACT`);
            console.log(`Status: ${receipt.status === 1 ? '✅ Success' : '❌ Failed'}`);
            
            // Check final balances
            const finalWalletBalance = await provider.getBalance(wallet.address);
            const finalWalletBalanceReact = ethers.utils.formatEther(finalWalletBalance);
            
            const finalRscBalance = await provider.getBalance(RSC_ADDRESS);
            const finalRscBalanceReact = ethers.utils.formatEther(finalRscBalance);
            
            console.log("");
            console.log("=".repeat(60));
            console.log("💰 FINAL BALANCES");
            console.log("=".repeat(60));
            console.log("");
            console.log("Wallet:");
            console.log(`  Before: ${balanceReact} REACT`);
            console.log(`  After:  ${finalWalletBalanceReact} REACT`);
            console.log("");
            console.log("RSC Contract:");
            console.log(`  Before: ${rscBalanceReact} REACT`);
            console.log(`  After:  ${finalRscBalanceReact} REACT`);
            console.log(`  Received: ${AMOUNT_REACT} REACT`);
            console.log("");
            
            console.log("🔗 View on Reactscan:");
            console.log(`   Transaction: https://reactscan.io/tx/${tx.hash}`);
            console.log(`   Contract: https://reactscan.io/address/${RSC_ADDRESS}`);
            console.log("");
            
            console.log("✅ REACT tokens sent successfully!");
            console.log("");
            console.log(`The RSC contract now has ${finalRscBalanceReact} REACT for event processing.`);
            
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
    } else {
        // ERC20 token transfer
        console.log("⚠️  ERC20 REACT token transfer not yet implemented");
        console.log("   Please use native REACT (ETH) or implement ERC20 transfer");
    }
}

sendReactToRSC().catch(console.error);

