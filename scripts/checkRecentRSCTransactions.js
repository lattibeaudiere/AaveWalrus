const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

/**
 * Check recent RSC transactions to see what's happening
 */
async function checkRecentTransactions() {
    const REACTIVE_RPC = process.env.REACTIVE_RPC || "https://mainnet-rpc.rnk.dev";
    const RSC_ADDRESS = process.env.RSC_ADDRESS || "0xEFD20dC51F7c82B7430490Bf45767bA57F6819fc";
    
    const provider = new ethers.providers.JsonRpcProvider(REACTIVE_RPC);
    
    console.log("=".repeat(70));
    console.log("📊 RECENT RSC TRANSACTIONS");
    console.log("=".repeat(70));
    console.log("");
    
    // Get recent transactions to the RSC
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 1000);
    
    console.log(`Checking blocks ${fromBlock} to ${currentBlock}...`);
    console.log("");
    
    // Check for react() calls by looking at transaction to addresses
    // Actually, Reactive Network calls are internal, so we need to check events
    
    const rscABI = [
        "event Callback(uint256 indexed chain_id, address indexed _contract, uint64 indexed gas_limit, bytes payload)",
        "event StrategyUpdate(uint256 aaveApy, uint256 compoundApy, uint256 spread, bool rebalanced)",
        "event ReactHandled(uint256 chainId, address emitter, uint256 txHash, uint256 logIndex)"
    ];
    
    const rscInterface = new ethers.utils.Interface(rscABI);
    
    // Get all events from RSC
    const allEventsFilter = {
        address: RSC_ADDRESS,
        fromBlock: fromBlock,
        toBlock: 'latest'
    };
    
    const allEvents = await provider.getLogs(allEventsFilter);
    
    console.log(`Total Events: ${allEvents.length}`);
    console.log("");
    
    if (allEvents.length > 0) {
        console.log("Event Breakdown:");
        let callbacks = 0;
        let strategyUpdates = 0;
        let reactHandled = 0;
        
        for (const event of allEvents) {
            try {
                const parsed = rscInterface.parseLog(event);
                if (parsed.name === 'Callback') callbacks++;
                else if (parsed.name === 'StrategyUpdate') strategyUpdates++;
                else if (parsed.name === 'ReactHandled') reactHandled++;
            } catch (e) {
                // Unknown event
            }
        }
        
        console.log(`  Callback Events: ${callbacks}`);
        console.log(`  StrategyUpdate Events: ${strategyUpdates}`);
        console.log(`  ReactHandled Events: ${reactHandled}`);
        
        // Show latest Callback if any
        if (callbacks > 0) {
            console.log("");
            console.log("Latest Callback:");
            for (let i = allEvents.length - 1; i >= 0; i--) {
                try {
                    const parsed = rscInterface.parseLog(allEvents[i]);
                    if (parsed.name === 'Callback') {
                        const block = await provider.getBlock(allEvents[i].blockNumber);
                        console.log(`  Block: ${allEvents[i].blockNumber}`);
                        console.log(`  Time: ${new Date(block.timestamp * 1000).toISOString()}`);
                        console.log(`  Target: ${parsed.args._contract}`);
                        console.log(`  Chain: ${parsed.args.chain_id.toString()}`);
                        break;
                    }
                } catch (e) {}
            }
        }
    }
    
    console.log("");
}

checkRecentTransactions().catch(console.error);

