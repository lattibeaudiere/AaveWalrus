const { ethers } = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function checkStatus() {
    const CONTRACT = process.env.RSC_ADDRESS || "0x02c904E571749c61bdd05e58FbF91F7921594186";
    const SYSTEM_CONTRACT = "0x0000000000000000000000000000000000fffFfF";
    const REACTIVE_RPC = process.env.REACTIVE_RPC || "https://mainnet-rpc.rnk.dev";
    
    const provider = new ethers.providers.JsonRpcProvider(REACTIVE_RPC);
    
    const SYSTEM_ABI = [
        "function debts(address) view returns (uint256)",
        "function reserves(address) view returns (uint256)"
    ];
    
    const systemContract = new ethers.Contract(SYSTEM_CONTRACT, SYSTEM_ABI, provider);
    
    console.log("📊 Reactive Contract Status\n");
    console.log("Contract:", CONTRACT);
    console.log("System Contract:", SYSTEM_CONTRACT);
    console.log("");
    
    // Check contract balance (direct balance)
    const balance = await provider.getBalance(CONTRACT);
    console.log("💰 Contract Balance (direct):", ethers.utils.formatEther(balance), "REACT");
    
    // Check debt
    try {
        const debt = await systemContract.debts(CONTRACT);
        console.log("💳 Contract Debt:", ethers.utils.formatEther(debt), "REACT");
    } catch (error) {
        console.log("💳 Contract Debt: (could not check)");
    }
    
    // Check reserves (funds held by system contract)
    try {
        const reserves = await systemContract.reserves(CONTRACT);
        const reservesEth = ethers.utils.formatEther(reserves);
        console.log("🏦 System Contract Reserves:", reservesEth, "REACT");
        
        if (parseFloat(reservesEth) > 0) {
            console.log("   ✅ Contract has reserves - funding successful!");
        } else {
            console.log("   ⚠️  No reserves - contract may need funding");
        }
    } catch (error) {
        console.log("🏦 System Contract Reserves: (could not check)");
    }
    
    // Total available funds = balance + reserves - debt
    try {
        const debt = await systemContract.debts(CONTRACT);
        const reserves = await systemContract.reserves(CONTRACT);
        const totalAvailable = balance.add(reserves).sub(debt);
        console.log("\n💎 Total Available Funds:", ethers.utils.formatEther(totalAvailable), "REACT");
        
        if (parseFloat(ethers.utils.formatEther(totalAvailable)) > 0) {
            console.log("   ✅ Contract is funded and ready!");
        } else {
            console.log("   ⚠️  Contract needs funding");
        }
    } catch (error) {
        console.log("\n💎 Total Available: (could not calculate)");
    }
    
    console.log("\n📋 Next Steps:");
    console.log("   - Contract will use reserves to pay for RVM transactions");
    console.log("   - Reserves are automatically used when callbacks execute");
    console.log("   - Monitor reserves and add more if needed");
}

checkStatus().catch(console.error);

