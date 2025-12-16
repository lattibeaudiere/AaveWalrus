const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function checkEventTypes() {
    console.log("=".repeat(70));
    console.log("🔍 CHECKING WHAT EVENTS ARE BEING PROCESSED");
    console.log("=".repeat(70));
    console.log("");
    
    const RSC_ADDRESS = process.env.RSC_ADDRESS || "0x64030389Fb91D86F92314503aAe57827826c8F4e";
    const AAVE_POOL = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
    
    const reactiveProvider = new ethers.providers.JsonRpcProvider(
        process.env.REACTIVE_RPC || "https://mainnet-rpc.rnk.dev"
    );
    
    const arbitrumProvider = new ethers.providers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc"
    );
    
    // Check ReactHandled events to see what the RSC is processing
    console.log("1️⃣  Checking ReactHandled Events (what RSC processed):");
    try {
        const rsc = new ethers.Contract(
            RSC_ADDRESS,
            [
                "event ReactHandled(uint256 chainId, address contract_, uint256 txHash, uint256 logIndex)"
            ],
            reactiveProvider
        );
        
        const currentBlock = await reactiveProvider.getBlockNumber();
        const fromBlock = Math.max(currentBlock - 2000, 0);
        
        const events = await rsc.queryFilter(
            rsc.filters.ReactHandled(),
            fromBlock,
            currentBlock
        );
        
        console.log(`   Found ${events.length} ReactHandled events`);
        
        if (events.length > 0) {
            console.log("\n   Recent events processed:");
            const recent = events.slice(-10).reverse();
            
            for (let i = 0; i < recent.length; i++) {
                const event = recent[i];
                const block = await reactiveProvider.getBlock(event.blockNumber);
                const age = Math.floor((Date.now() / 1000 - block.timestamp) / 60);
                
                console.log(`\n   Event ${i + 1} (${age} min ago):`);
                console.log(`     Contract: ${event.args.contract_}`);
                console.log(`     Chain ID: ${event.args.chainId.toString()}`);
                console.log(`     TX Hash: ${event.args.txHash.toString()}`);
                
                // Check if it's Aave
                if (event.args.contract_.toLowerCase() === AAVE_POOL.toLowerCase()) {
                    console.log(`     ✅ Aave Pool event detected`);
                } else {
                    console.log(`     ⚠️  Not Aave Pool (${event.args.contract_})`);
                }
            }
        } else {
            console.log("   ⚠️  No ReactHandled events found");
        }
    } catch (error) {
        console.log("   ❌ Error:", error.message.split('\n')[0]);
    }
    
    console.log("");
    
    // Check if we can see actual Aave events on Arbitrum
    console.log("2️⃣  Checking Recent Aave Events on Arbitrum:");
    try {
        const RESERVE_DATA_UPDATED = ethers.utils.id("ReserveDataUpdated(address,uint256,uint256,uint256,uint256,uint256)");
        const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
        const USDC_TOPIC1 = ethers.utils.hexZeroPad(USDC, 32);
        
        const currentBlock = await arbitrumProvider.getBlockNumber();
        const fromBlock = Math.max(currentBlock - 5000, 0);
        
        const aaveEvents = await arbitrumProvider.getLogs({
            address: AAVE_POOL,
            topics: [
                RESERVE_DATA_UPDATED,
                USDC_TOPIC1 // Filter for USDC only
            ],
            fromBlock,
            toBlock: currentBlock
        });
        
        console.log(`   Found ${aaveEvents.length} recent Aave USDC events on Arbitrum`);
        
        if (aaveEvents.length > 0) {
            console.log("\n   ✅ Aave events are occurring");
            const recent = aaveEvents.slice(-3).reverse();
            for (let i = 0; i < recent.length; i++) {
                const log = recent[i];
                const block = await arbitrumProvider.getBlock(log.blockNumber);
                const age = Math.floor((Date.now() / 1000 - block.timestamp) / 60);
                
                console.log(`\n   Aave Event ${i + 1} (${age} min ago):`);
                console.log(`     Block: ${log.blockNumber}`);
                console.log(`     TX: ${log.transactionHash}`);
                
                // Try to decode
                try {
                    const decoded = ethers.utils.defaultAbiCoder.decode(
                        ["uint256", "uint256", "uint256", "uint256", "uint256"],
                        log.data
                    );
                    const liquidityRate = decoded[0];
                    console.log(`     Liquidity Rate: ${liquidityRate.toString()}`);
                    console.log(`     (This is in RAY format, ~${(Number(liquidityRate.toString()) / 1e25).toFixed(2)}% APY)`);
                } catch (e) {
                    console.log(`     ⚠️  Could not decode event data`);
                }
            }
        }
    } catch (error) {
        console.log("   ❌ Error:", error.message.split('\n')[0]);
    }
    
    console.log("");
    console.log("=".repeat(70));
    console.log("📊 DIAGNOSIS");
    console.log("=".repeat(70));
    console.log("");
    console.log("If ReactHandled shows Aave events but lastAaveApy = 0:");
    console.log("  → _extractAaveApy() is likely reverting or returning 0");
    console.log("");
    console.log("If ReactHandled shows NO Aave events:");
    console.log("  → Events not matching topic0 or contract filter");
    console.log("");
    console.log("Next: Check transaction traces on Reactive Network");
    console.log("      Look for revert reasons in _extractAaveApy");
    console.log("");
}

checkEventTypes().catch(console.error);

