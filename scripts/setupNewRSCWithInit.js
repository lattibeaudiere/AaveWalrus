const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function setupNewRSC() {
    console.log("=".repeat(70));
    console.log("🔧 SETTING UP NEW RSC WITH INITIALIZATION");
    console.log("=".repeat(70));
    console.log("");
    
    const RSC_ADDRESS = "0xf64afe64622CeAe79d48A15ebC49CC7FF416c688"; // New RSC
    const REACTIVE_RPC = process.env.REACTIVE_RPC || "https://reactive-network.rpc.thirdweb.com";
    const REACTIVE_PRIVATE_KEY = process.env.REACTIVE_PRIVATE_KEY;
    const SYSTEM_CONTRACT = "0x0000000000000000000000000000000000fffFfF";
    
    if (!REACTIVE_PRIVATE_KEY) {
        console.error("❌ ERROR: REACTIVE_PRIVATE_KEY must be set");
        process.exit(1);
    }
    
    const provider = new ethers.providers.JsonRpcProvider(REACTIVE_RPC);
    const wallet = new ethers.Wallet(REACTIVE_PRIVATE_KEY, provider);
    
    console.log("RSC Address:", RSC_ADDRESS);
    console.log("Wallet:", wallet.address);
    console.log("");
    
    // RSC ABI
    const rscAbi = [
        "function subscribeToAave() external",
        "function subscribeToQueryHelper() external",
        "function subscribeToBothApys() external",
        "function initializeStrategy() external",
        "function getContractStatus() external view returns (uint256, uint256, uint256, bool, bool, bool, bool, uint256, uint256)",
        "function initialized() external view returns (bool)"
    ];
    
    const rsc = new ethers.Contract(RSC_ADDRESS, rscAbi, wallet);
    
    // Step 1: Fund the contract
    console.log("1️⃣  Funding RSC Contract:");
    console.log("");
    
    const systemContractABI = [
        "function reserves(address contract_) external view returns (uint256)",
        "function debts(address contract_) external view returns (uint256)",
        "function depositTo(address contract_) external payable returns (uint256)"
    ];
    
    const systemContract = new ethers.Contract(SYSTEM_CONTRACT, systemContractABI, wallet);
    
    const debt = await systemContract.debts(RSC_ADDRESS);
    const minReserves = ethers.utils.parseEther("0.001");
    const amountNeeded = debt.add(minReserves);
    
    console.log(`   Debt: ${ethers.utils.formatEther(debt)} REACT`);
    console.log(`   Needed: ${ethers.utils.formatEther(amountNeeded)} REACT`);
    console.log("");
    
    const walletBalance = await provider.getBalance(wallet.address);
    if (walletBalance.lt(amountNeeded)) {
        console.log("   ⚠️  Insufficient balance!");
        console.log(`   Have: ${ethers.utils.formatEther(walletBalance)} REACT`);
        return;
    }
    
    console.log("   Funding...");
    const fundingAmount = debt.add(ethers.utils.parseEther("0.002"));
    const fundTx = await systemContract.depositTo(RSC_ADDRESS, {
        value: fundingAmount,
        gasLimit: 300000
    });
    
    console.log("   Transaction:", fundTx.hash);
    await fundTx.wait();
    console.log("   ✅ Funding complete!");
    console.log("");
    
    // Step 2: Subscribe to events
    console.log("2️⃣  Subscribing to Events:");
    console.log("");
    
    // Subscribe to Aave
    try {
        console.log("   Subscribing to Aave events...");
        const aaveTx = await rsc.subscribeToAave({ gasLimit: 500000 });
        console.log("   Transaction:", aaveTx.hash);
        await aaveTx.wait();
        console.log("   ✅ Subscribed to Aave");
    } catch (error) {
        if (error.message.includes("Already subscribed")) {
            console.log("   ✅ Already subscribed to Aave");
        } else {
            console.log("   ⚠️  Error:", error.message.split('\n')[0]);
        }
    }
    
    // Subscribe to QueryHelper
    try {
        console.log("   Subscribing to QueryHelper events...");
        const qhTx = await rsc.subscribeToQueryHelper({ gasLimit: 500000 });
        console.log("   Transaction:", qhTx.hash);
        await qhTx.wait();
        console.log("   ✅ Subscribed to QueryHelper");
    } catch (error) {
        if (error.message.includes("Already subscribed")) {
            console.log("   ✅ Already subscribed to QueryHelper");
        } else {
            console.log("   ⚠️  Error:", error.message.split('\n')[0]);
        }
    }
    
    // Subscribe to BothApysQueried (NEW!)
    try {
        console.log("   Subscribing to BothApysQueried events...");
        const bothTx = await rsc.subscribeToBothApys({ gasLimit: 500000 });
        console.log("   Transaction:", bothTx.hash);
        await bothTx.wait();
        console.log("   ✅ Subscribed to BothApysQueried");
    } catch (error) {
        if (error.message.includes("Already subscribed")) {
            console.log("   ✅ Already subscribed to BothApysQueried");
        } else {
            console.log("   ⚠️  Error:", error.message.split('\n')[0]);
        }
    }
    console.log("");
    
    // Step 3: Check status
    console.log("3️⃣  Checking RSC Status:");
    console.log("");
    
    const status = await rsc.getContractStatus();
    const initialized = await rsc.initialized();
    
    console.log(`   Active: ${status[3] ? "✅" : "❌"}`);
    console.log(`   Aave Subscribed: ${status[4] ? "✅" : "❌"}`);
    console.log(`   QueryHelper Subscribed: ${status[6] ? "✅" : "❌"}`);
    console.log(`   Initialized: ${initialized ? "✅" : "❌"}`);
    console.log("");
    
    // Step 4: Initialize strategy
    if (!initialized) {
        console.log("4️⃣  Initializing Strategy:");
        console.log("");
        console.log("   This will query current APYs and deploy if spread > 30 bps");
        console.log("");
        
        try {
            const initTx = await rsc.initializeStrategy({ gasLimit: 500000 });
            console.log("   Transaction:", initTx.hash);
            console.log("   Waiting for confirmation...");
            await initTx.wait();
            console.log("   ✅ Strategy initialized!");
            console.log("");
            console.log("   The RSC will now:");
            console.log("     1. Query current Aave and Compound APYs");
            console.log("     2. Compare spreads");
            console.log("     3. Deploy to highest yield if spread > 30 bps");
            console.log("");
        } catch (error) {
            console.log("   ❌ Initialization failed:", error.message.split('\n')[0]);
            if (error.message.includes("Already initialized")) {
                console.log("   (Strategy was already initialized)");
            }
        }
    } else {
        console.log("4️⃣  Strategy already initialized - skipping");
        console.log("");
    }
    
    console.log("=".repeat(70));
    console.log("✅ SETUP COMPLETE");
    console.log("=".repeat(70));
    console.log("");
    console.log("RSC Address:", RSC_ADDRESS);
    console.log("Status: Ready for operation");
    console.log("");
    console.log("Next: Monitor for deployment transactions");
    console.log("");
}

setupNewRSC().catch(console.error);

