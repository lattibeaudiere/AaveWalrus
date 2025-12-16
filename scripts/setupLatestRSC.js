const { ethers } = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function setupLatestRSC() {
    // NEW FIXED CONTRACT ADDRESS
    const CONTRACT = "0x52873108e9148282a8Af13BBDC552A1D4A62970D";
    const SYSTEM_CONTRACT = "0x0000000000000000000000000000000000fffFfF";
    const REACTIVE_RPC = process.env.REACTIVE_RPC || "https://mainnet-rpc.rnk.dev";
    
    if (!process.env.REACTIVE_PRIVATE_KEY) {
        console.error("❌ REACTIVE_PRIVATE_KEY not set");
        process.exit(1);
    }
    
    const provider = new ethers.providers.JsonRpcProvider(REACTIVE_RPC);
    const signer = new ethers.Wallet(process.env.REACTIVE_PRIVATE_KEY, provider);
    
    console.log("🚀 Setting Up Latest Fixed RSC Contract...\n");
    console.log("Contract:", CONTRACT);
    console.log("Signer:", signer.address);
    console.log("");
    
    // Check contract exists
    const code = await provider.getCode(CONTRACT);
    if (code === "0x") {
        console.error("❌ Contract does not exist!");
        process.exit(1);
    }
    console.log("✅ Contract exists\n");
    
    // Check owner
    const ABI = [
        "function owner() view returns (address)",
        "function service() view returns (address)",
        "function adapter() view returns (address)"
    ];
    const contract = new ethers.Contract(CONTRACT, ABI, provider);
    
    const owner = await contract.owner();
    const service = await contract.service();
    const adapter = await contract.adapter();
    
    console.log("Contract Info:");
    console.log("  Owner:", owner);
    console.log("  Service:", service);
    console.log("  Adapter:", adapter);
    
    if (owner.toLowerCase() !== signer.address.toLowerCase()) {
        console.error("❌ Signer is not the owner!");
        process.exit(1);
    }
    console.log("✅ Signer is the owner\n");
    
    // Step 1: Fund the contract
    console.log("=".repeat(60));
    console.log("STEP 1: Funding Contract");
    console.log("=".repeat(60));
    console.log("");
    
    try {
        const balance = await provider.getBalance(CONTRACT);
        console.log("Current balance:", ethers.utils.formatEther(balance), "REACT");
        
        if (balance.lt(ethers.utils.parseEther("1.0"))) {
            console.log("Funding with 1.0 REACT via system contract...");
            
            const SYSTEM_ABI = [
                "function depositTo(address reactiveContract) external payable"
            ];
            const systemContract = new ethers.Contract(SYSTEM_CONTRACT, SYSTEM_ABI, signer);
            
            const fundTx = await systemContract.depositTo(CONTRACT, {
                value: ethers.utils.parseEther("1.0"),
                gasLimit: 100000
            });
            
            console.log("Funding transaction:", fundTx.hash);
            const fundReceipt = await fundTx.wait();
            
            if (fundReceipt.status === 1) {
                console.log("✅ Contract funded!");
                const newBalance = await provider.getBalance(CONTRACT);
                console.log("New balance:", ethers.utils.formatEther(newBalance), "REACT\n");
            } else {
                console.log("❌ Funding failed\n");
            }
        } else {
            console.log("✅ Contract already funded\n");
        }
    } catch (error) {
        console.log("⚠️  Funding error:", error.message);
        console.log("Continuing anyway...\n");
    }
    
    // Step 2: Subscribe to Aave V3
    console.log("=".repeat(60));
    console.log("STEP 2: Subscribing to Aave V3 ReserveDataUpdated");
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
        
        console.log("Subscription Details:");
        console.log("  Chain ID:", ARBITRUM_CHAIN_ID);
        console.log("  Contract:", AAVE_POOL);
        console.log("  Topic:", RESERVE_DATA_UPDATED);
        console.log("");
        
        console.log("Sending subscription transaction...");
        const aaveTx = await subscribeContract.subscribeTo(
            ARBITRUM_CHAIN_ID,
            AAVE_POOL,
            RESERVE_DATA_UPDATED,
            { gasLimit: 200000 }
        );
        
        console.log("Transaction hash:", aaveTx.hash);
        console.log("Waiting for confirmation...");
        const aaveReceipt = await aaveTx.wait();
        
        if (aaveReceipt.status === 1) {
            console.log("✅ Subscription transaction confirmed!");
            console.log("  Block:", aaveReceipt.blockNumber);
            console.log("  Gas Used:", aaveReceipt.gasUsed.toString());
            
            // Check for Subscribed event
            const iface = new ethers.utils.Interface(SUBSCRIBE_ABI);
            let eventFound = false;
            
            for (const log of aaveReceipt.logs) {
                try {
                    const parsed = iface.parseLog(log);
                    if (parsed.name === 'Subscribed') {
                        console.log("✅ Subscribed event emitted!");
                        console.log("  Chain ID:", parsed.args.chainId.toString());
                        console.log("  Target:", parsed.args.target);
                        console.log("  Topic:", parsed.args.topic0);
                        eventFound = true;
                        break;
                    }
                } catch (e) {
                    // Not our event
                }
            }
            
            if (!eventFound) {
                console.log("⚠️  Subscribed event not found in logs");
                console.log("  (This may be normal - Reactive Network manages subscriptions internally)");
            }
        } else {
            console.log("❌ Subscription transaction failed!");
        }
    } catch (error) {
        console.log("❌ Subscription error:", error.message);
        if (error.reason) console.log("  Reason:", error.reason);
        if (error.data) console.log("  Data:", error.data);
    }
    
    console.log("");
    
    // Step 3: Subscribe to Compound V3
    console.log("=".repeat(60));
    console.log("STEP 3: Subscribing to Compound V3 AccrueInterest");
    console.log("=".repeat(60));
    console.log("");
    
    const COMPOUND_USDC = "0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA";
    const ACCRUE_INTEREST = "0x717fee053884ab1935ba6d0140f6ed225371439611d9674ff445419d6a0fa1b7";
    
    try {
        const subscribeContract = new ethers.Contract(CONTRACT, SUBSCRIBE_ABI, signer);
        
        console.log("Subscription Details:");
        console.log("  Chain ID:", ARBITRUM_CHAIN_ID);
        console.log("  Contract:", COMPOUND_USDC);
        console.log("  Topic:", ACCRUE_INTEREST);
        console.log("");
        
        console.log("Sending subscription transaction...");
        const compoundTx = await subscribeContract.subscribeTo(
            ARBITRUM_CHAIN_ID,
            COMPOUND_USDC,
            ACCRUE_INTEREST,
            { gasLimit: 200000 }
        );
        
        console.log("Transaction hash:", compoundTx.hash);
        console.log("Waiting for confirmation...");
        const compoundReceipt = await compoundTx.wait();
        
        if (compoundReceipt.status === 1) {
            console.log("✅ Subscription transaction confirmed!");
            console.log("  Block:", compoundReceipt.blockNumber);
            console.log("  Gas Used:", compoundReceipt.gasUsed.toString());
            
            // Check for Subscribed event
            const iface = new ethers.utils.Interface(SUBSCRIBE_ABI);
            let eventFound = false;
            
            for (const log of compoundReceipt.logs) {
                try {
                    const parsed = iface.parseLog(log);
                    if (parsed.name === 'Subscribed') {
                        console.log("✅ Subscribed event emitted!");
                        console.log("  Chain ID:", parsed.args.chainId.toString());
                        console.log("  Target:", parsed.args.target);
                        console.log("  Topic:", parsed.args.topic0);
                        eventFound = true;
                        break;
                    }
                } catch (e) {
                    // Not our event
                }
            }
            
            if (!eventFound) {
                console.log("⚠️  Subscribed event not found in logs");
                console.log("  (This may be normal - Reactive Network manages subscriptions internally)");
            }
        } else {
            console.log("❌ Subscription transaction failed!");
        }
    } catch (error) {
        console.log("❌ Subscription error:", error.message);
        if (error.reason) console.log("  Reason:", error.reason);
        if (error.data) console.log("  Data:", error.data);
    }
    
    console.log("\n" + "=".repeat(60));
    console.log("✅ SETUP COMPLETE");
    console.log("=".repeat(60));
    console.log("");
    console.log("Contract:", CONTRACT);
    console.log("");
    console.log("📌 Next Steps:");
    console.log("1. Monitor for ReactHandled events when Arbitrum events occur");
    console.log("2. Check Reactscan: https://reactscan.io/address/" + CONTRACT);
    console.log("3. Wait for Aave V3 or Compound V3 events on Arbitrum");
    console.log("");
    console.log("💡 Update your .env file with:");
    console.log(`RSC_ADDRESS=${CONTRACT}`);
    console.log("");
}

setupLatestRSC().catch(console.error);

