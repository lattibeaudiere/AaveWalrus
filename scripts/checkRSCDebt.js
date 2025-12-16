const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

/**
 * Check debt status of the RSC contract on Reactive Network
 */
async function checkRSCDebt() {
    console.log("=".repeat(60));
    console.log("💰 CHECKING RSC CONTRACT DEBT");
    console.log("=".repeat(60));
    console.log("");
    
    const REACTIVE_RPC = process.env.REACTIVE_RPC || "https://mainnet-rpc.rnk.dev";
    const RSC_ADDRESS = process.env.RSC_ADDRESS || "0x15725e58A3199122FcBb4d6F20573EEFd730781A";
    
    // Reactive Network System Contract
    const SYSTEM_CONTRACT = "0x0000000000000000000000000000000000fffFfF";
    
    const provider = new ethers.providers.JsonRpcProvider(REACTIVE_RPC);
    
    console.log("Configuration:");
    console.log(`  Network: Reactive Network (Chain 1597)`);
    console.log(`  RSC Contract: ${RSC_ADDRESS}`);
    console.log(`  System Contract: ${SYSTEM_CONTRACT}`);
    console.log("");
    
    // System Contract ABI (for debt queries)
    const systemContractABI = [
        "function debts(address) view returns (uint256)",
        "function reserves(address) view returns (uint256)",
        "function getAccountInfo(address) view returns (uint256 balance, uint256 debt, uint256 reserves)"
    ];
    
    const systemContract = new ethers.Contract(SYSTEM_CONTRACT, systemContractABI, provider);
    
    try {
        console.log("=".repeat(60));
        console.log("📊 RSC CONTRACT STATUS");
        console.log("=".repeat(60));
        console.log("");
        
        // Check direct balance
        const directBalance = await provider.getBalance(RSC_ADDRESS);
        const directBalanceReact = ethers.utils.formatEther(directBalance);
        
        console.log("Direct Balance (on contract):");
        console.log(`  ${directBalanceReact} REACT`);
        console.log("");
        
        // Check debt
        let debt;
        try {
            debt = await systemContract.debts(RSC_ADDRESS);
            const debtReact = ethers.utils.formatEther(debt);
            
            console.log("Debt (to Reactive Network):");
            if (debt.gt(0)) {
                console.log(`  ${debtReact} REACT ⚠️  HAS DEBT`);
            } else {
                console.log(`  ${debtReact} REACT ✅ NO DEBT`);
            }
            console.log("");
        } catch (error) {
            console.log("⚠️  Could not query debt:", error.message);
            debt = ethers.BigNumber.from(0);
        }
        
        // Check reserves
        let reserves;
        try {
            reserves = await systemContract.reserves(RSC_ADDRESS);
            const reservesReact = ethers.utils.formatEther(reserves);
            
            console.log("Reserves (held by system contract):");
            console.log(`  ${reservesReact} REACT`);
            console.log("");
        } catch (error) {
            console.log("⚠️  Could not query reserves:", error.message);
            reserves = ethers.BigNumber.from(0);
        }
        
        // Try getAccountInfo if available
        try {
            const accountInfo = await systemContract.getAccountInfo(RSC_ADDRESS);
            console.log("Account Info (from system contract):");
            console.log(`  Balance: ${ethers.utils.formatEther(accountInfo.balance)} REACT`);
            console.log(`  Debt: ${ethers.utils.formatEther(accountInfo.debt)} REACT`);
            console.log(`  Reserves: ${ethers.utils.formatEther(accountInfo.reserves)} REACT`);
            console.log("");
        } catch (error) {
            // Method may not exist, that's okay
        }
        
        // Calculate net balance
        const netBalance = directBalance.sub(debt);
        const netBalanceReact = ethers.utils.formatEther(netBalance);
        
        console.log("=".repeat(60));
        console.log("📈 SUMMARY");
        console.log("=".repeat(60));
        console.log("");
        console.log(`Direct Balance: ${directBalanceReact} REACT`);
        console.log(`Debt: ${ethers.utils.formatEther(debt)} REACT`);
        console.log(`Reserves: ${ethers.utils.formatEther(reserves)} REACT`);
        console.log(`Net Balance: ${netBalanceReact} REACT`);
        console.log("");
        
        // Status evaluation
        if (debt.gt(0)) {
            console.log("⚠️  STATUS: CONTRACT HAS DEBT");
            console.log("");
            console.log("The contract owes REACT to Reactive Network.");
            console.log("Debt needs to be covered for the contract to operate properly.");
            console.log("");
            console.log("To cover debt:");
            console.log("  node scripts/coverRSCDebt.js");
            console.log("");
        } else {
            console.log("✅ STATUS: NO DEBT");
            console.log("");
            console.log("Contract is fully funded and ready for operations.");
            console.log("");
        }
        
        // Check if contract can pay for operations
        const estimatedOperationCost = ethers.utils.parseEther("0.1"); // ~0.1 REACT per operation
        if (netBalance.gte(estimatedOperationCost)) {
            console.log("✅ Sufficient balance for operations");
            console.log(`   Can perform ~${Math.floor(parseFloat(netBalanceReact) / 0.1)} operations`);
        } else {
            console.log("⚠️  Low balance - may need more funding");
            console.log(`   Recommended: At least 0.1 REACT for reliable operations`);
        }
        
        console.log("");
        console.log("🔗 View on Reactscan:");
        console.log(`   https://reactscan.io/address/${RSC_ADDRESS}`);
        console.log("");
        
    } catch (error) {
        console.log("❌ Error checking contract status!");
        console.log(`Error: ${error.message}`);
        
        if (error.data) {
            console.log(`Error data: ${error.data}`);
        }
        
        process.exit(1);
    }
}

checkRSCDebt().catch(console.error);

