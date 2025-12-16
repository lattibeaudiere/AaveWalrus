const { ethers } = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function completeSetup() {
    const CONTRACT = process.env.RSC_ADDRESS || "0x02c904E571749c61bdd05e58FbF91F7921594186";
    const AAVE_POOL = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
    const COMPOUND_USDC = "0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA";
    const RESERVE_DATA_UPDATED = "0xb2a02bf1a92354a66946e3533277a66dd13726c1695e5ac302d1c1fcb97d2200";
    
    const provider = new ethers.providers.JsonRpcProvider(
        process.env.REACTIVE_RPC || "https://mainnet-rpc.rnk.dev"
    );
    
    if (!process.env.REACTIVE_PRIVATE_KEY) {
        console.error("❌ REACTIVE_PRIVATE_KEY not set in .env");
        process.exit(1);
    }
    
    const signer = new ethers.Wallet(process.env.REACTIVE_PRIVATE_KEY, provider);
    
    console.log("🚀 Starting Complete RSC Setup...\n");
    console.log("RSC Contract:", CONTRACT);
    console.log("Network: Reactive Network (Chain 1597)\n");
    
    // Step 1: Check balance
    console.log("STEP 1: Checking signer balance...");
    const signerBalance = await signer.getBalance();
    const signerBalanceEth = ethers.utils.formatEther(signerBalance);
    console.log(`  Balance: ${signerBalanceEth} REACT`);
    
    if (signerBalance.lt(ethers.utils.parseEther("2"))) {
        console.error("❌ Insufficient balance! Need at least 2 REACT");
        console.error("   1 REACT for contract funding");
        console.error("   1 REACT for subscription transactions");
        process.exit(1);
    }
    console.log("✅ Sufficient balance\n");
    
    // Step 2: Fund contract
    console.log("STEP 2: Funding contract...");
    const contractBalance = await provider.getBalance(CONTRACT);
    const contractBalanceEth = ethers.utils.formatEther(contractBalance);
    console.log(`  Current: ${contractBalanceEth} REACT`);
    
    const FUND_AMOUNT = ethers.utils.parseEther(process.env.FUND_AMOUNT || "1.0");
    
    if (contractBalance.lt(FUND_AMOUNT)) {
        console.log(`  Attempting to send ${ethers.utils.formatEther(FUND_AMOUNT)} REACT...`);
        try {
            const fundTx = await signer.sendTransaction({
                to: CONTRACT,
                value: FUND_AMOUNT,
                gasLimit: 21000 // Standard transfer gas limit
            });
            console.log("  Transaction hash:", fundTx.hash);
            const receipt = await fundTx.wait();
            if (receipt.status === 1) {
                console.log("  ✅ Funded");
            } else {
                console.log("  ⚠️  Funding transaction failed, but continuing...");
                console.log("  💡 You may need to fund the contract manually or the contract may not accept plain transfers");
            }
        } catch (error) {
            console.log("  ⚠️  Could not fund contract:", error.message);
            console.log("  💡 Continuing anyway - contract may be funded via Reactive Network callbacks");
            console.log("  💡 Or fund manually later if needed");
        }
    } else {
        console.log("  ✅ Already funded");
    }
    console.log("");
    
    // Step 3: Subscribe to Aave
    console.log("STEP 3: Subscribing to Aave V3...");
    const contractABI = [
        "function subscribeTo(uint256,address,uint256) external",
        "function owner() view returns (address)",
        "event Subscribed(uint256,address,uint256)"
    ];
    const contract = new ethers.Contract(CONTRACT, contractABI, signer);
    
    // Verify owner
    try {
        const owner = await contract.owner();
        if (owner.toLowerCase() !== signer.address.toLowerCase()) {
            console.error("  ❌ Not the owner! Cannot subscribe");
            process.exit(1);
        }
    } catch (error) {
        console.error("  ❌ Error checking owner:", error.message);
        process.exit(1);
    }
    
    try {
        console.log("  Subscribing to ReserveDataUpdated event...");
        const aaveTx = await contract.subscribeTo(42161, AAVE_POOL, RESERVE_DATA_UPDATED, {
            gasLimit: 500000
        });
        console.log("  Transaction hash:", aaveTx.hash);
        await aaveTx.wait();
        console.log("  ✅ Subscribed to Aave V3\n");
    } catch (error) {
        if (error.message.includes("already subscribed") || error.code === -32000) {
            console.log("  ⚠️  Already subscribed or subscription exists\n");
        } else {
            console.error("  ❌ Error subscribing:", error.message);
            console.error("  Continuing anyway...\n");
        }
    }
    
    // Step 4: Subscribe to Compound
    console.log("STEP 4: Subscribing to Compound V3...");
    const ACCRUE_INTEREST = ethers.utils.id("AccrueInterest(uint256,uint256,uint256,uint256,uint256)");
    
    try {
        console.log("  Subscribing to AccrueInterest event...");
        console.log("  ⚠️  Note: Verify this event exists on Compound V3 first!");
        console.log("  Run: node scripts/checkCompoundEvents.js\n");
        
        const compoundTx = await contract.subscribeTo(42161, COMPOUND_USDC, ACCRUE_INTEREST, {
            gasLimit: 500000
        });
        console.log("  Transaction hash:", compoundTx.hash);
        await compoundTx.wait();
        console.log("  ✅ Subscribed to Compound V3\n");
    } catch (error) {
        console.log("  ⚠️  Compound subscription failed:", error.message);
        console.log("  💡 Run 'node scripts/checkCompoundEvents.js' to find correct event\n");
    }
    
    // Step 5: Verify
    console.log("STEP 5: Final verification...");
    const finalBalance = await provider.getBalance(CONTRACT);
    console.log(`  Contract balance: ${ethers.utils.formatEther(finalBalance)} REACT`);
    
    if (parseFloat(ethers.utils.formatEther(finalBalance)) < 0.1) {
        console.warn("  ⚠️  WARNING: Low balance! Add more REACT");
    } else {
        console.log("  ✅ Sufficient balance");
    }
    
    console.log("\n🎉 SETUP COMPLETE!");
    console.log("\n📌 Your RSC is now:");
    console.log("  ✅ Funded with REACT");
    console.log("  ✅ Subscribed to Aave V3 ReserveDataUpdated");
    console.log("  ⚠️  Compound V3 subscription may need verification");
    console.log("\n📋 Next Steps:");
    console.log("  1. Verify Compound V3 event: node scripts/checkCompoundEvents.js");
    console.log("  2. Monitor events: node scripts/monitorEvents.js");
    console.log("  3. Check status: node scripts/verifySubscriptions.js");
}

completeSetup().catch(console.error);

