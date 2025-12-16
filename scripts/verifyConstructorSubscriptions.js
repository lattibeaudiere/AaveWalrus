const { ethers } = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function verifyConstructorSubscriptions() {
    const CONTRACT = "0x0443d566433992B0C298ebD68768E7921cbC0BDF";
    const REACTIVE_RPC = process.env.REACTIVE_RPC || "https://mainnet-rpc.rnk.dev";
    
    const provider = new ethers.providers.JsonRpcProvider(REACTIVE_RPC);
    
    console.log("🔍 Verifying Constructor Subscriptions...\n");
    console.log("Contract:", CONTRACT);
    console.log("");
    
    const ABI = [
        "function owner() view returns (address)",
        "function aavePool() view returns (address)",
        "function compoundUsdc() view returns (address)",
        "function aaveTopic0() view returns (bytes32)",
        "function compoundTopic0() view returns (bytes32)",
        "function service() view returns (address)",
        "function adapter() view returns (address)"
    ];
    
    try {
        const contract = new ethers.Contract(CONTRACT, ABI, provider);
        
        const owner = await contract.owner();
        const aavePool = await contract.aavePool();
        const compoundUsdc = await contract.compoundUsdc();
        const aaveTopic0 = await contract.aaveTopic0();
        const compoundTopic0 = await contract.compoundTopic0();
        const service = await contract.service();
        const adapter = await contract.adapter();
        
        console.log("✅ Contract State:");
        console.log("  Owner:", owner);
        console.log("  Service:", service);
        console.log("  Adapter:", adapter);
        console.log("  Aave Pool:", aavePool);
        console.log("  Compound USDC:", compoundUsdc);
        console.log("  Aave Topic0:", aaveTopic0);
        console.log("  Compound Topic0:", compoundTopic0);
        console.log("");
        
        // Check if subscriptions were configured
        const EXPECTED_AAVE = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
        const EXPECTED_COMPOUND = "0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA";
        const EXPECTED_AAVE_TOPIC = "0xb2a02bf1a92354a66946e3533277a66dd13726c1695e5ac302d1c1fcb97d2200";
        const EXPECTED_COMPOUND_TOPIC = "0x717fee053884ab1935ba6d0140f6ed225371439611d9674ff445419d6a0fa1b7";
        
        console.log("🔍 Verifying Subscription Parameters:\n");
        
        if (aavePool.toLowerCase() === EXPECTED_AAVE.toLowerCase()) {
            console.log("✅ Aave Pool matches:", aavePool);
        } else {
            console.log("❌ Aave Pool mismatch!");
            console.log("  Expected:", EXPECTED_AAVE);
            console.log("  Got:", aavePool);
        }
        
        if (aaveTopic0.toLowerCase() === EXPECTED_AAVE_TOPIC.toLowerCase()) {
            console.log("✅ Aave Topic0 matches:", aaveTopic0);
        } else {
            console.log("❌ Aave Topic0 mismatch!");
            console.log("  Expected:", EXPECTED_AAVE_TOPIC);
            console.log("  Got:", aaveTopic0);
        }
        
        if (compoundUsdc.toLowerCase() === EXPECTED_COMPOUND.toLowerCase()) {
            console.log("✅ Compound USDC matches:", compoundUsdc);
        } else {
            console.log("❌ Compound USDC mismatch!");
            console.log("  Expected:", EXPECTED_COMPOUND);
            console.log("  Got:", compoundUsdc);
        }
        
        if (compoundTopic0.toLowerCase() === EXPECTED_COMPOUND_TOPIC.toLowerCase()) {
            console.log("✅ Compound Topic0 matches:", compoundTopic0);
        } else {
            console.log("❌ Compound Topic0 mismatch!");
            console.log("  Expected:", EXPECTED_COMPOUND_TOPIC);
            console.log("  Got:", compoundTopic0);
        }
        
        console.log("");
        console.log("=".repeat(60));
        console.log("📊 SUMMARY");
        console.log("=".repeat(60));
        console.log("");
        console.log("✅ Contract deployed successfully");
        console.log("✅ Subscription parameters configured");
        console.log("⚠️  Constructor used try-catch - subscriptions may have failed silently");
        console.log("");
        console.log("💡 The system contract is reverting when subscribe() is called.");
        console.log("   This suggests there might be a requirement we're missing:");
        console.log("   1. Contract might need funding before subscribing");
        console.log("   2. System contract might have validation we're not meeting");
        console.log("   3. Subscription parameters might need adjustment");
        console.log("");
        console.log("🔗 Check Reactscan:");
        console.log(`   https://reactscan.io/address/${CONTRACT}`);
        console.log("");
        console.log("📝 Next: Contact Reactive Network support or check docs");
        console.log("   to understand why subscribe() is reverting.");
        
    } catch (error) {
        console.log("❌ Error:", error.message);
    }
}

verifyConstructorSubscriptions().catch(console.error);

