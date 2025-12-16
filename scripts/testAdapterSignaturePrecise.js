const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function testAdapterSignaturePrecise() {
    console.log("🔍 Precise Adapter Signature Test\n");
    console.log("=".repeat(60));
    
    const ADAPTER_ADDRESS = "0xa60c91Aa6E0e203De3a6692a82eE65884B3B2D09";
    const RSC_ADDRESS = process.env.RSC_ADDRESS || "0xEFD20dC51F7c82B7430490Bf45767bA57F6819fc";
    
    const provider = new ethers.providers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc"
    );
    
    // Get the actual bytecode
    const code = await provider.getCode(ADAPTER_ADDRESS);
    console.log("\n1️⃣  Contract Bytecode Analysis:");
    console.log("   Code size:", code.length, "characters (", Math.floor((code.length - 2) / 2), "bytes)");
    
    // Function selectors
    const OLD_SELECTOR = "0x75fb2802"; // executeReaction((address,bytes)[])
    const NEW_SELECTOR = "0x0b059df9";  // executeReaction(address,(address,bytes)[])
    
    console.log("\n2️⃣  Function Selector Search:");
    console.log("   OLD selector:", OLD_SELECTOR);
    console.log("   NEW selector:", NEW_SELECTOR);
    
    const hasOld = code.toLowerCase().includes(OLD_SELECTOR.toLowerCase());
    const hasNew = code.toLowerCase().includes(NEW_SELECTOR.toLowerCase());
    
    console.log("   OLD found in bytecode:", hasOld ? "✅ Yes" : "❌ No");
    console.log("   NEW found in bytecode:", hasNew ? "✅ Yes" : "❌ No");
    
    // Try direct function calls
    console.log("\n3️⃣  Direct Function Call Tests:");
    
    // Test OLD signature
    const adapterOld = new ethers.Contract(
        ADAPTER_ADDRESS,
        ["function executeReaction(tuple(address fuse, bytes data)[] actions) external"],
        provider
    );
    
    const adapterNew = new ethers.Contract(
        ADAPTER_ADDRESS,
        ["function executeReaction(address rsc, tuple(address fuse, bytes data)[] actions) external"],
        provider
    );
    
    const emptyActions = [];
    
    console.log("\n   Testing OLD signature...");
    try {
        // Use estimateGas to check if function exists
        const gasEstimate = await adapterOld.estimateGas.executeReaction(emptyActions);
        console.log("   ✅ OLD signature accepted (gas estimate:", gasEstimate.toString(), ")");
    } catch (error) {
        const errorMsg = error.message.toLowerCase();
        if (errorMsg.includes("function") || errorMsg.includes("selector") || errorMsg.includes("data does not match")) {
            console.log("   ❌ OLD signature NOT found");
        } else {
            console.log("   ⚠️  OLD signature exists but call fails:", error.message.split('\n')[0].substring(0, 100));
        }
    }
    
    console.log("\n   Testing NEW signature...");
    try {
        const gasEstimate = await adapterNew.estimateGas.executeReaction(RSC_ADDRESS, emptyActions);
        console.log("   ✅ NEW signature accepted (gas estimate:", gasEstimate.toString(), ")");
    } catch (error) {
        const errorMsg = error.message.toLowerCase();
        if (errorMsg.includes("function") || errorMsg.includes("selector") || errorMsg.includes("data does not match")) {
            console.log("   ❌ NEW signature NOT found");
        } else {
            console.log("   ⚠️  NEW signature exists but call fails:", error.message.split('\n')[0].substring(0, 100));
        }
    }
    
    // Try to encode the exact payload that RSC would send
    console.log("\n4️⃣  Callback Payload Encoding Test:");
    
    try {
        // What RSC would emit (NEW signature)
        const functionSig = "executeReaction(address,(address,bytes)[])";
        const selector = ethers.utils.id(functionSig).slice(0, 10);
        
        // Encode parameters
        const rscAddr = RSC_ADDRESS;
        const actions = []; // Empty for test
        
        const encoded = ethers.utils.defaultAbiCoder.encode(
            ["address", "tuple(address,bytes)[]"],
            [rscAddr, actions]
        );
        
        const fullPayload = selector + encoded.slice(2);
        
        console.log("   Function signature:", functionSig);
        console.log("   Selector:", selector);
        console.log("   RSC address in payload:", rscAddr);
        console.log("   Actions count:", actions.length);
        console.log("   Full payload (first 100 chars):", fullPayload.substring(0, 100) + "...");
        
        // Try to call adapter directly with this payload
        console.log("\n   Attempting direct call with NEW signature payload...");
        try {
            const result = await provider.call({
                to: ADAPTER_ADDRESS,
                data: fullPayload
            });
            
            if (result === "0x") {
                console.log("   ⚠️  Call succeeded but returned empty data");
            } else {
                console.log("   ✅ Call succeeded, returned:", result.substring(0, 66));
            }
        } catch (error) {
            if (error.message.includes("execution reverted")) {
                console.log("   ⚠️  Call reverted (expected if adapter has OLD signature)");
                console.log("   Error:", error.message.split('\n')[0].substring(0, 100));
            } else {
                console.log("   ❌ Call failed:", error.message.split('\n')[0].substring(0, 100));
            }
        }
        
        // Try with OLD signature payload
        console.log("\n   Attempting direct call with OLD signature payload...");
        const oldFunctionSig = "executeReaction((address,bytes)[])";
        const oldSelector = ethers.utils.id(oldFunctionSig).slice(0, 10);
        const oldEncoded = ethers.utils.defaultAbiCoder.encode(
            ["tuple(address,bytes)[]"],
            [actions]
        );
        const oldPayload = oldSelector + oldEncoded.slice(2);
        
        try {
            const result = await provider.call({
                to: ADAPTER_ADDRESS,
                data: oldPayload
            });
            
            if (result === "0x") {
                console.log("   ⚠️  Call succeeded but returned empty data");
            } else {
                console.log("   ✅ Call succeeded, returned:", result.substring(0, 66));
            }
        } catch (error) {
            if (error.message.includes("execution reverted")) {
                console.log("   ⚠️  Call reverted (expected if adapter has NEW signature)");
                console.log("   Error:", error.message.split('\n')[0].substring(0, 100));
            } else {
                console.log("   ❌ Call failed:", error.message.split('\n')[0].substring(0, 100));
            }
        }
        
    } catch (error) {
        console.log("   ❌ Error encoding payload:", error.message.split('\n')[0]);
    }
    
    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("\n📋 CONCLUSION:");
    
    if (hasOld && !hasNew) {
        console.log("❌ Adapter has OLD signature - REDEPLOYMENT REQUIRED");
        console.log("   Current RSC will emit NEW signature callbacks");
        console.log("   These will FAIL on the old adapter");
    } else if (hasNew && !hasOld) {
        console.log("✅ Adapter has NEW signature - No redeployment needed!");
        console.log("   But RSC may need to be updated to use NEW signature");
    } else if (hasOld && hasNew) {
        console.log("⚠️  Both signatures found (unlikely) - Check manually");
    } else {
        console.log("⚠️  Cannot determine signature from bytecode");
        console.log("   Use gas estimation results above");
    }
    
    console.log("\n");
}

testAdapterSignaturePrecise().catch(console.error);

