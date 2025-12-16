const { ethers } = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

/**
 * Live Monitor - Real-time StrategyUpdate Event Monitoring
 * Polls StrategyUpdate events and displays updates in real-time
 */
class LiveMonitor {
    constructor() {
        this.REACTIVE_RPC = process.env.REACTIVE_RPC || "https://mainnet-rpc.rnk.dev";
        this.RSC_ADDRESS = process.env.RSC_ADDRESS;
        this.ARBITRUM_RPC = process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc";
        
        if (!this.RSC_ADDRESS) {
            throw new Error("RSC_ADDRESS must be set in .env");
        }
        
        this.provider = new ethers.providers.JsonRpcProvider(this.REACTIVE_RPC);
        this.arbitrumProvider = new ethers.providers.JsonRpcProvider(this.ARBITRUM_RPC);
        
        // StrategyUpdate event signature
        // event StrategyUpdate(uint256 aaveApy, uint256 compoundApy, uint256 spread, bool rebalanced);
        this.STRATEGY_UPDATE_TOPIC = ethers.utils.keccak256(
            ethers.utils.toUtf8Bytes("StrategyUpdate(uint256,uint256,uint256,bool)")
        );
        
        this.lastBlockChecked = null;
        this.eventCount = 0;
        this.rebalanceCount = 0;
    }
    
    async start() {
        console.log("=".repeat(60));
        console.log("🚀 LIVE MONITOR - YIELD OPTIMIZER");
        console.log("=".repeat(60));
        console.log(`\nMonitoring RSC: ${this.RSC_ADDRESS}`);
        console.log(`Network: Reactive Network (1597)`);
        console.log(`Started: ${new Date().toISOString()}\n`);
        console.log("Press Ctrl+C to stop\n");
        console.log("-".repeat(60));
        console.log("Waiting for events...\n");
        
        // Start polling
        await this.pollEvents();
        
        // Set up interval polling (every 15 seconds)
        setInterval(async () => {
            await this.pollEvents();
        }, 15000);
    }
    
    async pollEvents() {
        try {
            const currentBlock = await this.provider.getBlockNumber();
            
            if (!this.lastBlockChecked) {
                this.lastBlockChecked = currentBlock - 100; // Check last 100 blocks initially
            }
            
            // Get logs for StrategyUpdate events
            const filter = {
                address: this.RSC_ADDRESS,
                topics: [this.STRATEGY_UPDATE_TOPIC],
                fromBlock: this.lastBlockChecked + 1,
                toBlock: currentBlock
            };
            
            const logs = await this.provider.getLogs(filter);
            
            for (const log of logs) {
                await this.handleEvent(log);
            }
            
            this.lastBlockChecked = currentBlock;
            
        } catch (error) {
            if (error.message.includes('rate limit') || error.message.includes('timeout')) {
                // Silently handle rate limits
                return;
            }
            console.error(`\n⚠️  Polling error: ${error.message}`);
        }
    }
    
    async handleEvent(log) {
        try {
            // Decode event data
            const abi = [
                "event StrategyUpdate(uint256 aaveApy, uint256 compoundApy, uint256 spread, bool rebalanced)"
            ];
            const iface = new ethers.utils.Interface(abi);
            const decoded = iface.decodeEventLog("StrategyUpdate", log.data, log.topics);
            
            this.eventCount++;
            const aaveApy = decoded.aaveApy.toString() / 100;
            const compoundApy = decoded.compoundApy.toString() / 100;
            const spread = decoded.spread.toString() / 100;
            const rebalanced = decoded.rebalanced;
            
            if (rebalanced) {
                this.rebalanceCount++;
            }
            
            // Display event
            const timestamp = new Date().toISOString();
            console.log(`\n[${timestamp}] 📊 Strategy Update #${this.eventCount}`);
            console.log("─".repeat(60));
            console.log(`  Aave APY:    ${aaveApy.toFixed(2)}%`);
            console.log(`  Compound APY: ${compoundApy.toFixed(2)}%`);
            console.log(`  Spread:      ${spread.toFixed(2)}% (${(spread * 100).toFixed(0)} bps)`);
            console.log(`  Action:       ${rebalanced ? '🔄 REBALANCED' : '⏸️  NO REBALANCE'}`);
            
            if (rebalanced) {
                console.log(`\n  ✅ REBALANCE EXECUTED! (Total: ${this.rebalanceCount})`);
                console.log(`  🔗 View on Reactscan: https://reactscan.io/tx/${log.transactionHash}`);
            }
            
            console.log("");
            
        } catch (error) {
            console.error(`\n⚠️  Error decoding event: ${error.message}`);
        }
    }
    
    displayStats() {
        console.log("\n" + "=".repeat(60));
        console.log("📈 STATISTICS");
        console.log("=".repeat(60));
        console.log(`  Total Updates: ${this.eventCount}`);
        console.log(`  Rebalances: ${this.rebalanceCount}`);
        console.log(`  Uptime: ${((this.eventCount / (Date.now() / 1000 / 3600)) * 100).toFixed(2)}%`);
        console.log("=".repeat(60) + "\n");
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n🛑 Monitor stopped by user');
    process.exit(0);
});

// Start monitor
const monitor = new LiveMonitor();
monitor.start().catch(error => {
    console.error(`\n❌ Fatal error: ${error.message}`);
    process.exit(1);
});

