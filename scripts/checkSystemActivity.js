const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

/**
 * Quick check of recent system activity
 */
async function checkActivity() {
    const REACTIVE_RPC = process.env.REACTIVE_RPC || "https://mainnet-rpc.rnk.dev";
    const ARBITRUM_RPC = process.env.ARBITRUM_RPC || process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc";
    const RSC_ADDRESS = process.env.RSC_ADDRESS || "0xEFD20dC51F7c82B7430490Bf45767bA57F6819fc";
    
    const reactiveProvider = new ethers.providers.JsonRpcProvider(REACTIVE_RPC);
    const arbitrumProvider = new ethers.providers.JsonRpcProvider(ARBITRUM_RPC);
    
    console.log("=".repeat(70));
    console.log("📊 RECENT SYSTEM ACTIVITY");
    console.log("=".repeat(70));
    console.log("");
    
    // Check recent ReactHandled events
    const rscABI = [
        "event ReactHandled(uint256 indexed chainId, address indexed contract, uint256 indexed txHash, uint256 logIndex)",
        "event StrategyUpdate(uint256 aaveApy, uint256 compoundApy, uint256 spread, bool rebalanced)",
        "event Callback(uint256 indexed chain_id, address indexed _contract, uint64 indexed gas_limit, bytes payload)"
    ];
    
    const rscInterface = new ethers.utils.Interface(rscABI);
    const currentBlock = await reactiveProvider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 1000);
    
    // Get ReactHandled events
    const reactFilter = {
        address: RSC_ADDRESS,
        topics: [ethers.utils.id("ReactHandled(uint256,address,uint256,uint256)")],
        fromBlock: fromBlock,
        toBlock: 'latest'
    };
    
    const reactEvents = await reactiveProvider.getLogs(reactFilter);
    
    console.log(`📈 Events Processed (last 1000 blocks): ${reactEvents.length}`);
    
    if (reactEvents.length > 0) {
        console.log("");
        console.log("Recent Activity:");
        for (let i = Math.max(0, reactEvents.length - 5); i < reactEvents.length; i++) {
            const event = reactEvents[i];
            const parsed = rscInterface.parseLog(event);
            const block = await reactiveProvider.getBlock(event.blockNumber);
            const timeAgo = Math.floor((Date.now() / 1000) - block.timestamp);
            
            console.log(`  ${i + 1}. Block ${event.blockNumber} (${timeAgo}s ago)`);
            console.log(`     Chain: ${parsed.args.chainId.toString()}`);
            console.log(`     Contract: ${parsed.args.contract}`);
        }
    }
    
    // Get StrategyUpdate events
    const strategyFilter = {
        address: RSC_ADDRESS,
        topics: [ethers.utils.id("StrategyUpdate(uint256,uint256,uint256,bool)")],
        fromBlock: fromBlock,
        toBlock: 'latest'
    };
    
    const strategyEvents = await reactiveProvider.getLogs(strategyFilter);
    
    console.log("");
    console.log(`📊 Strategy Updates: ${strategyEvents.length}`);
    
    if (strategyEvents.length > 0) {
        const latest = strategyEvents[strategyEvents.length - 1];
        const parsed = rscInterface.parseLog(latest);
        
        console.log("");
        console.log("Latest Strategy Update:");
        console.log(`  Aave APY: ${parsed.args.aaveApy.toNumber() / 100}% (${parsed.args.aaveApy.toString()} bps)`);
        console.log(`  Compound APY: ${parsed.args.compoundApy.toNumber() / 100}% (${parsed.args.compoundApy.toString()} bps)`);
        console.log(`  Spread: ${parsed.args.spread.toNumber() / 100}% (${parsed.args.spread.toString()} bps)`);
        console.log(`  Rebalanced: ${parsed.args.rebalanced ? '✅ Yes' : '❌ No'}`);
        
        if (parsed.args.spread.toNumber() > 30) {
            console.log(`  ⚠️  Spread ${parsed.args.spread.toString()} bps > 30 bps threshold`);
            if (!parsed.args.rebalanced) {
                console.log(`  ⚠️  No rebalance executed - check cooldown or other conditions`);
            }
        }
    }
    
    console.log("");
}

checkActivity().catch(console.error);

