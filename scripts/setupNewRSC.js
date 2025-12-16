const { ethers } = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function setupNewRSC() {
    // NEW CONTRACT ADDRESS
    const NEW_CONTRACT = "0x21998c6D876A56B015a7aB5878cC4Da761d5772F";
    const SYSTEM_CONTRACT = "0x0000000000000000000000000000000000fffFfF";
    const REACTIVE_RPC = process.env.REACTIVE_RPC || "https://mainnet-rpc.rnk.dev";
    
    if (!process.env.REACTIVE_PRIVATE_KEY) {
        console.error("❌ REACTIVE_PRIVATE_KEY not set");
        process.exit(1);
    }
    
    const provider = new ethers.providers.JsonRpcProvider(REACTIVE_RPC);
    const signer = new ethers.Wallet(process.env.REACTIVE_PRIVATE_KEY, provider);
    
    console.log("🚀 Setting Up New RSC Contract...\n");
    console.log("New Contract:", NEW_CONTRACT);
    console.log("Signer:", signer.address);
    console.log("");
    
    // Check contract exists
    const code = await provider.getCode(NEW_CONTRACT);
    if (code === "0x") {
        console.error("❌ Contract does not exist!");
        process.exit(1);
    }
    console.log("✅ Contract exists");
    
    // Check owner
    const CONTRACT_ABI = [
        "function owner() view returns (address)",
        "function service() view returns (address)",
        "function adapter() view returns (address)"
    ];
    const contract = new ethers.Contract(NEW_CONTRACT, CONTRACT_ABI, provider);
    
    const owner = await contract.owner();
    const service = await contract.service();
    const adapter = await contract.adapter();
    
    console.log("👤 Owner:", owner);
    console.log("🔗 Service:", service);
    console.log("🔗 Adapter:", adapter);
    
    if (owner.toLowerCase() !== signer.address.toLowerCase()) {
        console.error("❌ Signer is not the owner!");
        process.exit(1);
    }
    console.log("✅ Signer is the owner\n");
    
    // Step 1: Fund the contract
    console.log("STEP 1: Funding contract with REACT...\n");
    
    try {
        const balance = await provider.getBalance(NEW_CONTRACT);
        console.log("Current balance:", ethers.utils.formatEther(balance), "REACT");
        
        if (balance.lt(ethers.utils.parseEther("1.0"))) {
            console.log("Funding with 1.0 REACT via system contract...");
            
            const SYSTEM_ABI = [
                "function depositTo(address reactiveContract) external payable"
            ];
            const systemContract = new ethers.Contract(SYSTEM_CONTRACT, SYSTEM_ABI, signer);
            
            const fundTx = await systemContract.depositTo(NEW_CONTRACT, {
                value: ethers.utils.parseEther("1.0"),
                gasLimit: 100000
            });
            
            console.log("Funding transaction:", fundTx.hash);
            await fundTx.wait();
            console.log("✅ Contract funded!");
            
            const newBalance = await provider.getBalance(NEW_CONTRACT);
            console.log("New balance:", ethers.utils.formatEther(newBalance), "REACT\n");
        } else {
            console.log("✅ Contract already funded\n");
        }
    } catch (error) {
        console.log("⚠️  Funding error:", error.message);
        console.log("Continuing anyway...\n");
    }
    
    // Step 2: Subscribe to Aave V3
    console.log("STEP 2: Subscribing to Aave V3 ReserveDataUpdated...\n");
    
    const AAVE_POOL = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
    const RESERVE_DATA_UPDATED = "0xb2a02bf1a92354a66946e3533277a66dd13726c1695e5ac302d1c1fcb97d2200";
    const ARBITRUM_CHAIN_ID = 42161;
    
    const SUBSCRIBE_ABI = [
        "function subscribeTo(uint256 chainId, address contractAddress, uint256 topic0) external payable",
        "event Subscribed(uint256 chainId, address target, uint256 topic0)"
    ];
    
    try {
        const subscribeContract = new ethers.Contract(NEW_CONTRACT, SUBSCRIBE_ABI, signer);
        
        console.log("Subscribing to:");
        console.log("  Chain ID:", ARBITRUM_CHAIN_ID);
        console.log("  Contract:", AAVE_POOL);
        console.log("  Topic:", RESERVE_DATA_UPDATED);
        
        const aaveTx = await subscribeContract.subscribeTo(
            ARBITRUM_CHAIN_ID,
            AAVE_POOL,
            RESERVE_DATA_UPDATED,
            { gasLimit: 200000 }
        );
        
        console.log("Transaction hash:", aaveTx.hash);
        const aaveReceipt = await aaveTx.wait();
        
        if (aaveReceipt.status === 1) {
            console.log("✅ Subscription transaction confirmed");
            console.log("Gas used:", aaveReceipt.gasUsed.toString());
            
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
                console.log("💡 Subscription may still have succeeded (check with monitoring)");
            }
        } else {
            console.log("❌ Subscription transaction failed");
        }
    } catch (error) {
        console.log("❌ Subscription error:", error.message);
        if (error.reason) console.log("Reason:", error.reason);
    }
    
    console.log("");
    
    // Step 3: Subscribe to Compound V3
    console.log("STEP 3: Subscribing to Compound V3 AccrueInterest...\n");
    
    const COMPOUND_USDC = "0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA";
    const ACCRUE_INTEREST = "0x717fee053884ab1935ba6d0140f6ed225371439611d9674ff445419d6a0fa1b7";
    
    try {
        const subscribeContract = new ethers.Contract(NEW_CONTRACT, SUBSCRIBE_ABI, signer);
        
        console.log("Subscribing to:");
        console.log("  Chain ID:", ARBITRUM_CHAIN_ID);
        console.log("  Contract:", COMPOUND_USDC);
        console.log("  Topic:", ACCRUE_INTEREST);
        
        const compoundTx = await subscribeContract.subscribeTo(
            ARBITRUM_CHAIN_ID,
            COMPOUND_USDC,
            ACCRUE_INTEREST,
            { gasLimit: 200000 }
        );
        
        console.log("Transaction hash:", compoundTx.hash);
        const compoundReceipt = await compoundTx.wait();
        
        if (compoundReceipt.status === 1) {
            console.log("✅ Subscription transaction confirmed");
            console.log("Gas used:", compoundReceipt.gasUsed.toString());
            
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
                console.log("💡 Subscription may still have succeeded (check with monitoring)");
            }
        } else {
            console.log("❌ Subscription transaction failed");
        }
    } catch (error) {
        console.log("❌ Subscription error:", error.message);
        if (error.reason) console.log("Reason:", error.reason);
    }
    
    console.log("\n" + "=".repeat(50));
    console.log("✅ SETUP COMPLETE!");
    console.log("=".repeat(50));
    console.log("New RSC Contract:", NEW_CONTRACT);
    console.log("\n📌 Next Steps:");
    console.log("1. Monitor for ReactHandled events when Arbitrum events occur");
    console.log("2. Check Reactscan: https://reactscan.io/address/" + NEW_CONTRACT);
    console.log("3. Wait for Aave V3 or Compound V3 events on Arbitrum");
    console.log("\n💡 Update your .env file with:");
    console.log(`RSC_ADDRESS=${NEW_CONTRACT}`);
}

setupNewRSC().catch(console.error);

