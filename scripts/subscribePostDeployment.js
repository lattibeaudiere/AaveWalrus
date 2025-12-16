const { ethers } = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function subscribePostDeployment() {
    // Contract address - update after deployment
    const CONTRACT = process.env.RSC_ADDRESS || "0x0000000000000000000000000000000000000000";
    
    if (CONTRACT === "0x0000000000000000000000000000000000000000") {
        console.error("❌ Error: RSC_ADDRESS not set in .env");
        console.error("   Please set RSC_ADDRESS to your deployed contract address");
        process.exit(1);
    }
    
    const REACTIVE_RPC = process.env.REACTIVE_RPC || "https://mainnet-rpc.rnk.dev";
    
    if (!process.env.REACTIVE_PRIVATE_KEY) {
        console.error("❌ REACTIVE_PRIVATE_KEY not set");
        process.exit(1);
    }
    
    const provider = new ethers.providers.JsonRpcProvider(REACTIVE_RPC);
    const signer = new ethers.Wallet(process.env.REACTIVE_PRIVATE_KEY, provider);
    
    console.log("🔗 Subscribing to Events (Post-Deployment)...\n");
    console.log("=".repeat(60));
    console.log("Contract:", CONTRACT);
    console.log("Signer:", signer.address);
    console.log("=".repeat(60));
    console.log("");
    
    const ABI = [
        "function owner() view returns (address)",
        "function subscribeToAave() external",
        "function subscribeToCompound() external",
        "function aaveSubscribed() view returns (bool)",
        "function compoundSubscribed() view returns (bool)",
        "event Subscribed(uint256 chainId, address target, uint256 topic0)"
    ];
    
    const contract = new ethers.Contract(CONTRACT, ABI, signer);
    
    // Verify owner
    try {
        const owner = await contract.owner();
        if (owner.toLowerCase() !== signer.address.toLowerCase()) {
            console.error("❌ Error: Signer is not the owner!");
            console.error("   Owner:", owner);
            console.error("   Signer:", signer.address);
            process.exit(1);
        }
        console.log("✅ Owner verified:", owner);
    } catch (error) {
        console.error("❌ Error verifying owner:", error.message);
        process.exit(1);
    }
    
    // Check current subscription status
    const aaveSubscribed = await contract.aaveSubscribed();
    const compoundSubscribed = await contract.compoundSubscribed();
    
    console.log("\n📊 Current Subscription Status:");
    console.log("  Aave V3:", aaveSubscribed ? "✅ Subscribed" : "❌ Not subscribed");
    console.log("  Compound V3:", compoundSubscribed ? "✅ Subscribed" : "❌ Not subscribed");
    console.log("");
    
    // Subscribe to Aave V3
    if (!aaveSubscribed) {
        console.log("=".repeat(60));
        console.log("STEP 1: Subscribing to Aave V3 ReserveDataUpdated...");
        console.log("=".repeat(60));
        
        try {
            const tx = await contract.subscribeToAave({
                gasLimit: 1000000
            });
            
            console.log("Transaction hash:", tx.hash);
            console.log("Waiting for confirmation...");
            
            const receipt = await tx.wait();
            
            if (receipt.status === 1) {
                console.log("✅ AAVE SUBSCRIPTION SUCCESSFUL!");
                console.log("   Block:", receipt.blockNumber);
                console.log("   Gas used:", receipt.gasUsed.toString());
                
                // Check for Subscribed event
                const iface = new ethers.utils.Interface(ABI);
                let eventFound = false;
                
                for (const log of receipt.logs) {
                    try {
                        const parsed = iface.parseLog(log);
                        if (parsed.name === 'Subscribed') {
                            console.log("\n📋 Subscribed Event Emitted:");
                            console.log("   Chain ID:", parsed.args.chainId.toString());
                            console.log("   Target:", parsed.args.target);
                            console.log("   Topic:", parsed.args.topic0.toString());
                            eventFound = true;
                        }
                    } catch (e) {
                        // Not our event
                    }
                }
                
                if (!eventFound) {
                    console.log("⚠️  Subscribed event not found in logs");
                }
            } else {
                console.error("❌ Aave subscription transaction failed");
            }
        } catch (error) {
            console.error("❌ Error subscribing to Aave:", error.message);
            if (error.reason) {
                console.error("   Reason:", error.reason);
            }
            process.exit(1);
        }
    } else {
        console.log("⏭️  Skipping Aave subscription (already subscribed)");
    }
    
    // Subscribe to Compound V3
    if (!compoundSubscribed) {
        console.log("\n" + "=".repeat(60));
        console.log("STEP 2: Subscribing to Compound V3 AccrueInterest...");
        console.log("=".repeat(60));
        
        try {
            const tx = await contract.subscribeToCompound({
                gasLimit: 1000000
            });
            
            console.log("Transaction hash:", tx.hash);
            console.log("Waiting for confirmation...");
            
            const receipt = await tx.wait();
            
            if (receipt.status === 1) {
                console.log("✅ COMPOUND SUBSCRIPTION SUCCESSFUL!");
                console.log("   Block:", receipt.blockNumber);
                console.log("   Gas used:", receipt.gasUsed.toString());
                
                // Check for Subscribed event
                const iface = new ethers.utils.Interface(ABI);
                let eventFound = false;
                
                for (const log of receipt.logs) {
                    try {
                        const parsed = iface.parseLog(log);
                        if (parsed.name === 'Subscribed') {
                            console.log("\n📋 Subscribed Event Emitted:");
                            console.log("   Chain ID:", parsed.args.chainId.toString());
                            console.log("   Target:", parsed.args.target);
                            console.log("   Topic:", parsed.args.topic0.toString());
                            eventFound = true;
                        }
                    } catch (e) {
                        // Not our event
                    }
                }
                
                if (!eventFound) {
                    console.log("⚠️  Subscribed event not found in logs");
                }
            } else {
                console.error("❌ Compound subscription transaction failed");
            }
        } catch (error) {
            console.error("❌ Error subscribing to Compound:", error.message);
            if (error.reason) {
                console.error("   Reason:", error.reason);
            }
            process.exit(1);
        }
    } else {
        console.log("⏭️  Skipping Compound subscription (already subscribed)");
    }
    
    // Final status
    console.log("\n" + "=".repeat(60));
    console.log("✅ SUBSCRIPTION COMPLETE!");
    console.log("=".repeat(60));
    console.log("");
    console.log("📊 Final Status:");
    const finalAave = await contract.aaveSubscribed();
    const finalCompound = await contract.compoundSubscribed();
    console.log("  Aave V3:", finalAave ? "✅ Subscribed" : "❌ Not subscribed");
    console.log("  Compound V3:", finalCompound ? "✅ Subscribed" : "❌ Not subscribed");
    console.log("");
    console.log("🔗 View on Reactscan:");
    console.log(`   https://reactscan.io/address/${CONTRACT}`);
    console.log("");
    console.log("💡 Next Steps:");
    console.log("1. Fund the contract with REACT (if not already funded)");
    console.log("2. Monitor for ReactHandled events");
    console.log("3. Wait for Aave V3 or Compound V3 events on Arbitrum");
    console.log("");
}

subscribePostDeployment().catch(console.error);

