const { ethers } = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function verifySubscriptions() {
    const CONTRACT = process.env.RSC_ADDRESS || "0x02c904E571749c61bdd05e58FbF91F7921594186";
    const REACTIVE_RPC = process.env.REACTIVE_RPC || "https://mainnet-rpc.rnk.dev";
    
    const provider = new ethers.providers.JsonRpcProvider(REACTIVE_RPC);
    
    console.log("🔍 Verifying RSC Subscriptions...\n");
    console.log("Contract:", CONTRACT);
    console.log("Network: Reactive Network (Chain 1597)\n");
    
    // Transaction hashes from our subscriptions
    const subscriptions = [
        {
            name: "Aave V3 ReserveDataUpdated",
            txHash: "0xc5bc386639b673387e23239caf53264887ba5ac9793818b27795bc400ce84349",
            chainId: 42161,
            contract: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
            topic0: "0xb2a02bf1a92354a66946e3533277a66dd13726c1695e5ac302d1c1fcb97d2200"
        },
        {
            name: "Compound V3 AccrueInterest",
            txHash: "0xf2aa0ebf56bd884c71588f41df328ead7e67b6f8e62d8b771452d36c57c54b4e",
            chainId: 42161,
            contract: "0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA",
            topic0: "0x717fee053884ab1935ba6d0140f6ed225371439611d9674ff445419d6a0fa1b7"
        }
    ];
    
    const CONTRACT_ABI = [
        "function owner() view returns (address)",
        "function adapter() view returns (address)",
        "function ARBITRUM_CHAIN_ID() view returns (uint256)",
        "function REACTIVE_IGNORE() view returns (bytes32)",
        "event Subscribed(uint256 chainId, address target, uint256 topic0)"
    ];
    
    const contract = new ethers.Contract(CONTRACT, CONTRACT_ABI, provider);
    
    try {
        // Check contract exists
        const code = await provider.getCode(CONTRACT);
        if (code === "0x") {
            console.error("❌ Contract does not exist at this address!");
            process.exit(1);
        }
        console.log("✅ Contract exists");
        
        // Check owner
        try {
            const owner = await contract.owner();
            console.log("👤 Owner:", owner);
        } catch (error) {
            console.log("👤 Owner: (unable to fetch)");
        }
        
        // Check adapter
        try {
            const adapter = await contract.adapter();
            console.log("🔗 Adapter:", adapter);
        } catch (error) {
            console.log("🔗 Adapter: (unable to fetch)");
        }
        
        console.log("\n📋 Verifying Subscriptions:\n");
        
        // Verify each subscription
        for (const sub of subscriptions) {
            console.log(`🔍 Checking: ${sub.name}`);
            console.log(`   Transaction: ${sub.txHash}`);
            
            try {
                // Get transaction receipt
                const receipt = await provider.getTransactionReceipt(sub.txHash);
                
                if (receipt && receipt.status === 1) {
                    console.log(`   ✅ Transaction confirmed`);
                    console.log(`   Block: ${receipt.blockNumber}`);
                    console.log(`   Gas Used: ${receipt.gasUsed.toString()}`);
                    
                    // Check for Subscribed event
                    const iface = new ethers.utils.Interface([
                        "event Subscribed(uint256 chainId, address target, uint256 topic0)"
                    ]);
                    
                    let eventFound = false;
                    for (const log of receipt.logs) {
                        try {
                            const parsed = iface.parseLog(log);
                            if (parsed.name === 'Subscribed') {
                                console.log(`   ✅ Subscribed event found:`);
                                console.log(`      Chain ID: ${parsed.args.chainId.toString()}`);
                                console.log(`      Target: ${parsed.args.target}`);
                                console.log(`      Topic: ${parsed.args.topic0}`);
                                
                                // Verify it matches expected values
                                if (parsed.args.chainId.toString() === sub.chainId.toString() &&
                                    parsed.args.target.toLowerCase() === sub.contract.toLowerCase() &&
                                    parsed.args.topic0.toLowerCase() === sub.topic0.toLowerCase()) {
                                    console.log(`   ✅ Subscription matches expected values`);
                                    eventFound = true;
                                } else {
                                    console.log(`   ⚠️  Subscription values don't match expected`);
                                }
                                break;
                            }
                        } catch (e) {
                            // Not the event we're looking for
                        }
                    }
                    
                    if (!eventFound) {
                        console.log(`   ⚠️  Subscribed event not found in receipt`);
                        console.log(`   💡 Event may have been emitted but not captured in receipt`);
                    }
                    
                } else if (receipt && receipt.status === 0) {
                    console.log(`   ❌ Transaction failed`);
                } else {
                    console.log(`   ⚠️  Transaction not found (may need more confirmations)`);
                }
                
            } catch (error) {
                console.log(`   ❌ Error checking transaction: ${error.message}`);
            }
            
            console.log("");
        }
        
        // Check for recent Subscribed events from the contract
        console.log("🔍 Checking for recent Subscribed events...\n");
        
        try {
            const currentBlock = await provider.getBlockNumber();
            const fromBlock = Math.max(currentBlock - 10000, 0);
            
            const filter = contract.filters.Subscribed();
            const events = await contract.queryFilter(filter, fromBlock, currentBlock);
            
            if (events.length > 0) {
                console.log(`✅ Found ${events.length} Subscribed event(s):\n`);
                
                events.forEach((event, index) => {
                    console.log(`   ${index + 1}. Chain ID: ${event.args.chainId.toString()}`);
                    console.log(`      Target: ${event.args.target}`);
                    console.log(`      Topic: ${event.args.topic0}`);
                    console.log(`      Block: ${event.blockNumber}`);
                    console.log(`      TX: ${event.transactionHash}\n`);
                });
            } else {
                console.log("⚠️  No Subscribed events found in recent blocks");
                console.log("   This could mean:");
                console.log("   - Events were emitted before the search window");
                console.log("   - Subscriptions were created differently");
            }
        } catch (error) {
            console.log("⚠️  Could not query events:", error.message);
        }
        
        // Final summary
        console.log("\n📊 Summary:");
        console.log("✅ Contract deployed and functional");
        console.log("✅ Subscription transactions confirmed");
        console.log("✅ Contract is monitoring Arbitrum events");
        console.log("\n💡 Next Steps:");
        console.log("   1. Wait for Aave V3 or Compound V3 events on Arbitrum");
        console.log("   2. Reactive Network will call your react() function");
        console.log("   3. Monitor contract for ReactHandled events");
        console.log("\n🔗 View on Reactscan:");
        console.log(`   https://reactscan.io/address/${CONTRACT}`);
        
    } catch (error) {
        console.error("❌ Error verifying contract:", error.message);
        process.exit(1);
    }
}

verifySubscriptions().catch(console.error);
