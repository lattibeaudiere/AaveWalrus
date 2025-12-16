const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function deepDebugCallback() {
    console.log("=".repeat(70));
    console.log("🔍 DEEP DEBUG - QUERYHELPER CALLBACK FAILURE");
    console.log("=".repeat(70));
    console.log("");
    
    const QUERY_HELPER = "0x05b402e333974134689424F13f01BC31F8fbfF56";
    const CALLBACK_TX = "0x6ff14601f09916bd45c9c6fbda17cad86ba7d9dbac15dc22b1f071a68fadf1b1";
    const COMPOUND_USDC = "0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA";
    
    const arbitrumProvider = new ethers.providers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc"
    );
    
    console.log("1️⃣  Checking QueryHelper Contract:");
    console.log("");
    
    // Check if contract exists and has code
    try {
        const code = await arbitrumProvider.getCode(QUERY_HELPER);
        if (code === "0x") {
            console.log("   ❌ QueryHelper contract doesn't exist!");
            return;
        }
        console.log(`   ✅ QueryHelper exists (${code.length / 2 - 1} bytes)`);
        console.log("");
    } catch (error) {
        console.log("   ❌ Error checking contract:", error.message);
        return;
    }
    
    console.log("2️⃣  Testing QueryHelper Functions Directly:");
    console.log("");
    
    const queryHelperAbi = [
        "function queryCompoundApy(uint256 nonce) external returns (uint256 apyBps)",
        "function queryBothApys(uint256 nonce) external returns (uint256 aaveApyBps, uint256 compoundApyBps)",
        "function getCompoundApy() external view returns (uint256 apyBps)",
        "function COMPOUND_USDC() external view returns (address)"
    ];
    
    try {
        const queryHelper = new ethers.Contract(QUERY_HELPER, queryHelperAbi, arbitrumProvider);
        
        // Test view function first (no state change)
        console.log("   Testing getCompoundApy() (view function)...");
        try {
            const apy = await queryHelper.getCompoundApy();
            console.log(`   ✅ View function works! APY: ${apy.toString()} bps`);
            console.log("");
        } catch (error) {
            console.log(`   ❌ View function failed: ${error.message}`);
            console.log("");
        }
        
        // Test state-changing function with a signer (if we have one)
        console.log("   Testing queryCompoundApy() (requires transaction)...");
        console.log("   (This needs a signer with ETH for gas)");
        console.log("");
        
        // Check Compound contract
        console.log("   Checking Compound contract...");
        try {
            const compoundCode = await arbitrumProvider.getCode(COMPOUND_USDC);
            if (compoundCode === "0x") {
                console.log("   ❌ Compound contract doesn't exist!");
            } else {
                console.log(`   ✅ Compound contract exists`);
                
                // Test calling Compound directly
                const compoundAbi = ["function supplyRatePerSecond() external view returns (uint256)"];
                const compound = new ethers.Contract(COMPOUND_USDC, compoundAbi, arbitrumProvider);
                try {
                    const rate = await compound.supplyRatePerSecond();
                    console.log(`   ✅ Compound.supplyRatePerSecond() works: ${rate.toString()}`);
                    console.log("");
                } catch (error) {
                    console.log(`   ❌ Compound call failed: ${error.message}`);
                    console.log("");
                }
            }
        } catch (error) {
            console.log(`   ⚠️  Error checking Compound: ${error.message}`);
            console.log("");
        }
        
    } catch (error) {
        console.log(`   ❌ Error creating contract interface: ${error.message}`);
        console.log("");
    }
    
    console.log("3️⃣  Analyzing Failed Transaction:");
    console.log("");
    
    try {
        const receipt = await arbitrumProvider.getTransactionReceipt(CALLBACK_TX);
        
        if (!receipt) {
            console.log("   ⚠️  Transaction receipt not found");
            return;
        }
        
        console.log(`   Status: ${receipt.status === 1 ? "✅ Success" : "❌ Failed"}`);
        console.log(`   Block: ${receipt.blockNumber}`);
        console.log(`   Gas Used: ${receipt.gasUsed.toString()}`);
        console.log(`   Gas Limit: ${receipt.gasLimit ? receipt.gasLimit.toString() : "N/A"}`);
        console.log("");
        
        // Get the transaction to see what was called
        const tx = await arbitrumProvider.getTransaction(CALLBACK_TX);
        console.log("   Transaction Details:");
        console.log(`   From: ${tx.from}`);
        console.log(`   To: ${tx.to}`);
        console.log(`   Value: ${ethers.utils.formatEther(tx.value)} ETH`);
        console.log(`   Gas Price: ${tx.gasPrice ? tx.gasPrice.toString() : "N/A"}`);
        console.log("");
        
        // Decode the transaction data
        console.log("   Transaction Data Analysis:");
        console.log(`   Data length: ${tx.data.length} bytes`);
        console.log(`   Data: ${tx.data}`);
        console.log("");
        
        // Try to see if this is a call to QueryHelper
        if (tx.to && tx.to.toLowerCase() !== QUERY_HELPER.toLowerCase()) {
            console.log(`   ⚠️  Transaction is NOT to QueryHelper!`);
            console.log(`   Target: ${tx.to}`);
            console.log(`   Expected: ${QUERY_HELPER}`);
            console.log("");
            console.log("   💡 This is likely a Reactive Network relayer contract");
            console.log("   The relayer should then call QueryHelper");
            console.log("");
        }
        
        // Check internal transactions (if available)
        console.log("   Checking for internal transactions...");
        try {
            // Some RPCs support trace
            const trace = await arbitrumProvider.send("trace_transaction", [CALLBACK_TX]);
            if (trace && trace.length > 0) {
                console.log(`   Found ${trace.length} internal transactions`);
                for (let i = 0; i < trace.length; i++) {
                    const call = trace[i];
                    if (call.to && call.to.toLowerCase() === QUERY_HELPER.toLowerCase()) {
                        console.log(`   ✅ Found call to QueryHelper!`);
                        if (call.error) {
                            console.log(`   ❌ Call failed: ${call.error}`);
                        }
                    }
                }
            }
        } catch (error) {
            console.log("   ⚠️  Could not get trace (RPC may not support it)");
        }
        console.log("");
        
    } catch (error) {
        console.log(`   ❌ Error analyzing transaction: ${error.message}`);
        console.log("");
    }
    
    console.log("4️⃣  Checking Reactive Network Callback Mechanism:");
    console.log("");
    
    // Check the callback payload from the RSC
    console.log("   From the RSC transaction, the callback payload was:");
    console.log("   Function: queryCompoundApy(uint256)");
    console.log("   Nonce: 171 (0xab)");
    console.log("");
    console.log("   The Reactive Network should:");
    console.log("   1. Receive the Callback event");
    console.log("   2. Execute transaction on Arbitrum");
    console.log("   3. Call QueryHelper.queryCompoundApy(171)");
    console.log("   4. QueryHelper should emit CompoundApyQueried event");
    console.log("");
    console.log("   ⚠️  Step 3 is failing - the call to QueryHelper is reverting");
    console.log("");
    
    console.log("5️⃣  Possible Issues:");
    console.log("");
    console.log("   A. QueryHelper.queryCompoundApy() has a bug");
    console.log("   B. Compound contract call is failing");
    console.log("   C. Gas limit is too low");
    console.log("   D. Reactive Network relayer has permission issues");
    console.log("   E. Function selector mismatch");
    console.log("");
    
    console.log("=".repeat(70));
    console.log("📊 DIAGNOSIS SUMMARY");
    console.log("=".repeat(70));
    console.log("");
    console.log("Next steps:");
    console.log("  1. Check Arbiscan for detailed revert reason");
    console.log("  2. Test QueryHelper.queryCompoundApy() with a direct transaction");
    console.log("  3. Verify Reactive Network callback mechanism");
    console.log("  4. Check if there's a gas limit issue");
    console.log("");
    console.log(`🔗 Transaction: https://arbiscan.io/tx/${CALLBACK_TX}`);
    console.log(`🔗 QueryHelper: https://arbiscan.io/address/${QUERY_HELPER}`);
    console.log("");
}

deepDebugCallback().catch(console.error);

