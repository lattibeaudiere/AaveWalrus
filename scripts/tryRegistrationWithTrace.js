const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function tryRegistration() {
    const ADAPTER_ADDRESS = process.env.ADAPTER_ADDRESS;
    const RSC_ADDRESS = process.env.RSC_ADDRESS || "0xe39c19A077e33d1145F8Cc78d4235aE8114C640a";
    const TARGET_VAULT = process.env.TARGET_VAULT;
    const ARBITRUM_CHAIN_ID = process.env.ARBITRUM_CHAIN_ID || "42161";
    
    const provider = new ethers.providers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc"
    );
    
    const wallet = new ethers.Wallet(
        process.env.PRIVATE_KEY || process.env.ARBITRUM_PRIVATE_KEY,
        provider
    );
    
    const adapter = new ethers.Contract(
        ADAPTER_ADDRESS,
        [
            "function registerCrossChainRSC(address rsc, address vault, uint256 targetChainId) external",
            "function isRSCRegistered(address rsc) external view returns (bool)"
        ],
        wallet
    );
    
    console.log("Attempting registration...");
    console.log("RSC:", RSC_ADDRESS);
    console.log("Vault:", TARGET_VAULT);
    console.log("Chain ID:", ARBITRUM_CHAIN_ID);
    console.log("");
    
    // Check if already registered
    const already = await adapter.isRSCRegistered(RSC_ADDRESS);
    if (already) {
        console.log("✅ Already registered!");
        return;
    }
    
    // Try with very high gas limit
    try {
        const tx = await adapter.registerCrossChainRSC(
            RSC_ADDRESS,
            TARGET_VAULT,
            ARBITRUM_CHAIN_ID,
            {
                gasLimit: 500000,
                gasPrice: ethers.utils.parseUnits("0.1", "gwei") // Use legacy gas pricing
            }
        );
        
        console.log("Transaction sent:", tx.hash);
        console.log("Waiting for confirmation...");
        
        const receipt = await tx.wait();
        
        if (receipt.status === 1) {
            console.log("✅ Registration successful!");
        } else {
            console.log("❌ Registration failed!");
            console.log("Check transaction:", tx.hash);
        }
        
    } catch (error) {
        console.log("❌ Error:", error.message.split('\n')[0]);
        
        // Check if it's a revert
        if (error.reason) {
            console.log("Revert reason:", error.reason);
        }
        
        // Check if transaction was sent but failed
        if (error.transactionHash) {
            console.log("Failed transaction:", error.transactionHash);
            console.log("Check on Arbiscan: https://arbiscan.io/tx/" + error.transactionHash);
        }
    }
}

tryRegistration().catch(console.error);

