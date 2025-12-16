const { ethers } = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function setupNewestRSC() {
    // NEWEST CONTRACT (with constructor subscriptions)
    const CONTRACT = "0x0443d566433992B0C298ebD68768E7921cbC0BDF";
    const SYSTEM_CONTRACT = "0x0000000000000000000000000000000000fffFfF";
    const REACTIVE_RPC = process.env.REACTIVE_RPC || "https://mainnet-rpc.rnk.dev";
    
    if (!process.env.REACTIVE_PRIVATE_KEY) {
        console.error("❌ REACTIVE_PRIVATE_KEY not set");
        process.exit(1);
    }
    
    const provider = new ethers.providers.JsonRpcProvider(REACTIVE_RPC);
    const signer = new ethers.Wallet(process.env.REACTIVE_PRIVATE_KEY, provider);
    
    console.log("🚀 Setting Up Newest RSC Contract...\n");
    console.log("Contract:", CONTRACT);
    console.log("Signer:", signer.address);
    console.log("");
    
    // Check contract
    const code = await provider.getCode(CONTRACT);
    if (code === "0x") {
        console.error("❌ Contract does not exist!");
        process.exit(1);
    }
    console.log("✅ Contract exists\n");
    
    // Check state
    const ABI = [
        "function owner() view returns (address)",
        "function aavePool() view returns (address)",
        "function compoundUsdc() view returns (address)"
    ];
    
    const contract = new ethers.Contract(CONTRACT, ABI, provider);
    const owner = await contract.owner();
    const aavePool = await contract.aavePool();
    const compoundUsdc = await contract.compoundUsdc();
    
    console.log("Contract State:");
    console.log("  Owner:", owner);
    console.log("  Aave Pool:", aavePool);
    console.log("  Compound USDC:", compoundUsdc);
    
    if (owner.toLowerCase() !== signer.address.toLowerCase()) {
        console.error("❌ Signer is not the owner!");
        process.exit(1);
    }
    console.log("✅ Owner verified\n");
    
    // Fund contract
    console.log("=".repeat(60));
    console.log("STEP 1: Funding Contract");
    console.log("=".repeat(60));
    console.log("");
    
    try {
        const balance = await provider.getBalance(CONTRACT);
        console.log("Current balance:", ethers.utils.formatEther(balance), "REACT");
        
        if (balance.lt(ethers.utils.parseEther("1.0"))) {
            const SYSTEM_ABI = ["function depositTo(address reactiveContract) external payable"];
            const systemContract = new ethers.Contract(SYSTEM_CONTRACT, SYSTEM_ABI, signer);
            
            const fundTx = await systemContract.depositTo(CONTRACT, {
                value: ethers.utils.parseEther("1.0"),
                gasLimit: 100000
            });
            
            console.log("Funding transaction:", fundTx.hash);
            await fundTx.wait();
            console.log("✅ Contract funded!\n");
        } else {
            console.log("✅ Contract already funded\n");
        }
    } catch (error) {
        console.log("⚠️  Funding error:", error.message);
        console.log("Continuing anyway...\n");
    }
    
    console.log("=".repeat(60));
    console.log("📊 STATUS");
    console.log("=".repeat(60));
    console.log("");
    console.log("✅ Contract deployed at:", CONTRACT);
    console.log("✅ Subscription parameters configured in constructor");
    console.log("⚠️  Subscriptions attempted in constructor (with try-catch)");
    console.log("");
    console.log("💡 Note: System contract subscribe() is reverting.");
    console.log("   This might be due to:");
    console.log("   1. Contract needs funding before subscribing");
    console.log("   2. System contract validation requirements");
    console.log("   3. Subscription format issues");
    console.log("");
    console.log("🔗 View on Reactscan:");
    console.log(`   https://reactscan.io/address/${CONTRACT}`);
    console.log("");
    console.log("💡 Update your .env file with:");
    console.log(`RSC_ADDRESS=${CONTRACT}`);
    console.log("");
}

setupNewestRSC().catch(console.error);

