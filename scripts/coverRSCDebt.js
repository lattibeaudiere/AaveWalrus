const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

/**
 * Cover the debt of the RSC contract on Reactive Network
 */
async function coverRSCDebt() {
    console.log("=".repeat(60));
    console.log("💰 COVERING RSC CONTRACT DEBT");
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
        "function depositTo(address) payable",
        "function coverDebt(address) payable"
    ];
    
    // RSC Contract ABI (for coverDebt if it exists)
    const rscABI = [
        "function coverDebt() external payable"
    ];
    
    const systemContract = new ethers.Contract(SYSTEM_CONTRACT, systemContractABI, provider);
    const rscContract = new ethers.Contract(RSC_ADDRESS, rscABI, provider);
    
    try {
        // Check current debt
        const debt = await systemContract.debts(RSC_ADDRESS);
        const debtReact = ethers.utils.formatEther(debt);
        
        console.log("=".repeat(60));
        console.log("📊 CURRENT DEBT STATUS");
        console.log("=".repeat(60));
        console.log("");
        console.log(`Debt: ${debtReact} REACT`);
        console.log("");
        
        if (debt.eq(0)) {
            console.log("✅ No debt to cover!");
            console.log("   Contract is already debt-free.");
            return;
        }
        
        // Check wallet balance
        const walletBalance = await provider.getBalance(wallet.address);
        const walletBalanceReact = ethers.utils.formatEther(walletBalance);
        
        console.log(`Wallet balance: ${walletBalanceReact} REACT`);
        console.log("");
        
        // Estimate gas cost
        const feeData = await provider.getFeeData();
        const gasPrice = feeData.gasPrice || ethers.BigNumber.from("1000000000");
        const estimatedGas = ethers.BigNumber.from(100000); // Estimate
        const gasCost = estimatedGas.mul(gasPrice);
        const totalNeeded = debt.add(gasCost);
        const totalNeededReact = ethers.utils.formatEther(totalNeeded);
        
        console.log(`Estimated gas: ${ethers.utils.formatEther(gasCost)} REACT`);
        console.log(`Total needed: ${totalNeededReact} REACT`);
        console.log("");
        
        if (walletBalance.lt(totalNeeded)) {
            const shortfall = ethers.utils.formatEther(totalNeeded.sub(walletBalance));
            console.log("❌ INSUFFICIENT BALANCE!");
            console.log(`   Balance: ${walletBalanceReact} REACT`);
            console.log(`   Needed: ${totalNeededReact} REACT`);
            console.log(`   Shortfall: ${shortfall} REACT`);
            process.exit(1);
        }
        
        console.log("=".repeat(60));
        console.log("📤 COVERING DEBT");
        console.log("=".repeat(60));
        console.log("");
        
        // Use system contract's depositTo() method
        // This automatically settles any debt when funds are deposited
        console.log("Using system contract depositTo() to cover debt...");
        console.log("  (This method automatically settles debt)");
        console.log("");
        
        // Add a small buffer to ensure debt is fully covered and contract has some balance
        const amountToDeposit = debt.add(ethers.utils.parseEther("0.001")); // debt + 0.001 REACT buffer
        
        const tx = await systemContract.connect(wallet).depositTo(RSC_ADDRESS, {
            value: amountToDeposit,
            gasLimit: 200000,
            gasPrice: gasPrice,
        });
        
        console.log(`  Transaction hash: ${tx.hash}`);
        console.log(`  Waiting for confirmation...`);
        
        const receipt = await tx.wait();
        
        console.log("\n" + "=".repeat(60));
        console.log("✅ TRANSACTION CONFIRMED");
        console.log("=".repeat(60));
        console.log(`\nBlock: ${receipt.blockNumber}`);
        console.log(`Gas Used: ${receipt.gasUsed.toString()}`);
        console.log(`Gas Cost: ${ethers.utils.formatEther(receipt.gasUsed.mul(gasPrice))} REACT`);
        console.log(`Status: ${receipt.status === 1 ? '✅ Success' : '❌ Failed'}`);
        
        // Verify debt is cleared
        console.log("");
        console.log("Verifying debt status...");
        const newDebt = await systemContract.debts(RSC_ADDRESS);
        const newDebtReact = ethers.utils.formatEther(newDebt);
        
        console.log("");
        console.log("=".repeat(60));
        console.log("📊 FINAL STATUS");
        console.log("=".repeat(60));
        console.log("");
        console.log(`Previous Debt: ${debtReact} REACT`);
        console.log(`Current Debt: ${newDebtReact} REACT`);
        
        if (newDebt.eq(0)) {
            console.log("");
            console.log("✅ DEBT SUCCESSFULLY COVERED!");
        } else {
            console.log("");
            console.log("⚠️  Debt partially covered or still exists");
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

coverRSCDebt().catch(console.error);

