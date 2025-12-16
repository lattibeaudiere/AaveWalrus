const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

/**
 * Add specific amount of REACT to reserves
 */
async function addReserves() {
    console.log("=".repeat(60));
    console.log("💰 ADDING REACT TO RESERVES");
    console.log("=".repeat(60));
    console.log("");
    
    const REACTIVE_RPC = process.env.REACTIVE_RPC || "https://mainnet-rpc.rnk.dev";
    const REACTIVE_PRIVATE_KEY = process.env.REACTIVE_PRIVATE_KEY;
    const RSC_ADDRESS = process.env.RSC_ADDRESS || "0x15725e58A3199122FcBb4d6F20573EEFd730781A";
    const SYSTEM_CONTRACT = "0x0000000000000000000000000000000000fffFfF";
    
    // Amount to add to reserves
    const AMOUNT_REACT = 4; // 4 REACT
    
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
    console.log(`  Amount: ${AMOUNT_REACT} REACT`);
    console.log("");
    
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
        
        const amountToDeposit = ethers.utils.parseEther(AMOUNT_REACT.toString());
        
        // Estimate gas
        const feeData = await provider.getFeeData();
        const gasPrice = feeData.gasPrice || ethers.BigNumber.from("1000000000");
        const estimatedGas = ethers.BigNumber.from(100000);
        const gasCost = estimatedGas.mul(gasPrice);
        const totalNeeded = amountToDeposit.add(gasCost);
        const totalNeededReact = ethers.utils.formatEther(totalNeeded);
        
        console.log("=".repeat(60));
        console.log("📤 DEPOSITING TO RESERVES");
        console.log("=".repeat(60));
        console.log("");
        console.log(`Amount to deposit: ${AMOUNT_REACT} REACT`);
        console.log(`Estimated gas: ${ethers.utils.formatEther(gasCost)} REACT`);
        console.log(`Total needed: ${totalNeededReact} REACT`);
        console.log("");
        console.log("Note: depositTo() will:");
        console.log("  • First settle any outstanding debt");
        console.log("  • Then add remaining funds to reserves");
        console.log("");
        
        if (walletBalance.lt(totalNeeded)) {
            const shortfall = ethers.utils.formatEther(totalNeeded.sub(walletBalance));
            console.log("❌ INSUFFICIENT BALANCE!");
            console.log(`   Balance: ${walletBalanceReact} REACT`);
            console.log(`   Needed: ${totalNeededReact} REACT`);
            console.log(`   Shortfall: ${shortfall} REACT`);
            process.exit(1);
        }
        
        // Calculate expected reserves after deposit
        const expectedReserves = debt.add(reserves).add(amountToDeposit);
        // If debt exists, it will be paid first, so reserves = reserves + (amount - debt)
        const expectedReservesAfter = parseFloat(debtReact) > 0 
            ? parseFloat(reservesReact) + (AMOUNT_REACT - parseFloat(debtReact))
            : parseFloat(reservesReact) + AMOUNT_REACT;
        
        console.log("Expected outcome:");
        if (parseFloat(debtReact) > 0) {
            console.log(`  Debt will be cleared: ${debtReact} REACT`);
            console.log(`  Remaining will go to reserves: ~${(AMOUNT_REACT - parseFloat(debtReact)).toFixed(6)} REACT`);
        } else {
            console.log(`  All ${AMOUNT_REACT} REACT will go to reserves`);
        }
        console.log(`  Expected reserves: ~${expectedReservesAfter.toFixed(6)} REACT`);
        console.log("");
        
        console.log("Sending transaction via depositTo()...");
        console.log("-".repeat(60));
        
        const tx = await systemContract.connect(wallet).depositTo(RSC_ADDRESS, {
            value: amountToDeposit,
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
        
        // Verify new status
        console.log("");
        console.log("Verifying new status...");
        const newReserves = await systemContract.reserves(RSC_ADDRESS);
        const newReservesReact = ethers.utils.formatEther(newReserves);
        
        const newDebt = await systemContract.debts(RSC_ADDRESS);
        const newDebtReact = ethers.utils.formatEther(newDebt);
        
        console.log("");
        console.log("=".repeat(60));
        console.log("📊 FINAL STATUS");
        console.log("=".repeat(60));
        console.log("");
        console.log("Previous Status:");
        console.log(`  Debt: ${debtReact} REACT`);
        console.log(`  Reserves: ${reservesReact} REACT`);
        console.log("");
        console.log("Current Status:");
        console.log(`  Debt: ${newDebtReact} REACT ${newDebt.eq(0) ? '✅' : '⚠️'}`);
        console.log(`  Reserves: ${newReservesReact} REACT`);
        console.log("");
        console.log(`Direct Balance: ${directBalanceReact} REACT (unchanged)`);
        console.log("");
        
        const reservesAdded = parseFloat(newReservesReact) - parseFloat(reservesReact);
        console.log(`Reserves increased by: ${reservesAdded.toFixed(6)} REACT`);
        
        if (parseFloat(newDebtReact) === 0 && parseFloat(newReservesReact) >= 0.001) {
            console.log("");
            console.log("✅ SUCCESS!");
            console.log("   Debt cleared and reserves funded.");
            console.log("   Contract should now be active.");
        }
        
        console.log("");
        console.log("🔗 View on Reactscan:");
        console.log(`   Transaction: https://reactscan.io/tx/${tx.hash}`);
        console.log(`   Contract: https://reactscan.io/address/${RSC_ADDRESS}`);
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

addReserves().catch(console.error);

