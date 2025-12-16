const { ethers } = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function checkContractFunding() {
    const RSC_ADDRESS = process.env.RSC_ADDRESS || "0xdC2eAcb778951d9dFB0050a0E3335C7Ab3E4CabE";
    const REACTIVE_RPC = process.env.REACTIVE_RPC || "https://mainnet-rpc.rnk.dev";
    const SYSTEM_CONTRACT = "0x0000000000000000000000000000000000fffFfF";
    
    console.log("=".repeat(60));
    console.log("💰 CHECKING CONTRACT FUNDING STATUS");
    console.log("=".repeat(60));
    console.log(`Contract: ${RSC_ADDRESS}`);
    console.log("");
    
    const provider = new ethers.providers.JsonRpcProvider(REACTIVE_RPC);
    
    // Check direct balance
    console.log("1. DIRECT BALANCE");
    console.log("-".repeat(60));
    try {
        const balance = await provider.getBalance(RSC_ADDRESS);
        const balanceEth = ethers.utils.formatEther(balance);
        console.log(`   Balance: ${balanceEth} REACT`);
        
        if (parseFloat(balanceEth) > 0) {
            console.log("   ✅ Contract has direct balance");
        } else {
            console.log("   ⚠️  No direct balance");
        }
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
    }
    console.log("");
    
    // Check debt and reserves with system contract
    console.log("2. SYSTEM CONTRACT (Debt & Reserves)");
    console.log("-".repeat(60));
    
    try {
        const SYSTEM_ABI = [
            "function debts(address) view returns (uint256)",
            "function reserves(address) view returns (uint256)"
        ];
        const systemContract = new ethers.Contract(SYSTEM_CONTRACT, SYSTEM_ABI, provider);
        
        const debt = await systemContract.debts(RSC_ADDRESS);
        const reserves = await systemContract.reserves(RSC_ADDRESS);
        
        const debtEth = ethers.utils.formatEther(debt);
        const reservesEth = ethers.utils.formatEther(reserves);
        
        console.log(`   Debt: ${debtEth} REACT`);
        console.log(`   Reserves: ${reservesEth} REACT`);
        
        if (parseFloat(reservesEth) > 0) {
            console.log("   ✅ Contract has reserves held by system contract");
            console.log("   💡 These reserves are available for execution");
        } else if (parseFloat(debtEth) > 0) {
            console.log("   ⚠️  Contract has outstanding debt!");
            console.log("   💡 Needs funding to cover debt");
        } else {
            console.log("   ⚠️  No reserves or debt registered");
        }
        
        // Net funding status
        const netFunding = parseFloat(reservesEth) - parseFloat(debtEth);
        if (netFunding > 0) {
            console.log(`\n   ✅ Net Available: ${netFunding.toFixed(4)} REACT`);
        } else if (netFunding < 0) {
            console.log(`\n   ❌ Net Debt: ${Math.abs(netFunding).toFixed(4)} REACT`);
            console.log("   💡 Contract needs more funding");
        } else {
            console.log(`\n   ⚠️  Net Funding: 0 REACT`);
            console.log("   💡 Contract may need funding for execution");
        }
        
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
    }
    console.log("");
    
    // Summary
    console.log("=".repeat(60));
    console.log("📊 SUMMARY");
    console.log("=".repeat(60));
    
    try {
        const balance = await provider.getBalance(RSC_ADDRESS);
        const balanceEth = parseFloat(ethers.utils.formatEther(balance));
        
        const SYSTEM_ABI = [
            "function debts(address) view returns (uint256)",
            "function reserves(address) view returns (uint256)"
        ];
        const systemContract = new ethers.Contract(SYSTEM_CONTRACT, SYSTEM_ABI, provider);
        const debt = await systemContract.debts(RSC_ADDRESS);
        const reserves = await systemContract.reserves(RSC_ADDRESS);
        const debtEth = parseFloat(ethers.utils.formatEther(debt));
        const reservesEth = parseFloat(ethers.utils.formatEther(reserves));
        
        const totalAvailable = balanceEth + reservesEth - debtEth;
        
        if (totalAvailable > 0.01) {
            console.log(`✅ Contract is FUNDED`);
            console.log(`   Total Available: ${totalAvailable.toFixed(4)} REACT`);
            console.log(`   This should be sufficient for event processing`);
        } else if (totalAvailable > 0) {
            console.log(`⚠️  Contract has SOME funding`);
            console.log(`   Total Available: ${totalAvailable.toFixed(4)} REACT`);
            console.log(`   Consider funding more for reliable execution`);
        } else {
            console.log(`❌ Contract needs FUNDING`);
            console.log(`   Total Available: ${totalAvailable.toFixed(4)} REACT`);
            console.log(`   Run: node scripts/fundAndCoverDebt.js`);
        }
        
    } catch (error) {
        console.log(`❌ Could not determine funding status: ${error.message}`);
    }
    
    console.log("");
}

checkContractFunding().catch(console.error);

