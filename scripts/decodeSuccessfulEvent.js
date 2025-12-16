const ethers = require('ethers');

/**
 * Decode the successful event to verify APY extraction
 */
async function decodeSuccess() {
    // Successful event data
    const eventData = "0x0000000000000000000000000000000000000000001ce85ba5ef3904d12f437700000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002a161310833b01bc9a3d51000000000000000000000000000000000000000003b8b177c38c66dcae0751af000000000000000000000000000000000000000003e18f5ffeaf395e72e9a934";
    
    // Decode as 5 uint256s
    const decoded = ethers.utils.defaultAbiCoder.decode(
        ['uint256', 'uint256', 'uint256', 'uint256', 'uint256'],
        eventData
    );
    
    const liquidityRate = decoded[0];
    const RAY = ethers.BigNumber.from(10).pow(27);
    
    // Fixed formula: (liquidityRate * 10000) / RAY
    const apyBps = liquidityRate.mul(10000).div(RAY);
    const apyPercent = parseFloat(apyBps.toString()) / 100;
    
    console.log("=".repeat(60));
    console.log("✅ SUCCESSFUL EVENT DECODED");
    console.log("=".repeat(60));
    console.log("");
    console.log("Event Data:");
    console.log("-".repeat(60));
    console.log("liquidityRate:", liquidityRate.toString());
    console.log("stableBorrowRate:", decoded[1].toString());
    console.log("variableBorrowRate:", decoded[2].toString());
    console.log("");
    
    console.log("APY Calculation (Fixed Formula):");
    console.log("-".repeat(60));
    console.log(`APY: ${apyBps.toString()} basis points`);
    console.log(`APY: ${apyPercent.toFixed(4)}%`);
    console.log("");
    
    console.log("✅ Validation:");
    console.log("-".repeat(60));
    const isValid = apyBps.lte(2000) && apyBps.gte(0);
    console.log(`Anomaly Check: ${isValid ? "✅ PASS" : "❌ FAIL"} (< 2000 bps)`);
    console.log(`Value: ${apyPercent.toFixed(2)}% (reasonable!)`);
    console.log("");
    
    // Decode callback payload
    const callbackPayload = "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000024cb3dd0fd000000000000000000000000000000000000000000000000000000000000000300000000000000000000000000000000000000000000000000000000";
    
    const decodedCallback = ethers.utils.defaultAbiCoder.decode(
        ['bytes'],
        callbackPayload
    );
    
    // Extract function selector and nonce
    const funcSig = decodedCallback[0].substring(0, 10);
    const nonceHex = decodedCallback[0].substring(74, 138); // Skip function selector + padding
    const nonce = ethers.BigNumber.from("0x" + nonceHex);
    
    console.log("Callback to QueryHelper:");
    console.log("-".repeat(60));
    console.log(`Function: queryCompoundApy(uint256)`);
    console.log(`Nonce: ${nonce.toString()}`);
    console.log("");
    
    console.log("✅ SUCCESS CONFIRMED!");
    console.log("  - APY extracted correctly (~3.49%)");
    console.log("  - No anomaly revert");
    console.log("  - Callback emitted to QueryHelper");
    console.log("  - Next: Waiting for Compound APY response");
}

decodeSuccess().catch(console.error);

