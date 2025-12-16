const { ethers } = require('ethers');

// Decode the Callback event payload
const payload = "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000004475fb28020000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";

// The function signature appears to be executeReaction with empty array
// Let's decode it
const iface = new ethers.utils.Interface([
    "function executeReaction((address,bytes)[]) external returns (bool,bytes)"
]);

try {
    // The payload starts with offset (0x20), then length, then data
    // Let's try to decode it directly
    const decoded = iface.decodeFunctionData("executeReaction", payload);
    console.log("Decoded payload:");
    console.log("  Actions:", decoded[0]);
    console.log("  Actions length:", decoded[0].length);
    
    if (decoded[0].length === 0) {
        console.log("  ✅ Empty actions array - this is the test/no-op implementation");
    }
} catch (e) {
    console.log("Decoding attempt:", e.message);
    
    // Try to extract manually
    console.log("\nRaw payload breakdown:");
    console.log("  Full payload:", payload);
    console.log("  Payload length:", payload.length);
    
    // The payload format is:
    // - First 32 bytes: offset to array (0x20)
    // - Next 32 bytes: array length
    // - Then array data
    
    if (payload.includes("75fb2802")) {
        console.log("\n✅ Function selector found: 75fb2802");
        console.log("   This matches executeReaction((address,bytes)[])");
    }
}

// Decode the ReactHandled event data
const reactHandledData = "0x000000000000000000000000000000000000000000000000000000000000a4b1000000000000000000000000794a61358d6845594f94dc1db02a252b5b4814adbec332aeea7b64143cbfe99e9af0ce5c1df32e5adb73ed22b50e0297777f2be60000000000000000000000000000000000000000000000000000000000000004";

const reactHandledIface = new ethers.utils.Interface([
    "event ReactHandled(uint256 chainId, address emitter, uint256 txHash, uint256 logIndex)"
]);

try {
    const decoded = reactHandledIface.decodeEventLog("ReactHandled", reactHandledData);
    console.log("\nReactHandled Event:");
    console.log("  Chain ID:", decoded.chainId.toString());
    console.log("  Emitter:", decoded.emitter);
    console.log("  TX Hash:", "0x" + decoded.txHash.toString(16));
    console.log("  Log Index:", decoded.logIndex.toString());
} catch (e) {
    console.log("Could not decode ReactHandled:", e.message);
}

// Decode the origin event data
console.log("\n" + "=".repeat(60));
console.log("ORIGIN EVENT (Aave V3 ReserveDataUpdated):");
console.log("=".repeat(60));
console.log("Contract: 0x794a61358D6845594F94dc1DB02A252b5b4814aD (Aave Pool)");
console.log("Topic 0: 0x804c9b842b2748a22bb64b345453a3de7ca54a6ca45ce00d415894979e22897a (ReserveDataUpdated)");
console.log("Topic 1: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831 (USDC address)");
console.log("\n✅ This is a USDC ReserveDataUpdated event from Aave V3!");
console.log("✅ Our subscription matched and triggered react()!");

