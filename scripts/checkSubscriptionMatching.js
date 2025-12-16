const { ethers } = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function checkSubscriptionMatching() {
    const ARBITRUM_RPC = process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc";
    const provider = new ethers.providers.JsonRpcProvider(ARBITRUM_RPC);
    
    const AAVE_POOL = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
    const USDC_ADDRESS = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"; // Arbitrum USDC
    const RESERVE_DATA_UPDATED = "0x804c9b842b2748a22bb64b345453a3de7ca54a6ca45ce00d415894979e22897a";
    
    console.log("=".repeat(60));
    console.log("🔍 CHECKING SUBSCRIPTION MATCHING");
    console.log("=".repeat(60));
    console.log("");
    
    console.log("Current Subscription:");
    console.log("  Chain ID: 42161 (Arbitrum)");
    console.log("  Contract: " + AAVE_POOL);
    console.log("  Topic0: " + RESERVE_DATA_UPDATED);
    console.log("  Topic1: REACTIVE_IGNORE (matches ANY reserve)");
    console.log("");
    
    console.log("Checking recent events with USDC filter...");
    console.log("-".repeat(60));
    
    try {
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = currentBlock - 1000;
        
        // Get events with USDC address in topic1
        const usdcTopic1 = ethers.utils.hexZeroPad(USDC_ADDRESS, 32);
        
        const usdcFilter = {
            address: AAVE_POOL,
            topics: [
                RESERVE_DATA_UPDATED,
                usdcTopic1  // Filter by USDC address
            ],
            fromBlock: fromBlock,
            toBlock: currentBlock
        };
        
        const usdcEvents = await provider.getLogs(usdcFilter);
        console.log(`\n   USDC-specific events: ${usdcEvents.length}`);
        
        // Get ALL ReserveDataUpdated events
        const allFilter = {
            address: AAVE_POOL,
            topics: [RESERVE_DATA_UPDATED],
            fromBlock: fromBlock,
            toBlock: currentBlock
        };
        
        const allEvents = await provider.getLogs(allFilter);
        console.log(`   Total ReserveDataUpdated events: ${allEvents.length}`);
        
        if (usdcEvents.length < allEvents.length) {
            console.log(`\n   💡 ISSUE IDENTIFIED:`);
            console.log(`   We subscribed with REACTIVE_IGNORE for topic1`);
            console.log(`   This means we subscribed to ALL reserves, not just USDC`);
            console.log(`   But only ${usdcEvents.length} events are for USDC`);
            console.log(`   Reactive Network might be filtering out non-USDC events`);
            console.log(`   OR Reactive Network might require specific filtering`);
            console.log("");
            console.log(`   🔧 SOLUTION:`);
            console.log(`   Resubscribe with topic1 = USDC address:`);
            console.log(`   ${usdcTopic1}`);
        }
        
        if (usdcEvents.length > 0) {
            console.log("\n   Recent USDC events:");
            const aaveInterface = new ethers.utils.Interface([
                "event ReserveDataUpdated(address indexed reserve, uint256 liquidityRate, uint256 stableBorrowRate, uint256 variableBorrowRate, uint256 liquidityIndex, uint256 variableBorrowIndex)"
            ]);
            
            usdcEvents.slice(-3).forEach((event, i) => {
                try {
                    const parsed = aaveInterface.parseLog(event);
                    console.log(`\n   ${i + 1}. Block ${event.blockNumber}`);
                    console.log(`      TX: ${event.transactionHash}`);
                    console.log(`      Reserve: ${parsed.args.reserve}`);
                    console.log(`      Liquidity Rate: ${parsed.args.liquidityRate.toString()}`);
                } catch (e) {
                    console.log(`\n   ${i + 1}. Block ${event.blockNumber}`);
                    console.log(`      TX: ${event.transactionHash}`);
                }
            });
        }
        
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
    }
    console.log("");
    
    console.log("=".repeat(60));
    console.log("💡 RECOMMENDATION");
    console.log("=".repeat(60));
    console.log("");
    console.log("Try resubscribing with USDC address filter in topic1:");
    console.log(`  cast send $RSC_ADDRESS "subscribeTo(uint256,address,uint256,uint256,uint256,uint256)" \\`);
    console.log(`    42161 \\`);
    console.log(`    ${AAVE_POOL} \\`);
    console.log(`    ${RESERVE_DATA_UPDATED} \\`);
    console.log(`    $(cast --to-uint256 ${USDC_ADDRESS}) \\`);
    console.log(`    0xa65f96fc951c35ead38878e0f0b7a3c744a6f5ccc1476b313353ce31712313ad \\`);
    console.log(`    0xa65f96fc951c35ead38878e0f0b7a3c744a6f5ccc1476b313353ce31712313ad \\`);
    console.log(`    0xa65f96fc951c35ead38878e0f0b7a3c744a6f5ccc1476b313353ce31712313ad`);
    console.log("");
}

checkSubscriptionMatching().catch(console.error);

