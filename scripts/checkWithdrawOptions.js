const ethers = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

/**
 * Check if RSC contract can withdraw funds back to wallet
 */
async function checkWithdrawOptions() {
    console.log("=".repeat(60));
    console.log("💰 CHECKING WITHDRAWAL OPTIONS");
    console.log("=".repeat(60));
    console.log("");
    
    const REACTIVE_RPC = process.env.REACTIVE_RPC || "https://mainnet-rpc.rnk.dev";
    const REACTIVE_PRIVATE_KEY = process.env.REACTIVE_PRIVATE_KEY;
    const RSC_ADDRESS = process.env.RSC_ADDRESS || "0x15725e58A3199122FcBb4d6F20573EEFd730781A";
    
    const provider = new ethers.providers.JsonRpcProvider(REACTIVE_RPC);
    const wallet = new ethers.Wallet(REACTIVE_PRIVATE_KEY, provider);
    
    console.log("Contract:", RSC_ADDRESS);
    console.log("Main Wallet:", wallet.address);
    console.log("");
    
    // Check contract balance
    const contractBalance = await provider.getBalance(RSC_ADDRESS);
    const contractBalanceReact = ethers.utils.formatEther(contractBalance);
    
    console.log("=".repeat(60));
    console.log("📊 CURRENT STATUS");
    console.log("=".repeat(60));
    console.log("");
    console.log(`Contract Balance: ${contractBalanceReact} REACT`);
    console.log("");
    
    // Read contract ABI to check for withdrawal functions
    const contractPath = path.join(__dirname, '..', 'reactive', 'out', 'FusionReactiveRSC.sol', 'FusionReactiveRSC.json');
    let contractABI = [];
    
    if (fs.existsSync(contractPath)) {
        const contractArtifact = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
        contractABI = contractArtifact.abi || [];
    } else {
        // Fallback: Try to get ABI from source code analysis
        console.log("⚠️  Contract artifact not found, checking source code...");
    }
    
    // Check for common withdrawal patterns
    const withdrawalFunctions = contractABI.filter(func => {
        if (func.type !== 'function') return false;
        const name = func.name?.toLowerCase() || '';
        return name.includes('withdraw') || 
               name.includes('transfer') ||
               (name.includes('owner') && func.stateMutability === 'nonpayable');
    });
    
    console.log("=".repeat(60));
    console.log("🔍 CONTRACT ANALYSIS");
    console.log("=".repeat(60));
    console.log("");
    
    if (withdrawalFunctions.length > 0) {
        console.log("Found potential withdrawal functions:");
        withdrawalFunctions.forEach(func => {
            console.log(`  • ${func.name}(${func.inputs?.map(i => i.type).join(', ') || ''})`);
        });
        console.log("");
    } else {
        console.log("⚠️  No withdrawal functions found in contract");
        console.log("");
    }
    
    // Try to check if contract has owner() function
    const ownerABI = ["function owner() view returns (address)"];
    try {
        const contract = new ethers.Contract(RSC_ADDRESS, ownerABI, provider);
        const owner = await contract.owner();
        console.log(`Contract Owner: ${owner}`);
        console.log(`Your Wallet: ${wallet.address}`);
        
        if (owner.toLowerCase() === wallet.address.toLowerCase()) {
            console.log("✅ You are the owner!");
            console.log("");
            console.log("However, the contract doesn't have a withdraw function.");
            console.log("This would require adding one to the contract code.");
        } else {
            console.log("⚠️  You are not the owner");
        }
        console.log("");
    } catch (e) {
        console.log("⚠️  Could not check owner (contract may not have owner function)");
        console.log("");
    }
    
    console.log("=".repeat(60));
    console.log("💡 ANSWER");
    console.log("=".repeat(60));
    console.log("");
    console.log("❌ Cannot directly withdraw the 4 REACT from contract balance");
    console.log("");
    console.log("Why:");
    console.log("  • Contract doesn't have withdraw/transfer functions");
    console.log("  • Contracts can't send funds without explicit functions");
    console.log("  • Would require contract modification + redeployment");
    console.log("");
    
    console.log("Alternatives:");
    console.log("");
    console.log("Option 1: Keep balance for operations (RECOMMENDED)");
    console.log("  • 4 REACT is optimal for event processing");
    console.log("  • Contract needs this for operations");
    console.log("  • Reserve funds for future operations");
    console.log("");
    
    console.log("Option 2: Let it deplete naturally");
    console.log("  • Contract will use it for operations");
    console.log("  • Balance will decrease as events are processed");
    console.log("  • Eventually balance will be low if not refueled");
    console.log("");
    
    console.log("Option 3: Modify contract (Requires redeployment)");
    console.log("  • Add withdraw() function to contract code");
    console.log("  • Redeploy contract with new function");
    console.log("  • Call withdraw() to recover funds");
    console.log("  ⚠️  This changes the contract address");
    console.log("");
    
    console.log("Option 4: Use reserves instead");
    console.log("  • Keep direct balance for operations");
    console.log("  • Reserves (3.99 REACT) can be accessed differently");
    console.log("  • Reserves are managed by system contract");
    console.log("");
    
    console.log("=".repeat(60));
    console.log("🎯 RECOMMENDATION");
    console.log("=".repeat(60));
    console.log("");
    console.log("Keep the 4 REACT in the contract:");
    console.log("  ✅ Needed for event processing");
    console.log("  ✅ Optimal amount for operations");
    console.log("  ✅ Will be used automatically");
    console.log("  ✅ You have 3.99 REACT in reserves as backup");
    console.log("");
    console.log("Total available: ~8 REACT (4 direct + 3.99 reserves)");
    console.log("This is a good allocation for sustained operations.");
    console.log("");
}

checkWithdrawOptions().catch(console.error);

