const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

/**
 * Investigate why contract was inactive despite having balance
 */
async function investigateInactiveIssue() {
    console.log("=".repeat(60));
    console.log("🔍 INVESTIGATING INACTIVE CONTRACT ISSUE");
    console.log("=".repeat(60));
    console.log("");
    
    const REACTIVE_RPC = process.env.REACTIVE_RPC || "https://mainnet-rpc.rnk.dev";
    const RSC_ADDRESS = process.env.RSC_ADDRESS || "0x15725e58A3199122FcBb4d6F20573EEFd730781A";
    const SYSTEM_CONTRACT = "0x0000000000000000000000000000000000fffFfF";
    
    const provider = new ethers.providers.JsonRpcProvider(REACTIVE_RPC);
    
    const systemContractABI = [
        "function debts(address) view returns (uint256)",
        "function reserves(address) view returns (uint256)"
    ];
    
    const systemContract = new ethers.Contract(SYSTEM_CONTRACT, systemContractABI, provider);
    
    try {
        const directBalance = await provider.getBalance(RSC_ADDRESS);
        const directBalanceReact = ethers.utils.formatEther(directBalance);
        
        const debt = await systemContract.debts(RSC_ADDRESS);
        const debtReact = ethers.utils.formatEther(debt);
        
        const reserves = await systemContract.reserves(RSC_ADDRESS);
        const reservesReact = ethers.utils.formatEther(reserves);
        
        console.log("=".repeat(60));
        console.log("📊 CURRENT STATUS");
        console.log("=".repeat(60));
        console.log("");
        console.log(`Direct Balance: ${directBalanceReact} REACT`);
        console.log(`Debt: ${debtReact} REACT`);
        console.log(`Reserves: ${reservesReact} REACT`);
        console.log("");
        
        console.log("=".repeat(60));
        console.log("🔍 ANALYSIS: Why Contract Was Inactive");
        console.log("=".repeat(60));
        console.log("");
        
        console.log("Key Observation:");
        console.log("  • Contract had 4 REACT in direct balance");
        console.log("  • Contract was INACTIVE");
        console.log("  • After adding reserves (0.0001 REACT), contract became ACTIVE");
        console.log("");
        
        console.log("=".repeat(60));
        console.log("💡 HYPOTHESIS");
        console.log("=".repeat(60));
        console.log("");
        console.log("Reactive Network activation logic likely checks:");
        console.log("");
        console.log("1. Reserves as Activation Requirement:");
        console.log("   • System contract checks RESERVES (not direct balance)");
        console.log("   • Reserves act as 'commitment' that contract can pay debts");
        console.log("   • Direct balance is for operations, reserves are for activation");
        console.log("   • Minimum reserve threshold required (maybe > 0 or >= 0.0001)");
        console.log("");
        
        console.log("2. Why Direct Balance Alone Isn't Enough:");
        console.log("   • Direct balance can be used/spent by operations");
        console.log("   • System needs guaranteed funds for debt settlement");
        console.log("   • Reserves are 'locked' by system contract as guarantee");
        console.log("   • Reserves ensure contract can pay post-factum fees");
        console.log("");
        
        console.log("3. How Activation Works:");
        console.log("   • Active = Has reserves (guarantee) + can process transactions");
        console.log("   • Inactive = No reserves (no guarantee) → system blocks processing");
        console.log("   • Direct balance = Operations fuel (but doesn't activate contract)");
        console.log("");
        
        console.log("=".repeat(60));
        console.log("📋 RECOMMENDED FUNDING STRATEGY");
        console.log("=".repeat(60));
        console.log("");
        console.log("For contract to stay active:");
        console.log("");
        console.log("1. Reserves (Activation Key):");
        console.log("   • Minimum: 0.0001 REACT (or similar threshold)");
        console.log("   • Recommended: 0.001-1.0 REACT");
        console.log("   • Purpose: Guarantee for debt settlement");
        console.log("   • Managed by: System contract");
        console.log("");
        
        console.log("2. Direct Balance (Operations Fuel):");
        console.log("   • Recommended: 1-10 REACT");
        console.log("   • Purpose: Pay for event processing, callbacks");
        console.log("   • Managed by: Contract itself");
        console.log("");
        
        console.log("3. Your Current Allocation:");
        console.log(`   • Reserves: ${reservesReact} REACT ✅ (should keep active)`);
        console.log(`   • Direct Balance: ${directBalanceReact} REACT ✅ (for operations)`);
        console.log(`   • Total: ${(parseFloat(directBalanceReact) + parseFloat(reservesReact)).toFixed(6)} REACT`);
        console.log("");
        
        console.log("=".repeat(60));
        console.log("🎯 KEY INSIGHT");
        console.log("=".repeat(60));
        console.log("");
        console.log("Reserves = Activation Key 🔑");
        console.log("Direct Balance = Operations Fuel ⛽");
        console.log("");
        console.log("You need BOTH:");
        console.log("  ✅ Reserves > 0 → Contract stays active");
        console.log("  ✅ Direct Balance > 0 → Contract can operate");
        console.log("");
        console.log("This is why contract was inactive:");
        console.log("  ❌ Had direct balance (4 REACT) but no reserves");
        console.log("  ✅ Now has both (4 REACT direct + 3.99 REACT reserves)");
        console.log("");
        
        console.log("=".repeat(60));
        console.log("📝 MONITORING RECOMMENDATION");
        console.log("=".repeat(60));
        console.log("");
        console.log("Watch reserves closely:");
        console.log("  • If reserves drop to 0 → Contract may become inactive");
        console.log("  • If reserves < 0.0001 → May trigger inactivity");
        console.log("  • Keep reserves above minimum threshold");
        console.log("");
        console.log("Direct balance will decrease with operations (normal).");
        console.log("Reserves are used automatically for debt settlement.");
        console.log("");
        
    } catch (error) {
        console.log("Error:", error.message);
    }
}

investigateInactiveIssue().catch(console.error);

