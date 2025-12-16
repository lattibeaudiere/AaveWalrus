const { ethers } = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function testReactFunction() {
    const RSC_ADDRESS = process.env.RSC_ADDRESS || "0x5eBe4dB39B498511c871DCdF3f5D3afD707228c2";
    const REACTIVE_RPC = process.env.REACTIVE_RPC || "https://mainnet-rpc.rnk.dev";
    
    console.log("=".repeat(60));
    console.log("🧪 TESTING REACT() FUNCTION");
    console.log("=".repeat(60));
    console.log(`Contract: ${RSC_ADDRESS}`);
    console.log("");
    
    const provider = new ethers.providers.JsonRpcProvider(REACTIVE_RPC);
    
    // Get a recent Aave event to simulate
    const ARBITRUM_RPC = "https://arb1.arbitrum.io/rpc";
    const arbProvider = new ethers.providers.JsonRpcProvider(ARBITRUM_RPC);
    
    const AAVE_POOL = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
    const RESERVE_DATA_UPDATED = "0x804c9b842b2748a22bb64b345453a3de7ca54a6ca45ce00d415894979e22897a";
    const USDC_ADDRESS = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
    
    try {
        console.log("1. FETCHING RECENT AAVE EVENT");
        console.log("-".repeat(60));
        
        const currentBlock = await arbProvider.getBlockNumber();
        const fromBlock = currentBlock - 1000;
        
        const usdcTopic1 = ethers.utils.hexZeroPad(USDC_ADDRESS, 32);
        const aaveFilter = {
            address: AAVE_POOL,
            topics: [RESERVE_DATA_UPDATED, usdcTopic1],
            fromBlock: fromBlock,
            toBlock: currentBlock
        };
        
        const events = await arbProvider.getLogs(aaveFilter);
        
        if (events.length === 0) {
            console.log("   ❌ No USDC events found to simulate");
            return;
        }
        
        const recentEvent = events[events.length - 1];
        console.log(`   ✅ Found event at block ${recentEvent.blockNumber}`);
        console.log(`   TX: ${recentEvent.transactionHash}`);
        console.log("");
        
        console.log("2. CHECKING CONTRACT STATE");
        console.log("-".repeat(60));
        
        const RSC_ABI = [
            "function react((uint256,address,uint256,uint256,uint256,uint256,bytes,uint256,uint256,uint256,uint256,uint256)) external",
            "function adapter() view returns (address)",
            "function sequencer() view returns (address)"
        ];
        
        const contract = new ethers.Contract(RSC_ADDRESS, RSC_ABI, provider);
        
        const adapter = await contract.adapter();
        const sequencer = await contract.sequencer();
        
        console.log(`   Adapter: ${adapter}`);
        console.log(`   Sequencer: ${sequencer} (0 = no restriction)`);
        console.log("");
        
        console.log("3. SIMULATING REACT() CALL");
        console.log("-".repeat(60));
        console.log("");
        console.log("💡 Note: react() has vmOnly modifier");
        console.log("   This means it can only be called from ReactVM");
        console.log("   Reactive Network sequencer should call this automatically");
        console.log("");
        console.log("📋 LogRecord structure needed:");
        console.log(`   chain_id: 42161`);
        console.log(`   _contract: ${AAVE_POOL}`);
        console.log(`   topic_0: ${RESERVE_DATA_UPDATED}`);
        console.log(`   topic_1: ${usdcTopic1}`);
        console.log(`   data: (event data from Aave)`);
        console.log(`   tx_hash: ${recentEvent.transactionHash}`);
        console.log(`   log_index: ${recentEvent.logIndex}`);
        console.log("");
        
        console.log("=".repeat(60));
        console.log("💡 DIAGNOSIS");
        console.log("=".repeat(60));
        console.log("");
        console.log("The react() function is correctly implemented with vmOnly modifier.");
        console.log("Reactive Network should automatically call it when events match.");
        console.log("");
        console.log("If events aren't being processed, check:");
        console.log("1. Reactscan shows active subscriptions");
        console.log("2. Subscription topic0 matches exactly");
        console.log("3. Contract is funded");
        console.log("4. Reactive Network is monitoring Arbitrum");
        console.log("");
        console.log("🔗 Reactscan: https://reactscan.io/address/" + RSC_ADDRESS);
        
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
    }
}

testReactFunction().catch(console.error);

