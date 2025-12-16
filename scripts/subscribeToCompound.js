const { ethers } = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function subscribeToCompound() {
    const CONTRACT = process.env.RSC_ADDRESS || "0x02c904E571749c61bdd05e58FbF91F7921594186";
    const COMPOUND_USDC = "0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA";
    const ARBITRUM_CHAIN_ID = 42161;
    
    // Try AccrueInterest first (best for rate tracking)
    // If not found, try Supply/Withdraw events
    const ACCRUE_INTEREST = ethers.utils.id("AccrueInterest(uint256,uint256,uint256,uint256,uint256)");
    const SUPPLY = ethers.utils.id("Supply(address,address,uint256)");
    const WITHDRAW = ethers.utils.id("Withdraw(address,address,uint256)");
    
    // Use ACCRUE_INTEREST by default, but allow override
    const EVENT_TOPIC = process.env.COMPOUND_EVENT_TOPIC || ACCRUE_INTEREST;
    const EVENT_NAME = process.env.COMPOUND_EVENT_NAME || "AccrueInterest";
    
    const provider = new ethers.providers.JsonRpcProvider(
        process.env.REACTIVE_RPC || "https://mainnet-rpc.rnk.dev"
    );
    
    if (!process.env.REACTIVE_PRIVATE_KEY) {
        console.error("❌ REACTIVE_PRIVATE_KEY not set in .env");
        process.exit(1);
    }
    
    const signer = new ethers.Wallet(process.env.REACTIVE_PRIVATE_KEY, provider);
    
    const ABI = [
        "function subscribeTo(uint256 chainId, address contractAddress, uint256 topic0) external payable",
        "function owner() view returns (address)",
        "event Subscribed(uint256 chainId, address target, uint256 topic0)"
    ];
    
    const contract = new ethers.Contract(CONTRACT, ABI, signer);
    
    console.log("🔗 Subscribing to Compound V3 on Arbitrum...\n");
    console.log("RSC Contract:", CONTRACT);
    console.log("Target Chain:", ARBITRUM_CHAIN_ID);
    console.log("Target Contract:", COMPOUND_USDC);
    console.log("Event Name:", EVENT_NAME);
    console.log("Event Topic:", EVENT_TOPIC);
    
    // Verify you're the owner
    try {
        const owner = await contract.owner();
        console.log("\nContract Owner:", owner);
        console.log("Signer Address:", signer.address);
        
        if (owner.toLowerCase() !== signer.address.toLowerCase()) {
            console.error("\n❌ ERROR: You are not the owner!");
            process.exit(1);
        }
        console.log("✅ Owner verified");
    } catch (error) {
        console.error("❌ Error checking owner:", error.message);
        process.exit(1);
    }
    
    console.log("\n📤 Sending subscription transaction...");
    
    try {
        const tx = await contract.subscribeTo(
            ARBITRUM_CHAIN_ID,
            COMPOUND_USDC,
            EVENT_TOPIC,
            {
                gasLimit: 500000
            }
        );
        
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
        console.error("\n💡 Troubleshooting:");
        console.error("   1. Verify the event signature exists on Compound V3");
        console.error("   2. Run: node scripts/checkCompoundEvents.js");
        console.error("   3. Check Compound V3 documentation for correct event");
        process.exit(1);
    }
}

subscribeToCompound().catch(console.error);

