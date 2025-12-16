const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

/**
 * Fund reserves for RSC contract to activate it
 */
async function fundReserves() {
    console.log("=".repeat(60));
    console.log("💰 FUNDING RSC CONTRACT RESERVES");
    console.log("=".repeat(60));
    console.log("");
    
    const REACTIVE_RPC = process.env.REACTIVE_RPC || "https://mainnet-rpc.rnk.dev";
    const REACTIVE_PRIVATE_KEY = process.env.REACTIVE_PRIVATE_KEY;
    const RSC_ADDRESS = process.env.RSC_ADDRESS || "0x15725e58A3199122FcBb4d6F20573EEFd730781A";
    
    // Reactive Network System Contract
    const SYSTEM_CONTRACT = "0x0000000000000000000000000000000000fffFfF";
    
    if (!REACTIVE_PRIVATE_KEY) {
        throw new Error("REACTIVE_PRIVATE_KEY must be set in .env");
    }
    
    const provider = new ethers.providers.JsonRpcProvider(REACTIVE_RPC);
    const wallet = new ethers.Wallet(REACTIVE_PRIVATE_KEY, provider);
    
    console.log("Configuration:");
    console.log(`  Network: Reactive Network (Chain 1597)`);
    console.log(`  RSC Contract: ${RSC_ADDRESS}`);
    console.log(`  System Contract: ${SYSTEM_CONTRACT}`);
    console.log(`  Wallet: ${wallet.address}`);
    console.log("");
    
    // System Contract ABI
    const systemContractABI = [
        "function debts(address) view returns (uint256)",
        "function reserves(address) view returns (uint256)",
        "function depositTo(address) payable"
    ];
    
    const systemContract = new ethers.Contract(SYSTEM_CONTRACT, systemContractABI, provider);
    
    try {
        // Check current status
        console.log("=".repeat(60));
        console.log("📊 CURRENT STATUS");
        console.log("=".repeat(60));
        console.log("");
        
        const directBalance = await provider.getBalance(RSC_ADDRESS);
        const directBalanceReact = ethers.utils.formatEther(directBalance);
        
        const debt = await systemContract.debts(RSC_ADDRESS);
        const debtReact = ethers.utils.formatEther(debt);
        
        const reserves = await systemContract.reserves(RSC_ADDRESS);
        const reservesReact = ethers.utils.formatEther(reserves);
        
        console.log(`Direct Balance: ${directBalanceReact} REACT`);
        console.log(`Debt: ${debtReact} REACT`);
        console.log(`Reserves: ${reservesReact} REACT`);
        console.log("");
        
        // Check wallet balance
        const walletBalance = await provider.getBalance(wallet.address);
        const walletBalanceReact = ethers.utils.formatEther(walletBalance);
        console.log(`Wallet balance: ${walletBalanceReact} REACT`);
        console.log("");
        
        // Calculate amount needed: debt + reserves target
        // User mentioned reserves had 0.0001 REACT when it was active
        // Let's clear debt + add 0.001 REACT to reserves
        const reservesTarget = ethers.utils.parseEther("0.001");
        const amountToReserves = debt.add(reservesTarget); // debt + target reserves
        const amountReact = ethers.utils.formatEther(amountToReserves);
        
        console.log("=".repeat(60));
        console.log("📤 FUNDING RESERVES");
        console.log("=".repeat(60));
        console.log("");
        console.log(`Amount to add to reserves: ${amountReact} REACT`);
        console.log("");
        console.log("Note: depositTo() will:");
        console.log("  • Automatically settle any debt");
        console.log("  • Add funds to reserves");
        console.log("");
        
        // Estimate gas
        const feeData = await provider.getFeeData();
        const gasPrice = feeData.gasPrice || ethers.BigNumber.from("1000000000");
        const estimatedGas = ethers.BigNumber.from(100000);
        const gasCost = estimatedGas.mul(gasPrice);
        const totalNeeded = amountToReserves.add(gasCost);
        
        if (walletBalance.lt(totalNeeded)) {
            const shortfall = ethers.utils.formatEther(totalNeeded.sub(walletBalance));
            console.log("❌ INSUFFICIENT BALANCE!");
            console.log(`   Balance: ${walletBalanceReact} REACT`);
            console.log(`   Needed: ${ethers.utils.formatEther(totalNeeded)} REACT`);
            console.log(`   Shortfall: ${shortfall} REACT`);
            process.exit(1);
        }
        
        console.log("Sending transaction via depositTo()...");
        console.log("-".repeat(60));
        
        const tx = await systemContract.connect(wallet).depositTo(RSC_ADDRESS, {
            value: amountToReserves,
            gasLimit: 200000,
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
        console.log(`Gas Cost: ${ethers.utils.formatEther(receipt.gasUsed.mul(gasPrice))} REACT`);
        console.log(`Status: ${receipt.status === 1 ? '✅ Success' : '❌ Failed'}`);
        
        // Verify new reserves
        console.log("");
        console.log("Verifying new reserves...");
        const newReserves = await systemContract.reserves(RSC_ADDRESS);
        const newReservesReact = ethers.utils.formatEther(newReserves);
        
        const newDebt = await systemContract.debts(RSC_ADDRESS);
        const newDebtReact = ethers.utils.formatEther(newDebt);
        
        console.log("");
        console.log("=".repeat(60));
        console.log("📊 FINAL STATUS");
        console.log("=".repeat(60));
        console.log("");
        console.log(`Previous Reserves: ${reservesReact} REACT`);
        console.log(`Current Reserves: ${newReservesReact} REACT`);
        console.log("");
        console.log(`Previous Debt: ${debtReact} REACT`);
        console.log(`Current Debt: ${newDebtReact} REACT`);
        console.log("");
        console.log(`Direct Balance: ${directBalanceReact} REACT (unchanged)`);
        console.log("");
        
        if (parseFloat(newReservesReact) >= 0.0001) {
            console.log("✅ Reserves funded!");
            console.log("   Contract should now be active.");
            console.log("");
            console.log("Next: Check contract status on Reactscan:");
            console.log(`   https://reactscan.io/address/${RSC_ADDRESS}`);
        }
        
        console.log("");
        console.log("🔗 View on Reactscan:");
        console.log(`   Transaction: https://reactscan.io/tx/${tx.hash}`);
        console.log(`   Contract: https://reactscan.io/address/${RSC_ADDRESS}`);
        console.log("");
        
        console.log("=".repeat(60));
        console.log("📋 MONITORING INSTRUCTIONS");
        console.log("=".repeat(60));
        console.log("");
        console.log("To monitor contract activity:");
        console.log("  1. Check Reactscan for RVM transactions");
        console.log("  2. Monitor direct balance changes");
        console.log("  3. Watch for debt accumulation");
        console.log("  4. Check if reserves are used automatically");
        console.log("");
        
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

fundReserves().catch(console.error);

