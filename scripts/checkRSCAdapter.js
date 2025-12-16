const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function checkRSCAdapter() {
    const RSC_ADDRESS = process.env.RSC_ADDRESS || "0xe39c19A077e33d1145F8Cc78d4235aE8114C640a";
    const OLD_ADAPTER = "0x7d485F8AD54f7A3dC9f0871e61E63A97f678CCA7";
    const NEW_ADAPTER = "0xA7a71255FfBE943b6107354684b78C26bF0cf161";
    
    const reactiveProvider = new ethers.providers.JsonRpcProvider(
        process.env.REACTIVE_RPC || "https://mainnet-rpc.rnk.dev"
    );
    
    console.log("=".repeat(70));
    console.log("🔍 CHECKING RSC ADAPTER CONFIGURATION");
    console.log("=".repeat(70));
    console.log("");
    console.log("RSC Address:", RSC_ADDRESS);
    console.log("Old Adapter:", OLD_ADAPTER);
    console.log("New Adapter:", NEW_ADAPTER);
    console.log("");
    
    const rsc = new ethers.Contract(
        RSC_ADDRESS,
        [
            "function adapter() external view returns (address)",
            "function vault() external view returns (address)"
        ],
        reactiveProvider
    );
    
    try {
        const rscAdapter = await rsc.adapter();
        const rscVault = await rsc.vault();
        
        console.log("RSC Configuration:");
        console.log("  Adapter:", rscAdapter);
        console.log("  Vault:", rscVault);
        console.log("");
        
        if (rscAdapter.toLowerCase() === OLD_ADAPTER.toLowerCase()) {
            console.log("⚠️  RSC is configured with OLD adapter!");
            console.log("");
            console.log("This means:");
            console.log("  • RSC will emit callbacks to OLD adapter");
            console.log("  • Need to register in OLD adapter (not NEW)");
            console.log("  • OR redeploy RSC with NEW adapter");
        } else if (rscAdapter.toLowerCase() === NEW_ADAPTER.toLowerCase()) {
            console.log("✅ RSC is configured with NEW adapter!");
            console.log("");
            console.log("This means:");
            console.log("  • RSC will emit callbacks to NEW adapter");
            console.log("  • Need to register in NEW adapter");
        } else {
            console.log("⚠️  RSC is configured with UNKNOWN adapter!");
            console.log("  Adapter:", rscAdapter);
        }
        
        console.log("");
        console.log("Recommendation:");
        console.log("  Register RSC in adapter:", rscAdapter);
        
    } catch (error) {
        console.log("❌ Error:", error.message.split('\n')[0]);
    }
    
    console.log("");
    console.log("=".repeat(70));
}

checkRSCAdapter().catch(console.error);

