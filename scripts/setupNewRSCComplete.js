const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function setupNewRSCComplete() {
    console.log("=".repeat(70));
    console.log("🚀 COMPLETE SETUP FOR NEW RSC");
    console.log("=".repeat(70));
    console.log("");
    
    const NEW_RSC = "0xEA271374BdFB7a0f2962175Ea66F0A6c247089e6";
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
    
    // Check RSC status
    const rscAbi = [
        "function queryHelper() external view returns (address)",
        "function adapter() external view returns (address)",
        "function vault() external view returns (address)",
        "function getSubscriptionStatus() external view returns (bool aaveSub, bool compoundSub, bool queryHelperSub)"
    ];
    
    try {
        const rsc = new ethers.Contract(NEW_RSC, rscAbi, reactiveProvider);
        
        const queryHelper = await rsc.queryHelper();
        const adapter = await rsc.adapter();
        const vault = await rsc.vault();
        
        console.log("RSC Configuration:");
        console.log(`  QueryHelper: ${queryHelper}`);
        console.log(`  Expected: ${NEW_QUERY_HELPER}`);
        console.log(`  Match: ${queryHelper.toLowerCase() === NEW_QUERY_HELPER.toLowerCase() ? "✅" : "❌"}`);
        console.log("");
        console.log(`  Adapter: ${adapter}`);
        console.log(`  Vault: ${vault}`);
        console.log("");
        
        if (queryHelper.toLowerCase() !== NEW_QUERY_HELPER.toLowerCase()) {
            console.log("⚠️  WARNING: RSC is using OLD QueryHelper address!");
            console.log("   The deployment must have used cached environment variables");
            console.log("   Need to redeploy with correct QueryHelper address");
            console.log("");
        } else {
            console.log("✅ RSC is configured with NEW QueryHelper!");
            console.log("");
            
            // Check subscription status
            try {
                const status = await rsc.getSubscriptionStatus();
                console.log("Subscription Status:");
                console.log(`  Aave: ${status[0] ? "✅" : "❌"}`);
                console.log(`  Compound: ${status[1] ? "✅" : "❌"}`);
                console.log(`  QueryHelper: ${status[2] ? "✅" : "❌"}`);
                console.log("");
            } catch (error) {
                console.log("⚠️  Could not check subscription status");
                console.log("");
            }
        }
        
    } catch (error) {
        console.log(`❌ Error checking RSC: ${error.message.split('\n')[0]}`);
        console.log("");
    }
    
    console.log("=".repeat(70));
    console.log("📋 NEXT STEPS");
    console.log("=".repeat(70));
    console.log("");
    console.log("If RSC has correct QueryHelper:");
    console.log("  1. Fund RSC with REACT tokens");
    console.log("  2. Subscribe to Aave events");
    console.log("  3. Subscribe to QueryHelper events");
    console.log("  4. Initialize strategy");
    console.log("");
    console.log("If RSC has OLD QueryHelper:");
    console.log("  1. Redeploy RSC with correct QueryHelper address");
    console.log("  2. Then follow steps above");
    console.log("");
}

setupNewRSCComplete().catch(console.error);
