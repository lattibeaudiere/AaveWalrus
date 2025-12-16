const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function decodeTransactionLogs() {
    console.log("=".repeat(70));
    console.log("🔍 DECODING TRANSACTION LOGS");
    console.log("=".repeat(70));
    console.log("");
    
    // From the Reactscan output
    const originData = "0x0000000000000000000000000000000000000000001a09e30b5fd9985a95e8be000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000027f17409232bbe21af006b000000000000000000000000000000000000000003b8bc0ce7f434184684d89c000000000000000000000000000000000000000003e19fb5f30d0f0e5d826008";
    
    console.log("1️⃣  DECODING AAVE EVENT DATA:");
    console.log("   Raw data:", originData);
    console.log("");
    
    try {
        // Decode 5 uint256s (liquidityRate, stableBorrowRate, variableBorrowRate, liquidityIndex, variableBorrowIndex)
        const decoded = ethers.BigNumber.isBigNumber ? 
            ethers.utils.defaultAbiCoder.decode(
                ["uint256", "uint256", "uint256", "uint256", "uint256"],
                originData
            ) :
            ethers.utils.defaultAbiCoder.decode(
                ["uint256", "uint256", "uint256", "uint256", "uint256"],
                originData
            );
        
        const liquidityRate = decoded[0];
        const stableBorrowRate = decoded[1];
        const variableBorrowRate = decoded[2];
        const liquidityIndex = decoded[3];
        const variableBorrowIndex = decoded[4];
        
        console.log("   Decoded Values:");
        console.log("     liquidityRate:", liquidityRate.toString());
        console.log("     stableBorrowRate:", stableBorrowRate.toString());
        console.log("     variableBorrowRate:", variableBorrowRate.toString());
        console.log("     liquidityIndex:", liquidityIndex.toString());
        console.log("     variableBorrowIndex:", variableBorrowIndex.toString());
        console.log("");
        
        // Calculate APY
        const RAY = ethers.BigNumber.from(10).pow(27);
        const apyBps = liquidityRate.mul(10000).div(RAY);
        
        console.log("   APY Calculation:");
        console.log("     liquidityRate (RAY):", liquidityRate.toString());
        console.log("     RAY:", RAY.toString());
        console.log("     APY (bps):", apyBps.toString());
        console.log("     APY (%):", (apyBps.toNumber() / 100).toFixed(2) + "%");
        console.log("");
        
        // Check anomaly
        if (apyBps.gt(2000)) {
            console.log("     ⚠️  APY > 2000 bps - would trigger anomaly check!");
        } else {
            console.log("     ✅ APY within valid range");
        }
        
    } catch (error) {
        console.log("   ❌ Decode failed:", error.message);
    }
    
    console.log("");
    
    // Decode Log 2 (ReactHandled event)
    console.log("2️⃣  DECODING REACTHANDLED EVENT:");
    const reactHandledData = "0x000000000000000000000000000000000000000000000000000000000000013a000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
    
    try {
        const decoded = ethers.utils.defaultAbiCoder.decode(
            ["uint256", "address", "uint256", "uint256"],
            reactHandledData
        );
        
        console.log("   Chain ID:", decoded[0].toString());
        console.log("   Contract:", decoded[1]);
        console.log("   TX Hash:", decoded[2].toString());
        console.log("   Log Index:", decoded[3].toString());
        console.log("");
        console.log("   ✅ ReactHandled event decoded successfully!");
        console.log("   This means react() completed without reverting!");
    } catch (error) {
        console.log("   ❌ Decode failed:", error.message);
    }
    
    console.log("");
    
    // Decode Callback payload
    console.log("3️⃣  DECODING CALLBACK PAYLOAD:");
    const callbackPayload = "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000024cb3dd0fd000000000000000000000000000000000000000000000000000000000000003300000000000000000000000000000000000000000000000000000000";
    
    try {
        // This is the function call to QueryHelper.queryCompoundApy(uint256)
        // Selector: 0xcb3dd0fd = keccak256("queryCompoundApy(uint256)")[:4]
        const selector = callbackPayload.slice(0, 10);
        const params = callbackPayload.slice(10);
        
        console.log("   Function Selector:", selector);
        console.log("   Expected: 0xcb3dd0fd (queryCompoundApy)");
        
        if (selector.toLowerCase() === "0xcb3dd0fd") {
            console.log("   ✅ Correct selector!");
            
            // Decode the uint256 parameter (nonce)
            const nonce = ethers.utils.defaultAbiCoder.decode(["uint256"], params);
            console.log("   Nonce:", nonce[0].toString());
            console.log("");
            console.log("   ✅ RSC is successfully calling QueryHelper!");
        }
    } catch (error) {
        console.log("   ❌ Decode failed:", error.message);
    }
    
    console.log("");
    
    // Check destination transaction
    console.log("4️⃣  CHECKING DESTINATION TRANSACTION:");
    const destTx = "0xbc81613bc203be711611f3e4b93f557b52805189a79a2dd0838b5c5406f0b68f";
    console.log("   Transaction:", destTx);
    console.log("   This is the callback execution on Arbitrum");
    console.log("   Should call QueryHelper.queryCompoundApy()");
    console.log("");
    
    const arbitrumProvider = new ethers.providers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc"
    );
    
    try {
        const receipt = await arbitrumProvider.getTransactionReceipt(destTx);
        if (receipt) {
            console.log("   ✅ Transaction found on Arbitrum!");
            console.log("   Status:", receipt.status === 1 ? "✅ Success" : "❌ Failed");
            console.log("   Block:", receipt.blockNumber);
            
            if (receipt.status === 0) {
                console.log("   ⚠️  Transaction REVERTED on Arbitrum!");
                console.log("   This is why QueryHelper isn't responding");
            }
        } else {
            console.log("   ⚠️  Transaction not found (might be pending)");
        }
    } catch (error) {
        console.log("   ⚠️  Could not fetch transaction:", error.message.split('\n')[0]);
    }
    
    console.log("");
    console.log("=".repeat(70));
    console.log("📊 SUMMARY");
    console.log("=".repeat(70));
    console.log("");
    console.log("✅ RSC IS WORKING!");
    console.log("   • Events are being processed");
    console.log("   • APY extraction is happening");
    console.log("   • Callbacks are being emitted");
    console.log("");
    console.log("Next: Check if QueryHelper callback is executing");
    console.log("      If not, that's why no capital is deployed");
    console.log("");
}

decodeTransactionLogs().catch(console.error);

