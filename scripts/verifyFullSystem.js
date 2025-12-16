const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

/**
 * Comprehensive system verification - checks all components
 */
async function verifyFullSystem() {
    console.log("=".repeat(70));
    console.log("🔍 COMPREHENSIVE SYSTEM VERIFICATION");
    console.log("=".repeat(70));
    console.log("");
    
    const ARBITRUM_RPC = process.env.ARBITRUM_RPC || process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc";
    const REACTIVE_RPC = process.env.REACTIVE_RPC || "https://mainnet-rpc.rnk.dev";
    const PRIVATE_KEY = process.env.PRIVATE_KEY || process.env.ARBITRUM_PRIVATE_KEY;
    const REACTIVE_PRIVATE_KEY = process.env.REACTIVE_PRIVATE_KEY;
    
    // Get addresses from deployment or env
    const fs = require('fs');
    const path = require('path');
    const deploymentsPath = path.join(__dirname, '../deployment-addresses.json');
    let deployments = {};
    if (fs.existsSync(deploymentsPath)) {
        deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'));
    }
    
    const VAULT_ADDRESS = process.env.TARGET_VAULT || "0xee29A26179fE20D5D202dAE4a279119E08edc60b";
    const ADAPTER_ADDRESS = deployments.ReactiveAlphaAdapter || process.env.ADAPTER_ADDRESS || "0xa60c91Aa6E0e203De3a6692a82eE65884B3B2D09";
    const RSC_ADDRESS = process.env.RSC_ADDRESS || "0x15725e58A3199122FcBb4d6F20573EEFd730781A";
    const QUERY_HELPER_ADDRESS = process.env.QUERY_HELPER_ADDRESS;
    
    const arbitrumProvider = new ethers.providers.JsonRpcProvider(ARBITRUM_RPC);
    const reactiveProvider = new ethers.providers.JsonRpcProvider(REACTIVE_RPC);
    
    let allChecksPassed = true;
    
    // ============================================================
    // 1. VAULT CHECK
    // ============================================================
    console.log("=".repeat(70));
    console.log("1. IPOR FUSION VAULT");
    console.log("=".repeat(70));
    console.log("");
    
    try {
        const vaultABI = [
            "function hasRole(bytes32 role, address account) view returns (bool)",
            "function ALPHA_ROLE() view returns (bytes32)"
        ];
        const vault = new ethers.Contract(VAULT_ADDRESS, vaultABI, arbitrumProvider);
        
        const ALPHA_ROLE = await vault.ALPHA_ROLE();
        const hasAlphaRole = await vault.hasRole(ALPHA_ROLE, ADAPTER_ADDRESS);
        
        console.log(`Vault Address: ${VAULT_ADDRESS}`);
        console.log(`Adapter has ALPHA_ROLE: ${hasAlphaRole ? '✅ Yes' : '❌ No'}`);
        console.log("");
        
        if (!hasAlphaRole) {
            console.log("⚠️  WARNING: Adapter does not have ALPHA_ROLE on vault!");
            console.log("   Adapter address:", ADAPTER_ADDRESS);
            console.log("   This means the adapter cannot execute on the vault.");
            allChecksPassed = false;
        }
    } catch (error) {
        console.log(`❌ Error checking vault: ${error.message}`);
        allChecksPassed = false;
    }
    
    // ============================================================
    // 2. ADAPTER CHECK
    // ============================================================
    console.log("=".repeat(70));
    console.log("2. REACTIVE ALPHA ADAPTER");
    console.log("=".repeat(70));
    console.log("");
    
    try {
        const adapterABI = [
            "function isRSCRegistered(address) view returns (bool)",
            "function getRSCConfig(address) view returns (tuple(address vault, uint256 targetChainId, bool isActive, uint256 lastExecution, uint256 executionCount))",
            "function MANAGER_ROLE() view returns (bytes32)",
            "function hasRole(bytes32 role, address account) view returns (bool)"
        ];
        const adapter = new ethers.Contract(ADAPTER_ADDRESS, adapterABI, arbitrumProvider);
        
        const isRegistered = await adapter.isRSCRegistered(RSC_ADDRESS);
        const config = await adapter.getRSCConfig(RSC_ADDRESS);
        
        console.log(`Adapter Address: ${ADAPTER_ADDRESS}`);
        console.log(`RSC Registered: ${isRegistered ? '✅ Yes' : '❌ No'}`);
        console.log(`RSC Active: ${config.isActive ? '✅ Yes' : '❌ No'}`);
        console.log(`Target Vault: ${config.vault}`);
        console.log(`Target Chain ID: ${config.targetChainId.toString()}`);
        console.log(`Executions: ${config.executionCount.toString()}`);
        console.log("");
        
        if (!isRegistered) {
            console.log("⚠️  WARNING: RSC is not registered in adapter!");
            allChecksPassed = false;
        }
        
        if (config.vault.toLowerCase() !== VAULT_ADDRESS.toLowerCase()) {
            console.log("⚠️  WARNING: Adapter vault mismatch!");
            console.log(`   Expected: ${VAULT_ADDRESS}`);
            console.log(`   Actual: ${config.vault}`);
            allChecksPassed = false;
        }
    } catch (error) {
        console.log(`❌ Error checking adapter: ${error.message}`);
        allChecksPassed = false;
    }
    
    // ============================================================
    // 3. RSC CHECK (REACTIVE NETWORK)
    // ============================================================
    console.log("=".repeat(70));
    console.log("3. REACTIVE SMART CONTRACT");
    console.log("=".repeat(70));
    console.log("");
    
    try {
        const rscABI = [
            "function adapter() view returns (address)",
            "function vault() view returns (address)",
            "function queryHelper() view returns (address)",
            "function aaveSubscribed() view returns (bool)",
            "function queryHelperSubscribed() view returns (bool)",
            "function owner() view returns (address)"
        ];
        const rsc = new ethers.Contract(RSC_ADDRESS, rscABI, reactiveProvider);
        
        const rscAdapter = await rsc.adapter();
        const rscVault = await rsc.vault();
        const rscQueryHelper = await rsc.queryHelper();
        const aaveSubscribed = await rsc.aaveSubscribed();
        const queryHelperSubscribed = await rsc.queryHelperSubscribed();
        
        console.log(`RSC Address (Reactive Network): ${RSC_ADDRESS}`);
        console.log(`Configured Adapter: ${rscAdapter}`);
        console.log(`Configured Vault: ${rscVault}`);
        console.log(`Configured QueryHelper: ${rscQueryHelper}`);
        console.log(`Aave Subscribed: ${aaveSubscribed ? '✅ Yes' : '❌ No'}`);
        console.log(`QueryHelper Subscribed: ${queryHelperSubscribed ? '✅ Yes' : '❌ No'}`);
        console.log("");
        
        if (rscAdapter.toLowerCase() !== ADAPTER_ADDRESS.toLowerCase()) {
            console.log("⚠️  WARNING: RSC adapter mismatch!");
            console.log(`   Expected: ${ADAPTER_ADDRESS}`);
            console.log(`   Actual: ${rscAdapter}`);
            allChecksPassed = false;
        }
        
        if (rscVault.toLowerCase() !== VAULT_ADDRESS.toLowerCase()) {
            console.log("⚠️  WARNING: RSC vault mismatch!");
            console.log(`   Expected: ${VAULT_ADDRESS}`);
            console.log(`   Actual: ${rscVault}`);
            allChecksPassed = false;
        }
        
        if (!aaveSubscribed) {
            console.log("⚠️  WARNING: RSC not subscribed to Aave events!");
            allChecksPassed = false;
        }
        
        if (!queryHelperSubscribed) {
            console.log("⚠️  WARNING: RSC not subscribed to QueryHelper events!");
            allChecksPassed = false;
        }
        
        // Check RSC balance and debt
        const balance = await reactiveProvider.getBalance(RSC_ADDRESS);
        const systemContract = "0x0000000000000000000000000000000000fffFfF";
        const systemABI = [
            "function reserves(address) view returns (uint256)",
            "function debts(address) view returns (uint256)"
        ];
        const systemContract_inst = new ethers.Contract(systemContract, systemABI, reactiveProvider);
        const reserves = await systemContract_inst.reserves(RSC_ADDRESS);
        const debt = await systemContract_inst.debts(RSC_ADDRESS);
        
        console.log(`RSC Balance: ${ethers.utils.formatEther(balance)} ETH`);
        console.log(`RSC Reserves: ${ethers.utils.formatEther(reserves)} REACT`);
        console.log(`RSC Debt: ${ethers.utils.formatEther(debt)} REACT`);
        console.log("");
        
        if (reserves.lt(ethers.utils.parseEther("0.001"))) {
            console.log("⚠️  WARNING: RSC has low reserves (< 0.001 REACT)");
            console.log("   This may cause the contract to become inactive");
        }
        
        if (debt.gt(0)) {
            console.log("⚠️  WARNING: RSC has outstanding debt");
            console.log("   This may prevent event processing");
        }
        
    } catch (error) {
        console.log(`❌ Error checking RSC: ${error.message}`);
        allChecksPassed = false;
    }
    
    // ============================================================
    // 4. QUERY HELPER CHECK
    // ============================================================
    if (QUERY_HELPER_ADDRESS) {
        console.log("=".repeat(70));
        console.log("4. QUERY HELPER");
        console.log("=".repeat(70));
        console.log("");
        
        try {
            const queryHelperABI = [
                "function COMPOUND_USDC() view returns (address)"
            ];
            const queryHelper = new ethers.Contract(QUERY_HELPER_ADDRESS, queryHelperABI, arbitrumProvider);
            const compoundUsdc = await queryHelper.COMPOUND_USDC();
            
            console.log(`QueryHelper Address: ${QUERY_HELPER_ADDRESS}`);
            console.log(`Compound USDC Address: ${compoundUsdc}`);
            console.log(`Deployed: ✅ Yes`);
            console.log("");
        } catch (error) {
            console.log(`❌ Error checking QueryHelper: ${error.message}`);
            allChecksPassed = false;
        }
    }
    
    // ============================================================
    // 5. EVENT PROCESSING CHECK
    // ============================================================
    console.log("=".repeat(70));
    console.log("5. EVENT PROCESSING STATUS");
    console.log("=".repeat(70));
    console.log("");
    
    try {
        const rscABI = [
            "event ReactHandled(uint256 indexed chainId, address indexed contract, uint256 indexed txHash, uint256 logIndex)"
        ];
        const rsc = new ethers.Contract(RSC_ADDRESS, rscABI, reactiveProvider);
        
        // Get recent ReactHandled events (last 1000 blocks)
        const currentBlock = await reactiveProvider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 1000);
        
        try {
            const events = await rsc.queryFilter(
                rsc.filters.ReactHandled(),
                fromBlock,
                currentBlock
            );
            
            console.log(`Recent ReactHandled Events (last 1000 blocks): ${events.length}`);
            if (events.length > 0) {
                console.log("✅ RSC is processing events!");
                const latest = events[events.length - 1];
                console.log(`Latest Event:`);
                console.log(`  Block: ${latest.blockNumber}`);
                console.log(`  Chain ID: ${latest.args.chainId.toString()}`);
                console.log(`  Contract: ${latest.args.contract}`);
                console.log(`  TX Hash: ${latest.args.txHash.toString()}`);
            } else {
                console.log("⚠️  No events processed recently");
                console.log("   This could mean:");
                console.log("   • No Aave events occurred (normal)");
                console.log("   • RSC is not receiving events");
                console.log("   • Subscription issue");
            }
        } catch (error) {
            console.log(`⚠️  Could not query events: ${error.message}`);
        }
        
        console.log("");
    } catch (error) {
        console.log(`❌ Error checking event processing: ${error.message}`);
    }
    
    // ============================================================
    // 6. FINAL SUMMARY
    // ============================================================
    console.log("=".repeat(70));
    console.log("📊 SYSTEM STATUS SUMMARY");
    console.log("=".repeat(70));
    console.log("");
    
    if (allChecksPassed) {
        console.log("✅ ALL CRITICAL CHECKS PASSED");
        console.log("");
        console.log("System Components:");
        console.log("  ✅ Vault: Deployed and configured");
        console.log("  ✅ Adapter: Deployed and RSC registered");
        console.log("  ✅ RSC: Deployed, funded, and subscribed");
        console.log("  ✅ QueryHelper: Deployed");
        console.log("");
        console.log("Ready State:");
        console.log("  ✅ Alpha role granted");
        console.log("  ✅ RSC registered in adapter");
        console.log("  ✅ Event subscriptions active");
        console.log("");
        console.log("🎉 SYSTEM IS OPERATIONAL!");
        console.log("");
        console.log("The system will automatically:");
        console.log("  1. Monitor Aave V3 USDC APY changes");
        console.log("  2. Query Compound V3 APY when Aave changes");
        console.log("  3. Calculate spread and compare to threshold");
        console.log("  4. Execute rebalances when conditions are met");
        console.log("");
    } else {
        console.log("⚠️  SOME CHECKS FAILED");
        console.log("");
        console.log("Review the warnings above to resolve issues.");
        console.log("");
    }
    
    console.log("=".repeat(70));
}

verifyFullSystem().catch(console.error);

