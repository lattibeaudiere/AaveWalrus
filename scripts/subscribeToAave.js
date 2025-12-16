const { ethers } = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function subscribeToAave() {
    const CONTRACT = process.env.RSC_ADDRESS || "0x02c904E571749c61bdd05e58FbF91F7921594186";
    const AAVE_POOL = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
    const ARBITRUM_CHAIN_ID = 42161;
    
    // ReserveDataUpdated event signature hash
    // CRITICAL: Correct topic that matches the contract
    const RESERVE_DATA_UPDATED = "0x804c9b842b2748a22bb64b345453a3de7ca54a6ca45ce00d415894979e22897a";
    
    const provider = new ethers.providers.JsonRpcProvider(
        process.env.REACTIVE_RPC || "https://mainnet-rpc.rnk.dev"
    );
    
    if (!process.env.REACTIVE_PRIVATE_KEY) {
        console.error("❌ REACTIVE_PRIVATE_KEY not set in .env");
        process.exit(1);
    }
    
    const signer = new ethers.Wallet(process.env.REACTIVE_PRIVATE_KEY, provider);
    
    const ABI = [
        "function subscribeToAave() external",
        "function subscribeTo(uint256 chainId, address contractAddress, uint256 topic0) external payable",
        "function owner() view returns (address)",
        "function aaveSubscribed() view returns (bool)",
        "event Subscribed(uint256 chainId, address target, uint256 topic0)"
    ];
    
    const contract = new ethers.Contract(CONTRACT, ABI, signer);
    
    console.log("🔗 Subscribing to Aave V3 ReserveDataUpdated event...\n");
    console.log("RSC Contract:", CONTRACT);
    console.log("Target Chain:", ARBITRUM_CHAIN_ID);
    console.log("Target Contract:", AAVE_POOL);
    console.log("Event Topic:", RESERVE_DATA_UPDATED);
    
    // Verify you're the owner
    try {
        const owner = await contract.owner();
        console.log("\nContract Owner:", owner);
        console.log("Signer Address:", signer.address);
        
        if (owner.toLowerCase() !== signer.address.toLowerCase()) {
            console.error("\n❌ ERROR: You are not the owner!");
            console.error("   Owner:", owner);
            console.error("   Signer:", signer.address);
            process.exit(1);
        }
        console.log("✅ Owner verified");
    } catch (error) {
        console.error("❌ Error checking owner:", error.message);
        process.exit(1);
    }
    
    console.log("\n📤 Sending subscription transaction...");
    
    try {
        // Use subscribeToAave() function which sets the state variable
        const tx = await contract.subscribeToAave({
            gasLimit: 500000
        });
        
        console.log("Transaction hash:", tx.hash);
        console.log("Waiting for confirmation...");
        
        const receipt = await tx.wait();
        
        if (receipt.status === 1) {
            console.log("\n✅ SUBSCRIPTION SUCCESSFUL!");
            console.log("Block:", receipt.blockNumber);
            console.log("Gas used:", receipt.gasUsed.toString());
            
            // Check for Subscribed event
            const events = receipt.logs.filter(log => {
                try {
                    const parsed = contract.interface.parseLog(log);
                    return parsed.name === 'Subscribed';
                } catch {
                    return false;
                }
            });
            
            if (events.length > 0) {
                const event = contract.interface.parseLog(events[0]);
                console.log("\n📋 Subscribed Event:");
                console.log("  Chain ID:", event.args.chainId.toString());
                console.log("  Target:", event.args.target);
                console.log("  Topic:", event.args.topic0.toString());
            }
        } else {
            console.error("\n❌ Subscription failed");
            process.exit(1);
        }
    } catch (error) {
        console.error("❌ Error subscribing:", error.message);
        if (error.data) {
            console.error("Error data:", error.data);
        }
        process.exit(1);
    }
}

subscribeToAave().catch(console.error);

