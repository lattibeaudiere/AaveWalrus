const { ethers } = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function fundContract() {
    const CONTRACT = process.env.RSC_ADDRESS || "0x02c904E571749c61bdd05e58FbF91F7921594186";
    const AMOUNT = ethers.utils.parseEther(process.env.FUND_AMOUNT || "1.0"); // Default 1 REACT
    
    const provider = new ethers.providers.JsonRpcProvider(
        process.env.REACTIVE_RPC || "https://mainnet-rpc.rnk.dev"
    );
    
    if (!process.env.REACTIVE_PRIVATE_KEY) {
        console.error("❌ REACTIVE_PRIVATE_KEY not set in .env");
        process.exit(1);
    }
    
    const signer = new ethers.Wallet(process.env.REACTIVE_PRIVATE_KEY, provider);
    
    console.log("💰 Funding Reactive RSC Contract...\n");
    console.log("From:", signer.address);
    console.log("To:", CONTRACT);
    console.log("Amount:", ethers.utils.formatEther(AMOUNT), "REACT");
    
    // Check signer balance
    const signerBalance = await signer.getBalance();
    console.log("Signer balance:", ethers.utils.formatEther(signerBalance), "REACT\n");
    
    if (signerBalance.lt(AMOUNT)) {
        console.error("❌ Insufficient balance! Need", ethers.utils.formatEther(AMOUNT), "REACT");
        process.exit(1);
    }
    
    try {
        const tx = await signer.sendTransaction({
            to: CONTRACT,
            value: AMOUNT,
            gasLimit: 21000 // Standard transfer gas limit
        });
        
        console.log("📤 Transaction sent:", tx.hash);
        console.log("Waiting for confirmation...");
        
        const receipt = await tx.wait();
        
        if (receipt.status === 1) {
            console.log("✅ Transaction confirmed!");
            console.log("Block:", receipt.blockNumber);
            console.log("Gas used:", receipt.gasUsed.toString());
        } else {
            console.error("❌ Transaction failed");
            process.exit(1);
        }
        
        const balance = await provider.getBalance(CONTRACT);
        console.log("\n💎 Contract balance:", ethers.utils.formatEther(balance), "REACT");
    } catch (error) {
        console.error("❌ Error:", error.message);
        process.exit(1);
    }
}

fundContract().catch(console.error);

