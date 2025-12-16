const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

/**
 * Monitor RSC contract activity and balance usage
 */
async function monitorContractActivity() {
    console.log("=".repeat(60));
    console.log("📊 MONITORING RSC CONTRACT ACTIVITY");
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
    
    console.log("Contract:", RSC_ADDRESS);
    console.log("Network: Reactive Network (Chain 1597)");
    console.log("");
    
    async function checkStatus() {
        const directBalance = await provider.getBalance(RSC_ADDRESS);
        const directBalanceReact = ethers.utils.formatEther(directBalance);
        
        const debt = await systemContract.debts(RSC_ADDRESS);
        const debtReact = ethers.utils.formatEther(debt);
        
        const reserves = await systemContract.reserves(RSC_ADDRESS);
        const reservesReact = ethers.utils.formatEther(reserves);
        
        const netBalance = directBalance.sub(debt);
        const netBalanceReact = ethers.utils.formatEther(netBalance);
        
        return {
            directBalance: directBalanceReact,
            debt: debtReact,
            reserves: reservesReact,
            netBalance: netBalanceReact
        };
    }
    
    // Initial check
    console.log("=".repeat(60));
    console.log("📊 INITIAL STATUS");
    console.log("=".repeat(60));
    console.log("");
    
    const initial = await checkStatus();
    console.log(`Direct Balance: ${initial.directBalance} REACT`);
    console.log(`Debt: ${initial.debt} REACT`);
    console.log(`Reserves: ${initial.reserves} REACT`);
    console.log(`Net Balance: ${initial.netBalance} REACT`);
    console.log("");
    
    console.log("Status Assessment:");
    if (parseFloat(initial.debt) > 0) {
        console.log("  ⚠️  Contract has debt - may be inactive");
    } else if (parseFloat(initial.reserves) < 0.0001 && parseFloat(initial.directBalance) < 0.001) {
        console.log("  ⚠️  Very low balances - may be inactive");
    } else if (parseFloat(initial.reserves) >= 0.0001 || parseFloat(initial.directBalance) >= 0.001) {
        console.log("  ✅ Contract should be active");
    }
    
    console.log("");
    console.log("=".repeat(60));
    console.log("🔍 MONITORING (30 seconds)");
    console.log("=".repeat(60));
    console.log("");
    console.log("Watching for balance changes...");
    console.log("(Press Ctrl+C to stop)");
    console.log("");
    
    let previousStatus = initial;
    let checkCount = 0;
    const checkInterval = 5000; // 5 seconds
    
    const interval = setInterval(async () => {
        checkCount++;
        const current = await checkStatus();
        
        const balanceChanged = parseFloat(current.directBalance) !== parseFloat(previousStatus.directBalance);
        const debtChanged = parseFloat(current.debt) !== parseFloat(previousStatus.debt);
        const reservesChanged = parseFloat(current.reserves) !== parseFloat(previousStatus.reserves);
        
        if (balanceChanged || debtChanged || reservesChanged) {
            console.log(`[Check ${checkCount}] Changes detected at ${new Date().toLocaleTimeString()}:`);
            if (balanceChanged) {
                const diff = parseFloat(current.directBalance) - parseFloat(previousStatus.directBalance);
                console.log(`  Direct Balance: ${previousStatus.directBalance} → ${current.directBalance} REACT (${diff > 0 ? '+' : ''}${diff.toFixed(8)})`);
            }
            if (debtChanged) {
                const diff = parseFloat(current.debt) - parseFloat(previousStatus.debt);
                console.log(`  Debt: ${previousStatus.debt} → ${current.debt} REACT (${diff > 0 ? '+' : ''}${diff.toFixed(8)})`);
            }
            if (reservesChanged) {
                const diff = parseFloat(current.reserves) - parseFloat(previousStatus.reserves);
                console.log(`  Reserves: ${previousStatus.reserves} → ${current.reserves} REACT (${diff > 0 ? '+' : ''}${diff.toFixed(8)})`);
            }
            console.log("");
            previousStatus = current;
        } else {
            process.stdout.write(`[${checkCount}] Monitoring... (Balance: ${current.directBalance} REACT, Debt: ${current.debt} REACT, Reserves: ${current.reserves} REACT)\r`);
        }
    }, checkInterval);
    
    // Stop after 30 seconds or manual interrupt
    setTimeout(() => {
        clearInterval(interval);
        console.log("");
        console.log("");
        console.log("=".repeat(60));
        console.log("📊 FINAL STATUS");
        console.log("=".repeat(60));
        console.log("");
        const final = await checkStatus();
        console.log(`Direct Balance: ${final.directBalance} REACT`);
        console.log(`Debt: ${final.debt} REACT`);
        console.log(`Reserves: ${final.reserves} REACT`);
        console.log(`Net Balance: ${final.netBalance} REACT`);
        console.log("");
        console.log("Monitoring stopped.");
        process.exit(0);
    }, 30000);
}

monitorContractActivity().catch(console.error);

