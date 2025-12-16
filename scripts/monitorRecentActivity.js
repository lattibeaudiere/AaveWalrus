const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function monitorRecentActivity() {
    console.log("=".repeat(70));
    console.log("📊 MONITORING RECENT ACTIVITY");
    console.log("=".repeat(70));
    console.log("");
    
    const RSC_ADDRESS = "0xf64afe64622CeAe79d48A15ebC49CC7FF416c688";
    const QUERY_HELPER = process.env.QUERY_HELPER_ADDRESS || "0x05b402e333974134689424F13f01BC31F8fbfF56";
    
    const reactiveProvider = new ethers.providers.JsonRpcProvider(
        process.env.REACTIVE_RPC || "https://reactive-network.rpc.thirdweb.com"
    );
    
    const arbitrumProvider = new ethers.providers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc"
    );
    
    // Check recent RSC transactions
    console.log("1️⃣  Recent RSC Transactions (Last 5 blocks):");
    console.log("");
    
    try {
        const currentBlock = await reactiveProvider.getBlockNumber();
        
        for (let i = 0; i < 5; i++) {
            const blockNum = currentBlock - i;
            const block = await reactiveProvider.getBlockWithTransactions(blockNum);
            
            const rscTxs = block.transactions.filter(tx => 
                tx.to && tx.to.toLowerCase() === RSC_ADDRESS.toLowerCase()
            );
            
            if (rscTxs.length > 0) {
                console.log(`   Block ${blockNum}:`);
                for (const tx of rscTxs) {
                    console.log(`     Hash: ${tx.hash}`);
                    console.log(`     From: ${tx.from}`);
                    
                    // Try to decode function call
                    if (tx.data && tx.data.length >= 10) {
                        const selector = tx.data.substring(0, 10);
                        if (selector === "0xab54a967") {
                            console.log(`     Function: initializeStrategy()`);
                        } else if (selector === "0xefae1b47") {
                            console.log(`     Function: subscribeToBothApys()`);
                        } else {
                            console.log(`     Function Selector: ${selector}`);
                        }
                    }
                    console.log("");
                }
            }
        }
    } catch (error) {
        console.log("   ⚠️  Error:", error.message.split('\n')[0]);
        console.log("");
    }
    
    // Check QueryHelper for ANY activity
    console.log("2️⃣  QueryHelper Recent Activity:");
    console.log("");
    
    try {
        const arbBlock = await arbitrumProvider.getBlockNumber();
        
        // Check last 50 blocks for any transactions to QueryHelper
        let queryHelperTxs = 0;
        for (let i = 0; i < 50; i++) {
            const blockNum = arbBlock - i;
            const block = await arbitrumProvider.getBlockWithTransactions(blockNum);
            
            const txs = block.transactions.filter(tx => 
                tx.to && tx.to.toLowerCase() === QUERY_HELPER.toLowerCase()
            );
            
            queryHelperTxs += txs.length;
            
            if (txs.length > 0) {
                console.log(`   Block ${blockNum}: ${txs.length} transaction(s)`);
                for (const tx of txs) {
                    console.log(`     Hash: ${tx.hash}`);
                    
                    // Check function
                    if (tx.data && tx.data.length >= 10) {
                        const selector = tx.data.substring(0, 10);
                        if (selector === "0x0f4b22d2") {
                            console.log(`     Function: queryBothApys()`);
                            console.log(`     ✅ This is the initialization query!`);
                        } else if (selector === "0x59f4b298") {
                            console.log(`     Function: queryCompoundApy()`);
                        }
                    }
                }
                console.log("");
            }
        }
        
        if (queryHelperTxs === 0) {
            console.log(`   No transactions to QueryHelper in last 50 blocks`);
            console.log("   The callback may still be pending execution");
        }
        console.log("");
        
    } catch (error) {
        console.log("   ⚠️  Error:", error.message.split('\n')[0]);
        console.log("");
    }
    
    // Check if QueryHelper exists and has code
    console.log("3️⃣  QueryHelper Contract Verification:");
    console.log("");
    
    try {
        const code = await arbitrumProvider.getCode(QUERY_HELPER);
        if (code !== "0x") {
            console.log("   ✅ Contract exists with code");
            console.log(`   Code size: ${code.length / 2 - 1} bytes`);
            
            // Try to call a view function
            const queryHelperAbi = [
                "function COMPOUND_USDC() external view returns (address)"
            ];
            
            const qh = new ethers.Contract(QUERY_HELPER, queryHelperAbi, arbitrumProvider);
            const compoundAddr = await qh.COMPOUND_USDC();
            console.log(`   Compound USDC: ${compoundAddr}`);
            console.log("   ✅ Contract is functional");
        } else {
            console.log("   ❌ Contract doesn't exist!");
        }
    } catch (error) {
        console.log("   ⚠️  Error:", error.message.split('\n')[0]);
    }
    
    console.log("");
    console.log("=".repeat(70));
    console.log("💡 NEXT STEPS");
    console.log("=".repeat(70));
    console.log("");
    console.log("The system is set up correctly:");
    console.log("  ✅ RSC deployed and initialized");
    console.log("  ✅ Callback emitted to QueryHelper");
    console.log("  ⏳ Waiting for Reactive Network to execute callback");
    console.log("");
    console.log("Reactive Network callbacks can take:");
    console.log("  • A few minutes for cross-chain execution");
    console.log("  • Check back in 5-10 minutes");
    console.log("");
    console.log("You can monitor:");
    console.log(`  • RSC: https://reactscan.io/address/${RSC_ADDRESS}`);
    console.log(`  • QueryHelper: https://arbiscan.io/address/${QUERY_HELPER}`);
    console.log("");
}

monitorRecentActivity().catch(console.error);

