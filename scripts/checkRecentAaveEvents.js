const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

/**
 * Check recent Aave events and verify if they match our subscription
 */
async function checkEvents() {
    const ARBITRUM_RPC = process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc";
    const AAVE_POOL = '0x794a61358D6845594F94dc1DB02A252b5b4814aD';
    const USDC_ADDRESS = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
    const RESERVE_DATA_UPDATED = '0x804c9b842b2748a22bb64b345453a3de7ca54a6ca45ce00d415894979e22897a';
    
    const provider = new ethers.providers.JsonRpcProvider(ARBITRUM_RPC);
    
    console.log("Checking recent Aave events...");
    console.log("-".repeat(60));
    
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = currentBlock - 1000;
    
    // Check ALL ReserveDataUpdated events (no topic1 filter)
    const allEventsFilter = {
        address: AAVE_POOL,
        topics: [RESERVE_DATA_UPDATED],
        fromBlock: fromBlock,
        toBlock: currentBlock
    };
    
    const allEvents = await provider.getLogs(allEventsFilter);
    console.log(`Found ${allEvents.length} total ReserveDataUpdated events`);
    
    // Check events with USDC in topic1
    const usdcTopic1 = ethers.utils.hexZeroPad(USDC_ADDRESS, 32);
    const usdcEvents = allEvents.filter(log => 
        log.topics[1] && log.topics[1].toLowerCase() === usdcTopic1.toLowerCase()
    );
    
    console.log(`Found ${usdcEvents.length} events with USDC in topic1`);
    console.log("");
    
    if (usdcEvents.length > 0) {
        console.log("Recent USDC events:");
        for (let i = Math.max(0, usdcEvents.length - 5); i < usdcEvents.length; i++) {
            const event = usdcEvents[i];
            const block = await provider.getBlock(event.blockNumber);
            const timeAgo = Math.floor((Date.now() / 1000) - block.timestamp);
            console.log(`  ${i + 1}. Block ${event.blockNumber} (${timeAgo}s ago)`);
            console.log(`     TX: ${event.transactionHash}`);
        }
    }
    
    console.log("");
    console.log("📋 Subscription Check:");
    console.log("  Contract expects: topic0 = " + RESERVE_DATA_UPDATED);
    console.log("  Contract expects: topic1 = " + usdcTopic1);
    console.log("");
    
    if (usdcEvents.length === 0) {
        console.log("⚠️  No USDC events found in last 1000 blocks");
        console.log("   This might explain why RSC isn't processing");
    } else {
        console.log("✅ USDC events are being emitted");
        console.log("   RSC should process these events if subscription is active");
    }
}

checkEvents().catch(console.error);

