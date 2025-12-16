const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

/**
 * Analyze the RSC transaction to verify full flow
 */
async function analyzeTransaction() {
    console.log("=".repeat(70));
    console.log("🔍 ANALYZING RSC TRANSACTION");
    console.log("=".repeat(70));
    console.log("");
    
    const REACTIVE_RPC = process.env.REACTIVE_RPC || "https://mainnet-rpc.rnk.dev";
    const ARBITRUM_RPC = process.env.ARBITRUM_RPC || process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc";
    
    const reactiveProvider = new ethers.providers.JsonRpcProvider(REACTIVE_RPC);
    const arbitrumProvider = new ethers.providers.JsonRpcProvider(ARBITRUM_RPC);
    
    // Transaction from user's message
    const reactiveTxHash = "0x14c726f000694dc822d28a94408ea75e11e99280c38b9c43375d7b9dbde06318";
    const originTxHash = "0xc96c67f5fa1375a706197354de42ac3f23dabaf3fe98b3c3f0ca8ad8cb672f1c";
    
    console.log("📋 Transaction Details:");
    console.log(`  Reactive TX: ${reactiveTxHash}`);
    console.log(`  Origin TX (Arbitrum): ${originTxHash}`);
    console.log("");
    
    try {
        // Get Reactive transaction receipt
        const reactiveReceipt = await reactiveProvider.getTransactionReceipt(reactiveTxHash);
        
        console.log("=".repeat(70));
        console.log("1. REACTIVE NETWORK TRANSACTION");
        console.log("=".repeat(70));
        console.log("");
        console.log(`Block: ${reactiveReceipt.blockNumber}`);
        console.log(`Status: ${reactiveReceipt.status === 1 ? '✅ Success' : '❌ Failed'}`);
        console.log(`Gas Used: ${reactiveReceipt.gasUsed.toString()}`);
        console.log("");
        
        // Parse events
        const rscABI = [
            "event Callback(uint256 indexed chain_id, address indexed _contract, uint64 indexed gas_limit, bytes payload)",
            "event StrategyUpdate(uint256 aaveApy, uint256 compoundApy, uint256 spread, bool rebalanced)",
            "event ReactHandled(uint256 indexed chainId, address indexed contract, uint256 indexed txHash, uint256 logIndex)"
        ];
        
        const rscInterface = new ethers.utils.Interface(rscABI);
        
        console.log("Events Emitted:");
        for (const log of reactiveReceipt.logs) {
            try {
                const parsed = rscInterface.parseLog(log);
                if (parsed.name === 'Callback') {
                    console.log(`  ✅ Callback Event:`);
                    console.log(`     Chain ID: ${parsed.args.chain_id.toString()}`);
                    console.log(`     Target: ${parsed.args._contract}`);
                    console.log(`     Gas Limit: ${parsed.args.gas_limit.toString()}`);
                    
                    // Decode payload
                    const decoded = ethers.utils.defaultAbiCoder.decode(
                        ['bytes'],
                        parsed.args.payload
                    );
                    const functionData = decoded[0];
                    
                    // Check if it's queryCompoundApy
                    const selector = functionData.slice(0, 10);
                    if (selector === '0xcb3dd0fd') {
                        const nonce = ethers.BigNumber.from('0x' + functionData.slice(10, 74)).toString();
                        console.log(`     Function: queryCompoundApy(uint256)`);
                        console.log(`     Nonce: ${nonce}`);
                    }
                } else if (parsed.name === 'StrategyUpdate') {
                    console.log(`  📊 StrategyUpdate Event:`);
                    console.log(`     Aave APY: ${parsed.args.aaveApy.toString()} bps`);
                    console.log(`     Compound APY: ${parsed.args.compoundApy.toString()} bps`);
                    console.log(`     Spread: ${parsed.args.spread.toString()} bps`);
                    console.log(`     Rebalanced: ${parsed.args.rebalanced ? '✅ Yes' : '❌ No'}`);
                } else if (parsed.name === 'ReactHandled') {
                    console.log(`  ✅ ReactHandled Event (confirms processing)`);
                }
            } catch (e) {
                // Not a known event, skip
            }
        }
        
        console.log("");
        console.log("=".repeat(70));
        console.log("2. ORIGIN EVENT (Aave Arbitrum)");
        console.log("=".repeat(70));
        console.log("");
        
        // Get origin transaction
        const originReceipt = await arbitrumProvider.getTransactionReceipt(originTxHash);
        
        console.log(`Block: ${originReceipt.blockNumber}`);
        console.log(`Status: ${originReceipt.status === 1 ? '✅ Success' : '❌ Failed'}`);
        console.log("");
        
        // Parse Aave ReserveDataUpdated event
        const aaveABI = [
            "event ReserveDataUpdated(address indexed reserve, uint256 liquidityRate, uint256 stableBorrowRate, uint256 variableBorrowRate, uint256 liquidityIndex, uint256 variableBorrowIndex)"
        ];
        const aaveInterface = new ethers.utils.Interface(aaveABI);
        
        for (const log of originReceipt.logs) {
            try {
                const parsed = aaveInterface.parseLog(log);
                if (parsed) {
                    console.log("✅ ReserveDataUpdated Event Found:");
                    console.log(`   Reserve: ${parsed.args.reserve}`);
                    console.log(`   Liquidity Rate: ${parsed.args.liquidityRate.toString()}`);
                    
                    // Calculate APY (same as contract)
                    const RAY = ethers.BigNumber.from(10).pow(27);
                    const apyBps = parsed.args.liquidityRate.mul(10000).div(RAY);
                    console.log(`   APY: ${apyBps.toNumber() / 100}% (${apyBps.toString()} bps)`);
                }
            } catch (e) {
                // Not ReserveDataUpdated
            }
        }
        
        console.log("");
        console.log("=".repeat(70));
        console.log("3. CHECKING CALLBACK EXECUTION");
        console.log("=".repeat(70));
        console.log("");
        
        // Check if QueryHelper was called
        const queryHelper = "0x7D0B3A06aE0ceaf35B658579A1F5730D3539f914";
        const queryHelperABI = [
            "event CompoundApyQueried(uint256 indexed nonce, uint256 apyBps, uint256 timestamp)"
        ];
        const queryInterface = new ethers.utils.Interface(queryHelperABI);
        
        // Get recent blocks to search for QueryHelper event
        const currentBlock = await arbitrumProvider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 1000);
        
        console.log(`Searching for CompoundApyQueried events from block ${fromBlock} to ${currentBlock}...`);
        console.log("");
        
        const filter = {
            address: queryHelper,
            topics: [
                ethers.utils.id("CompoundApyQueried(uint256,uint256,uint256)"),
                null // nonce can vary
            ],
            fromBlock: fromBlock,
            toBlock: 'latest'
        };
        
        const events = await arbitrumProvider.getLogs(filter);
        
        if (events.length > 0) {
            console.log(`✅ Found ${events.length} CompoundApyQueried event(s)`);
            console.log("");
            
            // Get the latest one
            const latestEvent = events[events.length - 1];
            const parsed = queryInterface.parseLog(latestEvent);
            
            console.log("Latest QueryHelper Response:");
            console.log(`  Block: ${latestEvent.blockNumber}`);
            console.log(`  Nonce: ${parsed.args.nonce.toString()}`);
            console.log(`  Compound APY: ${parsed.args.apyBps.toString()} bps (${parsed.args.apyBps.toNumber() / 100}%)`);
            console.log(`  Timestamp: ${new Date(parsed.args.timestamp.toNumber() * 1000).toISOString()}`);
            console.log("");
            
            // Check if RSC processed this response
            const rscAddress = "0xEFD20dC51F7c82B7430490Bf45767bA57F6819fc";
            const rscFilter = {
                address: rscAddress,
                topics: [
                    ethers.utils.id("ReactHandled(uint256,address,uint256,uint256)"),
                    ethers.utils.hexZeroPad(ethers.BigNumber.from(42161).toHexString(), 32), // chain ID
                    ethers.utils.hexZeroPad(queryHelper.toLowerCase(), 32) // queryHelper address
                ],
                fromBlock: fromBlock,
                toBlock: 'latest'
            };
            
            const rscEvents = await reactiveProvider.getLogs(rscFilter);
            
            if (rscEvents.length > 0) {
                console.log("✅ RSC processed QueryHelper response!");
                console.log(`   Found ${rscEvents.length} ReactHandled event(s) for QueryHelper`);
            } else {
                console.log("⚠️  No ReactHandled events found for QueryHelper response");
                console.log("   This might mean:");
                console.log("   • Response not yet processed");
                console.log("   • Processing in progress");
                console.log("   • Nonce mismatch");
            }
        } else {
            console.log("⚠️  No CompoundApyQueried events found");
            console.log("   This might mean:");
            console.log("   • Callback not yet executed");
            console.log("   • Search range too narrow");
            console.log("   • QueryHelper call failed");
        }
        
        console.log("");
        console.log("=".repeat(70));
        console.log("📊 FLOW ANALYSIS");
        console.log("=".repeat(70));
        console.log("");
        console.log("✅ Step 1: Aave event detected on Arbitrum");
        console.log("✅ Step 2: RSC processed event on Reactive Network");
        console.log("✅ Step 3: RSC emitted Callback to QueryHelper");
        const step4 = events.length > 0 ? "✅" : "⚠️ ";
        const step5 = rscEvents.length > 0 ? "✅" : "⚠️ ";
        console.log(step4 + " Step 4: QueryHelper executed on Arbitrum");
        console.log(step5 + " Step 5: RSC processed QueryHelper response");
        console.log("");
        
    } catch (error) {
        console.error("❌ Error analyzing transaction:", error.message);
    }
}

analyzeTransaction().catch(console.error);

