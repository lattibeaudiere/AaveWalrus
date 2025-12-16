const { ethers } = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function setupFinalRSC() {
    // FINAL FIXED CONTRACT (removed VM check)
    const CONTRACT = "0x6c1AfD96bCDC5cbC96EA6Cc6C2A4bAa63F91bB64";
    const SYSTEM_CONTRACT = "0x0000000000000000000000000000000000fffFfF";
    const REACTIVE_RPC = process.env.REACTIVE_RPC || "https://mainnet-rpc.rnk.dev";
    
    if (!process.env.REACTIVE_PRIVATE_KEY) {
        console.error("❌ REACTIVE_PRIVATE_KEY not set");
        process.exit(1);
    }
    
    const provider = new ethers.providers.JsonRpcProvider(REACTIVE_RPC);
    const signer = new ethers.Wallet(process.env.REACTIVE_PRIVATE_KEY, provider);
    
    console.log("🚀 Setting Up Final Fixed RSC Contract...\n");
    console.log("Contract:", CONTRACT);
    console.log("Signer:", signer.address);
    console.log("");
    
    // Check contract
    const code = await provider.getCode(CONTRACT);
    if (code === "0x") {
        console.error("❌ Contract does not exist!");
        process.exit(1);
    }
    console.log("✅ Contract exists\n");
    
    // Check owner
    const ABI = ["function owner() view returns (address)"];
    const contract = new ethers.Contract(CONTRACT, ABI, provider);
    const owner = await contract.owner();
    
    if (owner.toLowerCase() !== signer.address.toLowerCase()) {
        console.error("❌ Signer is not the owner!");
        process.exit(1);
    }
    console.log("✅ Owner verified\n");
    
    // Fund contract
    console.log("=".repeat(60));
    console.log("STEP 1: Funding Contract");
    console.log("=".repeat(60));
    console.log("");
    
    try {
        const balance = await provider.getBalance(CONTRACT);
        console.log("Current balance:", ethers.utils.formatEther(balance), "REACT");
        
        if (balance.lt(ethers.utils.parseEther("1.0"))) {
            const SYSTEM_ABI = ["function depositTo(address reactiveContract) external payable"];
            const systemContract = new ethers.Contract(SYSTEM_CONTRACT, SYSTEM_ABI, signer);
            
            const fundTx = await systemContract.depositTo(CONTRACT, {
                value: ethers.utils.parseEther("1.0"),
                gasLimit: 100000
            });
            
            console.log("Funding transaction:", fundTx.hash);
            await fundTx.wait();
            console.log("✅ Contract funded!\n");
        } else {
            console.log("✅ Contract already funded\n");
        }
    } catch (error) {
        console.log("⚠️  Funding error:", error.message);
        console.log("Continuing anyway...\n");
    }
    
    // Subscribe to Aave
    console.log("=".repeat(60));
    console.log("STEP 2: Subscribing to Aave V3");
    console.log("=".repeat(60));
    console.log("");
    
    const AAVE_POOL = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
    const RESERVE_DATA_UPDATED = "0xb2a02bf1a92354a66946e3533277a66dd13726c1695e5ac302d1c1fcb97d2200";
    const ARBITRUM_CHAIN_ID = 42161;
    
    const SUBSCRIBE_ABI = [
        "function subscribeTo(uint256 chainId, address contractAddress, uint256 topic0) external payable",
        "event Subscribed(uint256 chainId, address target, uint256 topic0)"
    ];
    
    try {
        const subscribeContract = new ethers.Contract(CONTRACT, SUBSCRIBE_ABI, signer);
        
        console.log("Subscribing to:");
        console.log("  Chain ID:", ARBITRUM_CHAIN_ID);
        console.log("  Contract:", AAVE_POOL);
        console.log("  Topic:", RESERVE_DATA_UPDATED);
        console.log("");
        
        const tx = await subscribeContract.subscribeTo(
            ARBITRUM_CHAIN_ID,
            AAVE_POOL,
            RESERVE_DATA_UPDATED,
            { gasLimit: 200000 }
        );
        
        console.log("Transaction hash:", tx.hash);
        const receipt = await tx.wait();
        
        if (receipt.status === 1) {
            console.log("✅ Subscription SUCCESSFUL!");
            console.log("  Block:", receipt.blockNumber);
            console.log("  Gas Used:", receipt.gasUsed.toString());
            console.log("  Logs:", receipt.logs.length);
            
            // Check for Subscribed event
            const iface = new ethers.utils.Interface(SUBSCRIBE_ABI);
            for (const log of receipt.logs) {
                try {
                    const parsed = iface.parseLog(log);
                    if (parsed.name === 'Subscribed') {
                        console.log("  ✅ Subscribed event emitted!");
                        console.log("     Chain ID:", parsed.args.chainId.toString());
                        console.log("     Target:", parsed.args.target);
                        console.log("     Topic:", parsed.args.topic0);
                        break;
                    }
                } catch (e) {}
            }
        } else {
            console.log("❌ Subscription FAILED!");
        }
    } catch (error) {
        console.log("❌ Subscription error:", error.message);
        if (error.reason) console.log("  Reason:", error.reason);
    }
    
    console.log("");
    
    // Subscribe to Compound
    console.log("=".repeat(60));
    console.log("STEP 3: Subscribing to Compound V3");
    console.log("=".repeat(60));
    console.log("");
    
    const COMPOUND_USDC = "0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA";
    const ACCRUE_INTEREST = "0x717fee053884ab1935ba6d0140f6ed225371439611d9674ff445419d6a0fa1b7";
    
    try {
        const subscribeContract = new ethers.Contract(CONTRACT, SUBSCRIBE_ABI, signer);
        
        console.log("Subscribing to:");
        console.log("  Chain ID:", ARBITRUM_CHAIN_ID);
        console.log("  Contract:", COMPOUND_USDC);
        console.log("  Topic:", ACCRUE_INTEREST);
        console.log("");
        
        const tx = await subscribeContract.subscribeTo(
            ARBITRUM_CHAIN_ID,
            COMPOUND_USDC,
            ACCRUE_INTEREST,
            { gasLimit: 200000 }
        );
        
        console.log("Transaction hash:", tx.hash);
        const receipt = await tx.wait();
        
        if (receipt.status === 1) {
            console.log("✅ Subscription SUCCESSFUL!");
            console.log("  Block:", receipt.blockNumber);
            console.log("  Gas Used:", receipt.gasUsed.toString());
            console.log("  Logs:", receipt.logs.length);
            
            // Check for Subscribed event
            const iface = new ethers.utils.Interface(SUBSCRIBE_ABI);
            for (const log of receipt.logs) {
                try {
                    const parsed = iface.parseLog(log);
                    if (parsed.name === 'Subscribed') {
                        console.log("  ✅ Subscribed event emitted!");
                        console.log("     Chain ID:", parsed.args.chainId.toString());
                        console.log("     Target:", parsed.args.target);
                        console.log("     Topic:", parsed.args.topic0);
                        break;
                    }
                } catch (e) {}
            }
        } else {
            console.log("❌ Subscription FAILED!");
        }
    } catch (error) {
        console.log("❌ Subscription error:", error.message);
        if (error.reason) console.log("  Reason:", error.reason);
    }
    
    console.log("\n" + "=".repeat(60));
    console.log("✅ SETUP COMPLETE");
    console.log("=".repeat(60));
    console.log("\nContract:", CONTRACT);
    console.log("\n💡 Update your .env file with:");
    console.log(`RSC_ADDRESS=${CONTRACT}`);
}

setupFinalRSC().catch(console.error);

