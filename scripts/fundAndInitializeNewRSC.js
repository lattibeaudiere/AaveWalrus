const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function fundAndInitializeNewRSC() {
    console.log("=".repeat(70));
    console.log("💰 FUNDING & INITIALIZING NEW RSC");
    console.log("=".repeat(70));
    console.log("");
    
    const NEW_RSC = "0x7Af5dC1f012d4a875E40d2ffD5E39d7468c59E14";
    
    const reactiveProvider = new ethers.providers.JsonRpcProvider(
        process.env.REACTIVE_RPC || "https://reactive-network.rpc.thirdweb.com"
    );
    
    const REACTIVE_PRIVATE_KEY = process.env.REACTIVE_PRIVATE_KEY;
    const wallet = new ethers.Wallet(REACTIVE_PRIVATE_KEY, reactiveProvider);
    
    // System contract for funding
    const SYSTEM_CONTRACT = "0x0000000000000000000000000000000000fffFfF";
    const systemAbi = [
        "function depositTo(address contract_) external payable returns (uint256)"
    ];
    const systemContract = new ethers.Contract(SYSTEM_CONTRACT, systemAbi, wallet);
    
    console.log("RSC Address:", NEW_RSC);
    console.log("Owner:", wallet.address);
    console.log("");
    
    // Step 1: Fund RSC
    console.log("1️⃣  Funding RSC:");
    console.log("");
    
    const fundAmount = ethers.utils.parseEther("1.0"); // 1 REACT
    console.log(`   Sending ${ethers.utils.formatEther(fundAmount)} REACT...`);
    
    try {
        const fundTx = await systemContract.depositTo(NEW_RSC, {
            value: fundAmount,
            gasLimit: 500000
        });
        console.log(`   Transaction: ${fundTx.hash}`);
        await fundTx.wait();
        console.log("   ✅ RSC funded!");
        console.log("");
    } catch (error) {
        console.log(`   ⚠️  Error: ${error.message.split('\n')[0]}`);
        console.log("");
    }
    
    // Step 2: Check status
    console.log("2️⃣  Checking RSC Status:");
    console.log("");
    
    const rscAbi = [
        "function getEconomyStatus() external view returns (uint256 directBalance, uint256 reserves, uint256 debt, int256 netBalance, bool isActive)",
        "function getSubscriptionStatus() external view returns (bool aaveSub, bool compoundSub, bool queryHelperSub)"
    ];
    
    try {
        const rsc = new ethers.Contract(NEW_RSC, rscAbi, reactiveProvider);
        const economy = await rsc.getEconomyStatus();
        const subs = await rsc.getSubscriptionStatus();
        
        console.log(`   Active: ${economy[4] ? "✅" : "❌"}`);
        console.log(`   Reserves: ${ethers.utils.formatEther(economy[1])} REACT`);
        console.log(`   Debt: ${ethers.utils.formatEther(economy[3])} REACT`);
        console.log(`   Aave Subscribed: ${subs[0] ? "✅" : "❌"}`);
        console.log(`   QueryHelper Subscribed: ${subs[2] ? "✅" : "❌"}`);
        console.log("");
        
        if (!economy[4]) {
            console.log("   ⚠️  Still not active - may need more funding");
            console.log("");
        }
    } catch (error) {
        console.log(`   ⚠️  Error: ${error.message.split('\n')[0]}`);
        console.log("");
    }
    
    // Step 3: Initialize strategy
    console.log("3️⃣  Initializing Strategy:");
    console.log("");
    
    const initAbi = ["function initializeStrategy() external"];
    const rscWithInit = new ethers.Contract(NEW_RSC, initAbi, wallet);
    
    try {
        console.log("   Calling initializeStrategy()...");
        const initTx = await rscWithInit.initializeStrategy({ gasLimit: 500000 });
        console.log(`   Transaction: ${initTx.hash}`);
        await initTx.wait();
        console.log("   ✅ Strategy initialized!");
        console.log("");
        console.log("   This should trigger:");
        console.log("   • Callback to QueryHelper.queryBothApys()");
        console.log("   • QueryHelper queries both APYs");
        console.log("   • RSC receives BothApysQueried event");
        console.log("   • If spread > 30 bps, capital will deploy!");
        console.log("");
    } catch (error) {
        if (error.message.includes("Already initialized") || error.message.includes("already has APY baseline")) {
            console.log("   ✅ Already initialized");
        } else {
            console.log(`   ⚠️  Error: ${error.message.split('\n')[0]}`);
        }
        console.log("");
    }
    
    console.log("=".repeat(70));
    console.log("✅ SETUP COMPLETE");
    console.log("=".repeat(70));
    console.log("");
    console.log("New RSC:", NEW_RSC);
    console.log("Monitor:");
    console.log(`  • RSC: https://reactscan.io/address/${NEW_RSC}`);
    console.log(`  • QueryHelper: https://arbiscan.io/address/0x55f03641265a793112bd1D9480C4Ea4f143E06af`);
    console.log("");
    console.log("Expected flow:");
    console.log("  1. QueryHelper callback executes ✅ (should work now)");
    console.log("  2. QueryHelper emits BothApysQueried event");
    console.log("  3. RSC receives event and compares APYs");
    console.log("  4. If spread > 30 bps, capital deploys!");
    console.log("");
}

fundAndInitializeNewRSC().catch(console.error);

