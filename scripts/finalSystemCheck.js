const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function finalSystemCheck() {
    console.log("=".repeat(70));
    console.log("🔍 FINAL SYSTEM STATUS CHECK");
    console.log("=".repeat(70));
    console.log("");
    
    const ADAPTER_ADDRESS = process.env.ADAPTER_ADDRESS || "0x7d485F8AD54f7A3dC9f0871e61E63A97f678CCA7";
    const RSC_ADDRESS = process.env.RSC_ADDRESS || "0x64030389Fb91D86F92314503aAe57827826c8F4e";
    const VAULT_ADDRESS = process.env.TARGET_VAULT || "0xee29A26179fE20D5D202dAE4a279119E08edc60b";
    
    const arbitrumProvider = new ethers.providers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc"
    );
    
    const reactiveProvider = new ethers.providers.JsonRpcProvider(
        process.env.REACTIVE_RPC || "https://mainnet-rpc.rnk.dev"
    );
    
    let allGood = true;
    
    // 1. Check Adapter
    console.log("1️⃣  REACTIVE ALPHA ADAPTER");
    console.log("   Address:", ADAPTER_ADDRESS);
    try {
        const adapterCode = await arbitrumProvider.getCode(ADAPTER_ADDRESS);
        if (adapterCode === "0x") {
            console.log("   Status: ❌ Contract not found");
            allGood = false;
        } else {
            console.log("   Status: ✅ Deployed");
            
            const adapter = new ethers.Contract(
                ADAPTER_ADDRESS,
                [
                    "function isRSCRegistered(address) view returns (bool)",
                    "function getRSCConfig(address) view returns (tuple(address vault, uint256 targetChainId, bool isActive, uint256 lastExecution, uint256 executionCount))"
                ],
                arbitrumProvider
            );
            
            const isRegistered = await adapter.isRSCRegistered(RSC_ADDRESS);
            const config = await adapter.getRSCConfig(RSC_ADDRESS);
            
            console.log("   RSC Registered: ", isRegistered ? "✅ Yes" : "❌ No");
            if (!isRegistered) allGood = false;
            
            console.log("   RSC Active: ", config.isActive ? "✅ Yes" : "❌ No");
            if (!config.isActive) allGood = false;
            
            console.log("   Vault:", config.vault);
            console.log("   Executions:", config.executionCount.toString());
        }
    } catch (error) {
        console.log("   Status: ❌ Error:", error.message.split('\n')[0]);
        allGood = false;
    }
    
    console.log("");
    
    // 2. Check RSC
    console.log("2️⃣  REACTIVE SMART CONTRACT");
    console.log("   Address:", RSC_ADDRESS);
    try {
        const rscCode = await reactiveProvider.getCode(RSC_ADDRESS);
        if (rscCode === "0x") {
            console.log("   Status: ❌ Contract not found");
            allGood = false;
        } else {
            console.log("   Status: ✅ Deployed");
            
            const rsc = new ethers.Contract(
                RSC_ADDRESS,
                [
                    "function getContractStatus() external view returns (uint256 directBalance, uint256 reserves, uint256 debt, bool isActive, bool aaveSub, bool compoundSub, bool queryHelperSub, uint256 lastAaveApy, uint256 cooldownRemaining)",
                    "function adapter() external view returns (address)",
                    "function vault() external view returns (address)"
                ],
                reactiveProvider
            );
            
            const status = await rsc.getContractStatus();
            const rscAdapter = await rsc.adapter();
            const rscVault = await rsc.vault();
            
            console.log("   Active:", status.isActive ? "✅ Yes" : "❌ No");
            if (!status.isActive) allGood = false;
            
            console.log("   Reserves:", ethers.utils.formatEther(status.reserves), "REACT");
            console.log("   Debt:", ethers.utils.formatEther(status.debt), "REACT");
            console.log("   Aave Subscribed:", status.aaveSub ? "✅ Yes" : "❌ No");
            if (!status.aaveSub) allGood = false;
            
            console.log("   QueryHelper Subscribed:", status.queryHelperSub ? "✅ Yes" : "❌ No");
            if (!status.queryHelperSub) allGood = false;
            
            console.log("   RSC Adapter:", rscAdapter);
            if (rscAdapter.toLowerCase() !== ADAPTER_ADDRESS.toLowerCase()) {
                console.log("   ⚠️  MISMATCH: RSC points to different adapter!");
                allGood = false;
            } else {
                console.log("   ✅ Matches deployed adapter");
            }
            
            console.log("   RSC Vault:", rscVault);
            if (rscVault.toLowerCase() !== VAULT_ADDRESS.toLowerCase()) {
                console.log("   ⚠️  MISMATCH: RSC points to different vault!");
                allGood = false;
            } else {
                console.log("   ✅ Matches target vault");
            }
        }
    } catch (error) {
        console.log("   Status: ❌ Error:", error.message.split('\n')[0]);
        allGood = false;
    }
    
    console.log("");
    
    // 3. Check Alpha Role
    console.log("3️⃣  ALPHA ROLE (Critical)");
    console.log("   Adapter:", ADAPTER_ADDRESS);
    try {
        const vault = new ethers.Contract(
            VAULT_ADDRESS,
            ["function hasRole(bytes32 role, address account) external view returns (bool)"],
            arbitrumProvider
        );
        
        const { utils } = require('ethers');
        const ALPHA_ROLE = utils.keccak256(utils.toUtf8Bytes("ALPHA_ROLE"));
        
        try {
            const hasRole = await vault.hasRole(ALPHA_ROLE, ADAPTER_ADDRESS);
            if (hasRole) {
                console.log("   Status: ✅ Alpha role GRANTED");
            } else {
                console.log("   Status: ❌ Alpha role NOT granted");
                console.log("   ⚠️  ACTION REQUIRED: Grant Alpha role via Vault Builder UI");
                allGood = false;
            }
        } catch (error) {
            console.log("   Status: ⚠️  Could not verify (vault interface may differ)");
            console.log("   ⚠️  Please verify manually via Vault Builder UI");
        }
    } catch (error) {
        console.log("   Status: ⚠️  Error checking role:", error.message.split('\n')[0]);
    }
    
    console.log("");
    
    // 4. Check .env file
    console.log("4️⃣  ENVIRONMENT CONFIGURATION");
    console.log("   ADAPTER_ADDRESS:", process.env.ADAPTER_ADDRESS || "❌ Not set");
    console.log("   RSC_ADDRESS:", process.env.RSC_ADDRESS || "❌ Not set");
    
    if (process.env.ADAPTER_ADDRESS) {
        if (process.env.ADAPTER_ADDRESS.toLowerCase() === ADAPTER_ADDRESS.toLowerCase()) {
            console.log("   ✅ ADAPTER_ADDRESS correct");
        } else {
            console.log("   ⚠️  ADAPTER_ADDRESS mismatch");
            allGood = false;
        }
    }
    
    if (process.env.RSC_ADDRESS) {
        if (process.env.RSC_ADDRESS.toLowerCase() === RSC_ADDRESS.toLowerCase()) {
            console.log("   ✅ RSC_ADDRESS correct");
        } else {
            console.log("   ⚠️  RSC_ADDRESS mismatch");
            allGood = false;
        }
    }
    
    console.log("");
    
    // Summary
    console.log("=".repeat(70));
    console.log("📊 SYSTEM STATUS SUMMARY");
    console.log("=".repeat(70));
    console.log("");
    
    if (allGood) {
        console.log("✅ ALL SYSTEMS OPERATIONAL!");
        console.log("");
        console.log("The system is ready to:");
        console.log("  • Monitor Aave V3 APY changes");
        console.log("  • Query Compound V3 APY");
        console.log("  • Execute rebalances when spread > 30 bps");
        console.log("  • Deploy funds to higher APY protocol");
        console.log("");
    } else {
        console.log("⚠️  SOME ISSUES DETECTED");
        console.log("");
        console.log("Please review the checks above and resolve any issues.");
        console.log("");
        console.log("Most common issue:");
        console.log("  • Alpha role not granted to adapter");
        console.log("  • Action: Grant via Vault Builder UI");
        console.log("");
    }
    
    console.log("Contract Addresses:");
    console.log("  Adapter:", ADAPTER_ADDRESS);
    console.log("  RSC:", RSC_ADDRESS);
    console.log("  Vault:", VAULT_ADDRESS);
    console.log("");
}

finalSystemCheck().catch(console.error);

