const { ethers } = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function checkEventProcessing() {
    const RSC_ADDRESS = process.env.RSC_ADDRESS || "0x5eBe4dB39B498511c871DCdF3f5D3afD707228c2";
    const REACTIVE_RPC = process.env.REACTIVE_RPC || "https://mainnet-rpc.rnk.dev";
    const ARBITRUM_RPC = process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc";
    
    console.log("=".repeat(60));
    console.log("🔍 DIAGNOSING EVENT PROCESSING");
    console.log("=".repeat(60));
    console.log(`RSC Contract: ${RSC_ADDRESS}`);
    console.log("");
    
    const reactiveProvider = new ethers.providers.JsonRpcProvider(REACTIVE_RPC);
    const arbitrumProvider = new ethers.providers.JsonRpcProvider(ARBITRUM_RPC);
    
    // 1. Check subscription status
    console.log("1. CHECKING SUBSCRIPTION STATUS");
    console.log("-".repeat(60));
    const RSC_ABI = [
        "function aaveSubscribed() view returns (bool)",
        "function compoundSubscribed() view returns (bool)",
        "event ReactHandled(uint256 chainId, address emitter, uint256 txHash, uint256 logIndex)"
    ];
    
    const rscContract = new ethers.Contract(RSC_ADDRESS, RSC_ABI, reactiveProvider);
    
    try {
        const aaveSub = await rscContract.aaveSubscribed();
        const compoundSub = await rscContract.compoundSubscribed();
        console.log(`   Aave V3 Subscribed: ${aaveSub ? "✅ YES" : "❌ NO"}`);
        console.log(`   Compound V3 Subscribed: ${compoundSub ? "✅ YES" : "❌ NO"}`);
    } catch (error) {
        console.log(`   ❌ Error checking subscriptions: ${error.message}`);
    }
    console.log("");
    
    // 2. Check if our contract has been called (ReactHandled events)
    console.log("2. CHECKING IF CONTRACT HAS PROCESSED EVENTS");
    console.log("-".repeat(60));
    
    try {
        // Get recent ReactHandled events
        const currentBlock = await reactiveProvider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 10000); // Last ~10k blocks
        
        const filter = rscContract.filters.ReactHandled();
        const events = await rscContract.queryFilter(filter, fromBlock, currentBlock);
        
        if (events.length === 0) {
            console.log("   ❌ NO ReactHandled events found");
            console.log(`   Checked blocks: ${fromBlock} to ${currentBlock}`);
        } else {
            console.log(`   ✅ Found ${events.length} ReactHandled event(s)`);
            events.slice(0, 5).forEach((event, i) => {
                console.log(`\n   Event ${i + 1}:`);
                console.log(`     Block: ${event.blockNumber}`);
                console.log(`     Chain ID: ${event.args.chainId.toString()}`);
                console.log(`     Emitter: ${event.args.emitter}`);
                console.log(`     TX Hash: ${event.args.txHash}`);
            });
        }
    } catch (error) {
        console.log(`   ❌ Error checking events: ${error.message}`);
    }
    console.log("");
    
    // 3. Check recent events on Arbitrum (Aave V3)
    console.log("3. CHECKING RECENT AAVE V3 EVENTS ON ARBITRUM");
    console.log("-".repeat(60));
    
    const AAVE_POOL = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
    const RESERVE_DATA_UPDATED = "0xb2a02bf1a92354a66946e3533277a66dd13726c1695e5ac302d1c1fcb97d2200";
    
    try {
        const arbCurrentBlock = await arbitrumProvider.getBlockNumber();
        const arbFromBlock = Math.max(0, arbCurrentBlock - 1000); // Last 1000 blocks
        
        const aaveInterface = new ethers.utils.Interface([
            "event ReserveDataUpdated(address indexed reserve, uint256 liquidityRate, uint256 stableBorrowRate, uint256 variableBorrowRate, uint256 liquidityIndex, uint256 variableBorrowIndex)"
        ]);
        
        const aaveFilter = {
            address: AAVE_POOL,
            topics: [RESERVE_DATA_UPDATED]
        };
        
        const aaveEvents = await arbitrumProvider.getLogs({
            ...aaveFilter,
            fromBlock: arbFromBlock,
            toBlock: arbCurrentBlock
        });
        
        if (aaveEvents.length === 0) {
            console.log("   ⚠️  NO ReserveDataUpdated events found on Arbitrum");
            console.log(`   Checked blocks: ${arbFromBlock} to ${arbCurrentBlock}`);
            console.log("   💡 This could mean:");
            console.log("      - No recent activity on Aave V3 USDC market");
            console.log("      - Events filtered by topic1 (USDC address)");
        } else {
            console.log(`   ✅ Found ${aaveEvents.length} ReserveDataUpdated event(s) on Arbitrum`);
            console.log(`\n   Recent events:`);
            aaveEvents.slice(-5).forEach((event, i) => {
                const parsed = aaveInterface.parseLog(event);
                console.log(`\n   Event ${i + 1}:`);
                console.log(`     Block: ${event.blockNumber}`);
                console.log(`     TX Hash: ${event.transactionHash}`);
                console.log(`     Reserve: ${parsed.args.reserve}`);
                console.log(`     Liquidity Rate: ${parsed.args.liquidityRate.toString()}`);
            });
            console.log("\n   💡 These events should trigger our contract's react() function");
        }
    } catch (error) {
        console.log(`   ❌ Error checking Aave events: ${error.message}`);
    }
    console.log("");
    
    // 4. Check recent events on Arbitrum (Compound V3)
    console.log("4. CHECKING RECENT COMPOUND V3 EVENTS ON ARBITRUM");
    console.log("-".repeat(60));
    
    const COMPOUND_USDC = "0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA";
    const ACCRUE_INTEREST = "0x717fee053884ab1935ba6d0140f6ed225371439611d9674ff445419d6a0fa1b7";
    
    try {
        const arbFromBlock = Math.max(0, await arbitrumProvider.getBlockNumber() - 1000);
        const arbCurrentBlock = await arbitrumProvider.getBlockNumber();
        
        const compoundFilter = {
            address: COMPOUND_USDC,
            topics: [ACCRUE_INTEREST]
        };
        
        const compoundEvents = await arbitrumProvider.getLogs({
            ...compoundFilter,
            fromBlock: arbFromBlock,
            toBlock: arbCurrentBlock
        });
        
        if (compoundEvents.length === 0) {
            console.log("   ⚠️  NO AccrueInterest events found on Arbitrum");
            console.log(`   Checked blocks: ${arbFromBlock} to ${arbCurrentBlock}`);
            console.log("   💡 This could mean:");
            console.log("      - No recent activity on Compound V3 USDC market");
            console.log("      - Wrong event signature");
        } else {
            console.log(`   ✅ Found ${compoundEvents.length} AccrueInterest event(s) on Arbitrum`);
            console.log(`\n   Recent events:`);
            compoundEvents.slice(-5).forEach((event, i) => {
                console.log(`\n   Event ${i + 1}:`);
                console.log(`     Block: ${event.blockNumber}`);
                console.log(`     TX Hash: ${event.transactionHash}`);
            });
            console.log("\n   💡 These events should trigger our contract's react() function");
        }
    } catch (error) {
        console.log(`   ❌ Error checking Compound events: ${error.message}`);
    }
    console.log("");
    
    // 5. Check contract balance (needs REACT to execute)
    console.log("5. CHECKING CONTRACT FUNDING");
    console.log("-".repeat(60));
    
    try {
        const balance = await reactiveProvider.getBalance(RSC_ADDRESS);
        const balanceEth = ethers.utils.formatEther(balance);
        console.log(`   Contract Balance: ${balanceEth} REACT`);
        
        if (balance.eq(0)) {
            console.log("   ❌ Contract has NO balance - cannot execute reactions!");
            console.log("   💡 Fund the contract with REACT tokens");
        } else if (balance.lt(ethers.utils.parseEther("0.1"))) {
            console.log("   ⚠️  Low balance - may not have enough for execution");
        } else {
            console.log("   ✅ Sufficient balance for operations");
        }
    } catch (error) {
        console.log(`   ❌ Error checking balance: ${error.message}`);
    }
    console.log("");
    
    // 6. Check Reactscan (if we can query it)
    console.log("6. DIAGNOSIS SUMMARY");
    console.log("-".repeat(60));
    console.log("\n💡 Possible reasons events aren't being processed:");
    console.log("   1. No recent events on Arbitrum (check sections 3 & 4)");
    console.log("   2. Reactive Network hasn't detected the events yet");
    console.log("   3. Subscriptions might not be fully active (check Reactscan)");
    console.log("   4. Contract needs funding (check section 5)");
    console.log("   5. Event signatures might be wrong");
    console.log("\n🔗 Check Reactscan for subscription status:");
    console.log(`   https://reactscan.io/address/${RSC_ADDRESS}`);
    console.log("");
}

checkEventProcessing().catch(console.error);

