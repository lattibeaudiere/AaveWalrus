const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const NEW_RSC = "0xAC66a994B8BB8b4a9aC90830Ac72207Cd22e7f21";
const NEW_ADAPTER = "0x58DB4C40CE50FEfAD8EEaA0B609e12dE21b18805";

async function setupFinal() {
    console.log("=".repeat(70));
    console.log("🚀 FINAL SYSTEM SETUP");
    console.log("=".repeat(70));
    console.log("");
    
    const reactiveProvider = new ethers.providers.JsonRpcProvider(
        process.env.REACTIVE_RPC || "https://mainnet-rpc.rnk.dev"
    );
    
    const wallet = new ethers.Wallet(
        process.env.REACTIVE_PRIVATE_KEY || process.env.PRIVATE_KEY,
        reactiveProvider
    );
    
    // Setup RSC
    console.log("1️⃣  Setting Up RSC:");
    console.log("   Address:", NEW_RSC);
    console.log("");
    
    const rsc = new ethers.Contract(
        NEW_RSC,
        [
            "function subscribeToAave() external",
            "function subscribeToQueryHelper() external",
            "function getSubscriptionStatus() external view returns (bool aaveActive, bool compoundActive, bool queryHelperActive)"
        ],
        wallet
    );
    
    // Subscribe
    const status = await rsc.getSubscriptionStatus();
    if (!status.aaveActive) {
        console.log("   Subscribing to Aave...");
        const tx1 = await rsc.subscribeToAave();
        await tx1.wait();
        console.log("   ✅ Subscribed to Aave");
    } else {
        console.log("   ✅ Already subscribed to Aave");
    }
    
    if (!status.queryHelperActive) {
        console.log("   Subscribing to QueryHelper...");
        const tx2 = await rsc.subscribeToQueryHelper();
        await tx2.wait();
        console.log("   ✅ Subscribed to QueryHelper");
    } else {
        console.log("   ✅ Already subscribed to QueryHelper");
    }
    
    console.log("");
    
    // Verify adapter targetVault
    console.log("2️⃣  Verifying Adapter:");
    const arbitrumProvider = new ethers.providers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc"
    );
    
    const arbitrumWallet = new ethers.Wallet(
        process.env.PRIVATE_KEY || process.env.ARBITRUM_PRIVATE_KEY,
        arbitrumProvider
    );
    
    const adapter = new ethers.Contract(
        NEW_ADAPTER,
        [
            "function targetVault() external view returns (address)"
        ],
        arbitrumWallet
    );
    
    const targetVault = await adapter.targetVault();
    console.log("   Adapter:", NEW_ADAPTER);
    console.log("   Target Vault:", targetVault);
    console.log("   ✅ Configured");
    console.log("");
    
    console.log("3️⃣  Final Status:");
    const finalStatus = await rsc.getSubscriptionStatus();
    console.log("   RSC Subscriptions:");
    console.log("     Aave:", finalStatus.aaveActive ? "✅" : "❌");
    console.log("     QueryHelper:", finalStatus.queryHelperActive ? "✅" : "❌");
    console.log("");
    
    if (finalStatus.aaveActive && finalStatus.queryHelperActive && targetVault !== ethers.constants.AddressZero) {
        console.log("   🎉 SYSTEM IS READY!");
        console.log("");
        console.log("Next Steps:");
        console.log("  1. Grant Alpha role to adapter via Vault Builder UI");
        console.log("  2. System will automatically process events");
        console.log("  3. Capital will deploy when spread > 30 bps");
    } else {
        console.log("   ⚠️  System not fully configured");
    }
    
    console.log("");
    console.log("=".repeat(70));
}

setupFinal().catch(console.error);

