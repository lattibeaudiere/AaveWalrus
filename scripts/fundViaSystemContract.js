const { ethers } = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function fundViaSystemContract() {
    const CONTRACT = process.env.RSC_ADDRESS || "0x02c904E571749c61bdd05e58FbF91F7921594186";
    const SYSTEM_CONTRACT = "0x0000000000000000000000000000000000fffFfF";
    const AMOUNT = ethers.utils.parseEther(process.env.FUND_AMOUNT || "1.0");
    
    const provider = new ethers.providers.JsonRpcProvider(
        process.env.REACTIVE_RPC || "https://mainnet-rpc.rnk.dev"
    );
    
    if (!process.env.REACTIVE_PRIVATE_KEY) {
        console.error("❌ REACTIVE_PRIVATE_KEY not set in .env");
        process.exit(1);
    }
    
    const signer = new ethers.Wallet(process.env.REACTIVE_PRIVATE_KEY, provider);
    
    console.log("💰 Funding Reactive RSC via System Contract...\n");
    console.log("System Contract:", SYSTEM_CONTRACT);
    console.log("RSC Contract:", CONTRACT);
    console.log("Amount:", ethers.utils.formatEther(AMOUNT), "REACT");
    console.log("From:", signer.address);
    
    // Check signer balance
    const signerBalance = await signer.getBalance();
    console.log("Signer balance:", ethers.utils.formatEther(signerBalance), "REACT\n");
    
    if (signerBalance.lt(AMOUNT)) {
        console.error("❌ Insufficient balance! Need", ethers.utils.formatEther(AMOUNT), "REACT");
        process.exit(1);
    }
    
    const ABI = [
        "function depositTo(address reactiveContract) external payable"
    ];
    
    const systemContract = new ethers.Contract(SYSTEM_CONTRACT, ABI, signer);
    
    try {
        console.log("📤 Sending deposit transaction...");
        const tx = await systemContract.depositTo(CONTRACT, {
            value: AMOUNT,
            gasLimit: 50000
        });
        
        console.log("Transaction hash:", tx.hash);
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
        
        // Check contract balance
        const balance = await provider.getBalance(CONTRACT);
        console.log("\n💎 RSC Contract balance:", ethers.utils.formatEther(balance), "REACT");
        
    } catch (error) {
        console.error("❌ Error:", error.message);
        if (error.data) {
            console.error("Error data:", error.data);
        }
        process.exit(1);
    }
}

fundViaSystemContract().catch(console.error);

