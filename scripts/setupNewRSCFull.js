const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function setupNewRSCFull() {
    console.log("=".repeat(70));
    console.log("🚀 COMPLETE SETUP FOR NEW RSC");
    console.log("=".repeat(70));
    console.log("");
    
    const NEW_RSC = "0x7Af5dC1f012d4a875E40d2ffD5E39d7468c59E14";
    const NEW_QUERY_HELPER = "0x55f03641265a793112bd1D9480C4Ea4f143E06af";
    
    const reactiveProvider = new ethers.providers.JsonRpcProvider(
        process.env.REACTIVE_RPC || "https://reactive-network.rpc.thirdweb.com"
    );
    
    const REACTIVE_PRIVATE_KEY = process.env.REACTIVE_PRIVATE_KEY;
    
    if (!REACTIVE_PRIVATE_KEY) {
        throw new Error("REACTIVE_PRIVATE_KEY must be set");
    }
    
    const wallet = new ethers.Wallet(REACTIVE_PRIVATE_KEY, reactiveProvider);
    
    console.log("New RSC Address:", NEW_RSC);
    console.log("New QueryHelper:", NEW_QUERY_HELPER);
    console.log("Owner:", wallet.address);
    console.log("");
    
    const rscAbi = [
        "function queryHelper() external view returns (address)",
        "function getSubscriptionStatus() external view returns (bool aaveSub, bool compoundSub, bool queryHelperSub)",
        "function subscribeToAave() external",
        "function subscribeToQueryHelper() external",
        "function subscribeToBothApys() external",
        "function initializeStrategy() external",
        "function getContractStatus() external view returns (uint256 directBalance, uint256 reserves, uint256 debt, bool isActive, bool aaveSub, bool compoundSub, bool queryHelperSub, uint256 lastAaveApy, uint256 cooldownRemaining)"
    ];
    
    const rsc = new ethers.Contract(NEW_RSC, rscAbi, wallet);
    
    // Step 1: Verify QueryHelper
    console.log("1️⃣  Verifying QueryHelper:");
    console.log("");
    
    const queryHelper = await rsc.queryHelper();
    if (queryHelper.toLowerCase() === NEW_QUERY_HELPER.toLowerCase()) {
        console.log("   ✅ RSC has correct QueryHelper address!");
    } else {
        console.log("   ❌ RSC has wrong QueryHelper address!");
        console.log(`   Got: ${queryHelper}`);
        console.log(`   Expected: ${NEW_QUERY_HELPER}`);
        return;
    }
    console.log("");
    
    // Step 2: Check subscription status
    console.log("2️⃣  Checking Subscription Status:");
    console.log("");
    
    try {
        const status = await rsc.getSubscriptionStatus();
        console.log(`   Aave: ${status[0] ? "✅" : "❌"}`);
        console.log(`   Compound: ${status[1] ? "✅" : "❌"}`);
        console.log(`   QueryHelper: ${status[2] ? "✅" : "❌"}`);
        console.log("");
    } catch (error) {
        console.log("   ⚠️  Could not check (may need to subscribe first)");
        console.log("");
    }
    
    // Step 3: Subscribe to Aave
    console.log("3️⃣  Subscribing to Aave Events:");
    console.log("");
    
    try {
        const status = await rsc.getSubscriptionStatus();
        if (!status[0]) {
            console.log("   Subscribing...");
            const tx = await rsc.subscribeToAave({ gasLimit: 500000 });
            console.log(`   Transaction: ${tx.hash}`);
            await tx.wait();
            console.log("   ✅ Subscribed to Aave");
        } else {
            console.log("   ✅ Already subscribed to Aave");
        }
        console.log("");
    } catch (error) {
        if (error.message.includes("Already subscribed")) {
            console.log("   ✅ Already subscribed to Aave");
        } else {
            console.log(`   ⚠️  Error: ${error.message.split('\n')[0]}`);
        }
        console.log("");
    }
    
    // Step 4: Subscribe to QueryHelper
    console.log("4️⃣  Subscribing to QueryHelper Events:");
    console.log("");
    
    try {
        const status = await rsc.getSubscriptionStatus();
        if (!status[2]) {
            console.log("   Subscribing...");
            const tx = await rsc.subscribeToQueryHelper({ gasLimit: 500000 });
            console.log(`   Transaction: ${tx.hash}`);
            await tx.wait();
            console.log("   ✅ Subscribed to QueryHelper");
        } else {
            console.log("   ✅ Already subscribed to QueryHelper");
        }
        console.log("");
    } catch (error) {
        if (error.message.includes("Already subscribed")) {
            console.log("   ✅ Already subscribed to QueryHelper");
        } else {
            console.log(`   ⚠️  Error: ${error.message.split('\n')[0]}`);
        }
        console.log("");
    }
    
    // Step 5: Subscribe to BothApysQueried (for initialization)
    console.log("5️⃣  Subscribing to BothApysQueried Events:");
    console.log("");
    
    try {
        console.log("   Subscribing...");
        const tx = await rsc.subscribeToBothApys({ gasLimit: 500000 });
        console.log(`   Transaction: ${tx.hash}`);
        await tx.wait();
        console.log("   ✅ Subscribed to BothApysQueried");
        console.log("");
    } catch (error) {
        console.log(`   ⚠️  Error: ${error.message.split('\n')[0]}`);
        console.log("");
    }
    
    // Step 6: Check contract status
    console.log("6️⃣  Final Status:");
    console.log("");
    
    try {
        const status = await rsc.getContractStatus();
        console.log(`   Active: ${status[3] ? "✅" : "❌"}`);
        console.log(`   Reserves: ${ethers.utils.formatEther(status[1])} REACT`);
        console.log(`   Debt: ${ethers.utils.formatEther(status[4])} REACT`);
        console.log(`   Aave Subscribed: ${status[4] ? "✅" : "❌"}`);
        console.log(`   QueryHelper Subscribed: ${status[6] ? "✅" : "❌"}`);
        console.log("");
        
        if (!status[3]) {
            console.log("   ⚠️  Contract is NOT active - needs funding!");
            console.log("   Send REACT tokens to contract to activate");
            console.log("");
        }
    } catch (error) {
        console.log(`   ⚠️  Could not check status: ${error.message.split('\n')[0]}`);
        console.log("");
    }
    
    console.log("=".repeat(70));
    console.log("📋 NEXT STEPS");
    console.log("=".repeat(70));
    console.log("");
    console.log("1. Fund RSC with REACT tokens (if not active)");
    console.log("2. Call initializeStrategy() to trigger initial deployment");
    console.log("3. Monitor for events and capital deployment");
    console.log("");
    console.log("🔗 New RSC:", NEW_RSC);
    console.log(`   https://reactscan.io/address/${NEW_RSC}`);
    console.log("");
}

setupNewRSCFull().catch(console.error);

