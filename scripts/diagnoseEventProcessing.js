const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

/**
 * Comprehensive Event Processing Diagnosis
 */
async function diagnose() {
    console.log("=".repeat(60));
    console.log("🔍 EVENT PROCESSING DIAGNOSIS");
    console.log("=".repeat(60));
    console.log("");
    
    const REACTIVE_RPC = process.env.REACTIVE_RPC || "https://mainnet-rpc.rnk.dev";
    const ARBITRUM_RPC = process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc";
    const RSC_ADDRESS = process.env.RSC_ADDRESS;
    const QUERY_HELPER_ADDRESS = process.env.QUERY_HELPER_ADDRESS;
    
    if (!RSC_ADDRESS) {
        console.log("❌ RSC_ADDRESS not set in .env");
        return;
    }
    
    const reactiveProvider = new ethers.providers.JsonRpcProvider(REACTIVE_RPC);
    const arbitrumProvider = new ethers.providers.JsonRpcProvider(ARBITRUM_RPC);
    
    console.log("1️⃣  Checking RSC Funding Status...");
    console.log("-".repeat(60));
    
    try {
        const rscBalance = await reactiveProvider.getBalance(RSC_ADDRESS);
        const balanceEth = ethers.utils.formatEther(rscBalance);
        console.log(`   Balance: ${balanceEth} REACT`);
        
        if (parseFloat(balanceEth) < 0.001) {
            console.log("   ⚠️  LOW BALANCE - May need more funding");
        } else {
            console.log("   ✅ Balance sufficient");
        }
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
    }
    
    console.log("");
    console.log("2️⃣  Checking Recent Aave Events on Arbitrum...");
    console.log("-".repeat(60));
    
    const AAVE_POOL = '0x794a61358D6845594F94dc1DB02A252b5b4814aD';
    const USDC_ADDRESS = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
    const RESERVE_DATA_UPDATED = '0x804c9b842b2748a22bb64b345453a3de7ca54a6ca45ce00d415894979e22897a';
    
    try {
        const currentBlock = await arbitrumProvider.getBlockNumber();
        const fromBlock = currentBlock - 1000; // Check last 1000 blocks
        
        console.log(`   Current Block: ${currentBlock}`);
        console.log(`   Checking blocks ${fromBlock} to ${currentBlock}...`);
        
        const filter = {
            address: AAVE_POOL,
            topics: [
                RESERVE_DATA_UPDATED,
                ethers.utils.hexZeroPad(USDC_ADDRESS, 32) // USDC in topic1
            ],
            fromBlock: fromBlock,
            toBlock: currentBlock
        };
        
        const logs = await arbitrumProvider.getLogs(filter);
        console.log(`   Found ${logs.length} Aave ReserveDataUpdated events for USDC`);
        
        if (logs.length > 0) {
            const latest = logs[logs.length - 1];
            const block = await arbitrumProvider.getBlock(latest.blockNumber);
            const timeAgo = Math.floor((Date.now() / 1000) - block.timestamp);
            console.log(`   ✅ Latest event: Block ${latest.blockNumber}, ${timeAgo}s ago`);
            console.log(`   Transaction: ${latest.transactionHash}`);
        } else {
            console.log("   ⚠️  No recent Aave events found for USDC");
        }
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
    }
    
    console.log("");
    console.log("3️⃣  Checking ReactHandled Events on Reactive Network...");
    console.log("-".repeat(60));
    
    try {
        const currentBlock = await reactiveProvider.getBlockNumber();
        const fromBlock = currentBlock - 5000; // Check last 5000 blocks
        
        // ReactHandled event signature
        const REACT_HANDLED_TOPIC = ethers.utils.keccak256(
            ethers.utils.toUtf8Bytes("ReactHandled(uint256,address,uint256,uint256)")
        );
        
        const filter = {
            address: RSC_ADDRESS,
            topics: [REACT_HANDLED_TOPIC],
            fromBlock: fromBlock,
            toBlock: currentBlock
        };
        
        const logs = await reactiveProvider.getLogs(filter);
        console.log(`   Found ${logs.length} ReactHandled events`);
        
        if (logs.length > 0) {
            console.log("   ✅ RSC IS PROCESSING EVENTS!");
            const latest = logs[logs.length - 1];
            const block = await reactiveProvider.getBlock(latest.blockNumber);
            const timeAgo = Math.floor((Date.now() / 1000) - block.timestamp);
            console.log(`   Latest: Block ${latest.blockNumber}, ${timeAgo}s ago`);
        } else {
            console.log("   ❌ NO ReactHandled events found - RSC not processing");
        }
    } catch (error) {
        console.log(`   ⚠️  Could not check ReactHandled: ${error.message}`);
    }
    
    console.log("");
    console.log("4️⃣  Checking StrategyUpdate Events...");
    console.log("-".repeat(60));
    
    try {
        const STRATEGY_UPDATE_TOPIC = ethers.utils.keccak256(
            ethers.utils.toUtf8Bytes("StrategyUpdate(uint256,uint256,uint256,bool)")
        );
        
        const currentBlock = await reactiveProvider.getBlockNumber();
        const filter = {
            address: RSC_ADDRESS,
            topics: [STRATEGY_UPDATE_TOPIC],
            fromBlock: currentBlock - 5000,
            toBlock: currentBlock
        };
        
        const logs = await reactiveProvider.getLogs(filter);
        console.log(`   Found ${logs.length} StrategyUpdate events`);
        
        if (logs.length > 0) {
            const latest = logs[logs.length - 1];
            console.log(`   ✅ Strategy updates detected!`);
        } else {
            console.log("   ⚠️  No StrategyUpdate events yet");
        }
    } catch (error) {
        console.log(`   ⚠️  Error: ${error.message}`);
    }
    
    console.log("");
    console.log("5️⃣  Verifying Subscription Status (Checking Contract State)...");
    console.log("-".repeat(60));
    
    // RSC ABI for checking subscription state
    const rscABI = [
        "function aaveSubscribed() external view returns (bool)",
        "function queryHelperSubscribed() external view returns (bool)",
        "function compoundSubscribed() external view returns (bool)"
    ];
    
    try {
        const rsc = new ethers.Contract(RSC_ADDRESS, rscABI, reactiveProvider);
        
        const aaveSub = await rsc.aaveSubscribed();
        const querySub = await rsc.queryHelperSubscribed();
        const compoundSub = await rsc.compoundSubscribed();
        
        console.log(`   Aave Subscribed: ${aaveSub ? "✅ Yes" : "❌ No"}`);
        console.log(`   QueryHelper Subscribed: ${querySub ? "✅ Yes" : "❌ No"}`);
        console.log(`   Compound Subscribed: ${compoundSub ? "✅ Yes" : "❌ No"}`);
        
        if (!aaveSub || !querySub) {
            console.log("   ⚠️  CRITICAL: Missing subscriptions!");
            console.log("   → Run: node scripts/subscribeToAave.js");
            console.log("   → Run: node scripts/subscribeToQueryHelper.js");
        }
    } catch (error) {
        console.log(`   ⚠️  Could not check subscription state: ${error.message}`);
    }
    
    console.log("");
    console.log("=".repeat(60));
    console.log("📋 DIAGNOSIS SUMMARY");
    console.log("=".repeat(60));
    console.log("");
    console.log("Common Issues & Solutions:");
    console.log("");
    console.log("1. No ReactHandled events:");
    console.log("   → Check if RSC has sufficient REACT balance");
    console.log("   → Verify subscriptions are active");
    console.log("   → Check if Aave events are actually being emitted");
    console.log("");
    console.log("2. Subscriptions not active:");
    console.log("   → Re-subscribe: node scripts/subscribeToAave.js");
    console.log("   → Re-subscribe: node scripts/subscribeToQueryHelper.js");
    console.log("");
    console.log("3. No Aave events:");
    console.log("   → Aave events may be infrequent");
    console.log("   → Check Arbiscan manually for recent activity");
    console.log("");
    console.log("4. RSC not funded:");
    console.log("   → Fund RSC: node scripts/fundAndCoverDebt.js");
    console.log("");
}

diagnose().catch(console.error);

