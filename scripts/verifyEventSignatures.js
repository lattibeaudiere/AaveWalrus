const { ethers } = require('ethers');

async function verifyEventSignatures() {
    console.log("=".repeat(60));
    console.log("🔍 VERIFYING EVENT SIGNATURES");
    console.log("=".repeat(60));
    console.log("");
    
    // Aave V3 ReserveDataUpdated
    const aaveSignature = "ReserveDataUpdated(address,uint256,uint256,uint256,uint256,uint256)";
    const aaveTopic0 = ethers.utils.id(aaveSignature);
    
    console.log("1. AAVE V3 ReserveDataUpdated");
    console.log("-".repeat(60));
    console.log(`   Signature: ${aaveSignature}`);
    console.log(`   Topic 0: ${aaveTopic0}`);
    console.log(`   Expected: 0xb2a02bf1a92354a66946e3533277a66dd13726c1695e5ac302d1c1fcb97d2200`);
    console.log(`   Match: ${aaveTopic0.toLowerCase() === "0xb2a02bf1a92354a66946e3533277a66dd13726c1695e5ac302d1c1fcb97d2200" ? "✅ YES" : "❌ NO"}`);
    console.log("");
    
    // Compound V3 AccrueInterest
    const compoundSignature = "AccrueInterest(uint256,uint256,uint256,uint256,uint256)";
    const compoundTopic0 = ethers.utils.id(compoundSignature);
    
    console.log("2. COMPOUND V3 AccrueInterest");
    console.log("-".repeat(60));
    console.log(`   Signature: ${compoundSignature}`);
    console.log(`   Topic 0: ${compoundTopic0}`);
    console.log(`   Expected: 0x717fee053884ab1935ba6d0140f6ed225371439611d9674ff445419d6a0fa1b7`);
    console.log(`   Match: ${compoundTopic0.toLowerCase() === "0x717fee053884ab1935ba6d0140f6ed225371439611d9674ff445419d6a0fa1b7" ? "✅ YES" : "❌ NO"}`);
    console.log("");
    
    // Check alternative Compound events
    console.log("3. ALTERNATIVE COMPOUND V3 EVENTS");
    console.log("-".repeat(60));
    
    const alternatives = [
        "AccrueInterest(uint256,uint256,uint256)",
        "AccrueInterest(uint256,uint256,uint256,uint256)",
        "InterestAccrued(uint256,uint256,uint256,uint256,uint256)",
        "Supply(address,address,uint256)",
        "Withdraw(address,address,uint256)",
        "MarketUpdate(uint256,uint256,uint256,uint256,uint256)"
    ];
    
    alternatives.forEach(sig => {
        const topic = ethers.utils.id(sig);
        console.log(`   ${sig}`);
        console.log(`     Topic 0: ${topic}`);
    });
    
    console.log("");
    console.log("=".repeat(60));
    console.log("💡 NEXT STEPS");
    console.log("=".repeat(60));
    console.log("");
    console.log("1. Check Arbiscan directly:");
    console.log("   Aave: https://arbiscan.io/address/0x794a61358D6845594F94dc1DB02A252b5b4814aD#events");
    console.log("   Compound: https://arbiscan.io/address/0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA#events");
    console.log("");
    console.log("2. The issue might be:");
    console.log("   - Events don't fire frequently (check Arbiscan for recent activity)");
    console.log("   - Wrong event signature for Compound");
    console.log("   - Reactive Network hasn't indexed the subscriptions yet");
    console.log("   - Need to wait for actual protocol activity");
    console.log("");
}

verifyEventSignatures().catch(console.error);

