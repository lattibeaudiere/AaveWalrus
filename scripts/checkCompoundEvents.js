const { ethers } = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function checkCompoundEvents() {
    const ARBITRUM_RPC = process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc";
    const REACTIVE_RPC = process.env.REACTIVE_RPC || "https://mainnet-rpc.rnk.dev";
    const RSC_ADDRESS = process.env.RSC_ADDRESS || "0xdC2eAcb778951d9dFB0050a0E3335C7Ab3E4CabE";
    
    console.log("=".repeat(60));
    console.log("🔍 CHECKING COMPOUND V3 EVENT SUBSCRIPTIONS & DATA");
    console.log("=".repeat(60));
    console.log("");
    
    const arbitrumProvider = new ethers.providers.JsonRpcProvider(ARBITRUM_RPC);
    const reactiveProvider = new ethers.providers.JsonRpcProvider(REACTIVE_RPC);
    
    const COMPOUND_USDC = "0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA";
    const ACCRUE_INTEREST = "0x717fee053884ab1935ba6d0140f6ed225371439611d9674ff445419d6a0fa1b7";
    
    // 1. Check if we're subscribed to Compound
    console.log("1. SUBSCRIPTION STATUS");
    console.log("-".repeat(60));
    
    const RSC_ABI = [
        "function compoundSubscribed() view returns (bool)",
        "event Subscribed(uint256 chainId, address target, uint256 topic0)",
        "event ReactHandled(uint256 chainId, address emitter, uint256 txHash, uint256 logIndex)"
    ];
    
    const rscContract = new ethers.Contract(RSC_ADDRESS, RSC_ABI, reactiveProvider);
    
    try {
        const subscribed = await rscContract.compoundSubscribed();
        console.log(`   Compound V3 Subscribed: ${subscribed ? "✅ YES" : "❌ NO"}`);
        
        if (!subscribed) {
            console.log("\n   ⚠️  Not subscribed to Compound events!");
            console.log("   Run: node scripts/subscribePostDeployment.js");
            return;
        }
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
    }
    console.log("");
    
    // 2. Check for recent Compound events on Arbitrum
    console.log("2. RECENT COMPOUND V3 EVENTS ON ARBITRUM");
    console.log("-".repeat(60));
    
    try {
        const currentBlock = await arbitrumProvider.getBlockNumber();
        const fromBlock = currentBlock - 5000;
        
        const compoundFilter = {
            address: COMPOUND_USDC,
            topics: [ACCRUE_INTEREST],
            fromBlock: fromBlock,
            toBlock: currentBlock
        };
        
        const compoundEvents = await arbitrumProvider.getLogs(compoundFilter);
        console.log(`   Found: ${compoundEvents.length} AccrueInterest events`);
        
        if (compoundEvents.length > 0) {
            console.log("\n   Recent Compound V3 events:");
            const compoundInterface = new ethers.utils.Interface([
                "event AccrueInterest(uint256 interestAccumulated, uint256 borrowIndex, uint256 totalBorrows)"
            ]);
            
            compoundEvents.slice(-3).forEach((event, i) => {
                try {
                    const parsed = compoundInterface.parseLog(event);
                    console.log(`\n   Event ${i + 1}:`);
                    console.log(`     Block: ${event.blockNumber}`);
                    console.log(`     TX: ${event.transactionHash}`);
                    console.log(`     Interest Accumulated: ${parsed.args.interestAccumulated.toString()}`);
                    console.log(`     Borrow Index: ${parsed.args.borrowIndex.toString()}`);
                    console.log(`     Total Borrows: ${parsed.args.totalBorrows.toString()}`);
                    console.log("");
                    console.log("     ⚠️  NOTE: This event does NOT directly contain APY!");
                    console.log("        Need to calculate APY from contract state or rate model");
                } catch (e) {
                    console.log(`\n   Event ${i + 1}:`);
                    console.log(`     Block: ${event.blockNumber}`);
                    console.log(`     TX: ${event.transactionHash}`);
                    console.log(`     Could not parse: ${e.message}`);
                }
            });
        } else {
            console.log("   ⚠️  No Compound AccrueInterest events found");
            console.log("   This means:");
            console.log("     - Either no activity on Compound V3 USDC market");
            console.log("     - Or we're subscribed to wrong event signature");
        }
        
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
    }
    console.log("");
    
    // 3. Check if any Compound events triggered react()
    console.log("3. PROCESSED COMPOUND EVENTS");
    console.log("-".repeat(60));
    
    try {
        const currentBlock = await reactiveProvider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 100000);
        
        const filter = rscContract.filters.ReactHandled();
        const events = await rscContract.queryFilter(filter, fromBlock, currentBlock);
        
        const compoundReactEvents = events.filter(e => {
            try {
                const emitter = e.args.emitter.toString().toLowerCase();
                return emitter === COMPOUND_USDC.toLowerCase();
            } catch {
                return false;
            }
        });
        
        console.log(`   Compound events processed: ${compoundReactEvents.length}`);
        
        if (compoundReactEvents.length > 0) {
            console.log("\n   Recent processed Compound events:");
            compoundReactEvents.slice(-3).forEach((event, i) => {
                console.log(`\n   ${i + 1}. Block ${event.blockNumber}`);
                console.log(`      TX: ${event.args.txHash.toString()}`);
                console.log(`      Emitter: ${event.args.emitter}`);
            });
        } else {
            console.log("   ⚠️  No Compound events have been processed yet");
            console.log("   Waiting for AccrueInterest events to trigger react()");
        }
        
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
    }
    console.log("");
    
    // 4. Compare Aave vs Compound event data
    console.log("4. AAVE vs COMPOUND EVENT DATA COMPARISON");
    console.log("-".repeat(60));
    console.log("");
    console.log("Aave V3 ReserveDataUpdated:");
    console.log("  ✅ Contains liquidityRate (supply APY)");
    console.log("  ✅ Contains variableBorrowRate (borrow APY)");
    console.log("  ✅ Direct APY information in event");
    console.log("");
    console.log("Compound V3 AccrueInterest:");
    console.log("  ⚠️  Contains interestAccumulated (not APY)");
    console.log("  ⚠️  Contains borrowIndex (cumulative index)");
    console.log("  ⚠️  Contains totalBorrows (current borrow amount)");
    console.log("  ❌ Does NOT contain direct APY");
    console.log("");
    console.log("💡 To get Compound APY, you need to:");
    console.log("  1. Call contract.getSupplyRate() or supplyRatePerSecond()");
    console.log("  2. Or calculate from utilization rate");
    console.log("  3. Event alone doesn't provide APY directly");
    console.log("");
    
    // 5. Recommendation
    console.log("=".repeat(60));
    console.log("💡 RECOMMENDATION");
    console.log("=".repeat(60));
    console.log("");
    console.log("For Compound V3 APY, you have options:");
    console.log("");
    console.log("Option 1: Call contract on Arbitrum (via Callback)");
    console.log("  - Emit Callback to query Compound contract");
    console.log("  - Get supplyRatePerSecond()");
    console.log("  - Calculate APY");
    console.log("");
    console.log("Option 2: Use different Compound event");
    console.log("  - Subscribe to Supply/Withdraw events");
    console.log("  - These might trigger more frequently");
    console.log("");
    console.log("Option 3: Always fetch Compound APY when Aave event fires");
    console.log("  - When Aave ReserveDataUpdated fires");
    console.log("  - Fetch both Aave (from event) and Compound (via call)");
    console.log("  - Compare and rebalance");
    console.log("");
}

checkCompoundEvents().catch(console.error);
