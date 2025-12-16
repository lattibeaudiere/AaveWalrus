const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

/**
 * Check vault state and why funds aren't deployed
 */
async function checkVaultState() {
    console.log("=".repeat(70));
    console.log("🔍 CHECKING VAULT STATE");
    console.log("=".repeat(70));
    console.log("");
    
    const ARBITRUM_RPC = process.env.ARBITRUM_RPC || process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc";
    const VAULT_ADDRESS = process.env.TARGET_VAULT || "0xee29A26179fE20D5D202dAE4a279119E08edc60b";
    const ADAPTER_ADDRESS = process.env.ADAPTER_ADDRESS || "0xa60c91Aa6E0e203De3a6692a82eE65884B3B2D09";
    const RSC_ADDRESS = process.env.RSC_ADDRESS || "0xEFD20dC51F7c82B7430490Bf45767bA57F6819fc";
    
    const provider = new ethers.providers.JsonRpcProvider(ARBITRUM_RPC);
    
    // Check adapter for execution history
    console.log("=".repeat(70));
    console.log("1. ADAPTER EXECUTION HISTORY");
    console.log("=".repeat(70));
    console.log("");
    
    const adapterABI = [
        "event ReactionExecuted(address indexed rsc, address indexed vault, uint256 indexed chainId, bool success, bytes data)",
        "function getRSCConfig(address) view returns (tuple(address vault, uint256 targetChainId, bool isActive, uint256 lastExecution, uint256 executionCount))",
        "function isRSCRegistered(address) view returns (bool)"
    ];
    
    const adapter = new ethers.Contract(ADAPTER_ADDRESS, adapterABI, provider);
    
    try {
        const config = await adapter.getRSCConfig(RSC_ADDRESS);
        console.log("RSC Configuration:");
        console.log(`  Vault: ${config.vault}`);
        console.log(`  Active: ${config.isActive ? '✅ Yes' : '❌ No'}`);
        console.log(`  Executions: ${config.executionCount.toString()}`);
        console.log(`  Last Execution: ${config.lastExecution.toString()}`);
        
        if (config.lastExecution.toString() === '0') {
            console.log("");
            console.log("⚠️  NO EXECUTIONS YET!");
            console.log("   Adapter has never been called by RSC");
        } else {
            const lastExec = new Date(config.lastExecution.toNumber() * 1000);
            console.log(`  Last Execution Time: ${lastExec.toISOString()}`);
        }
    } catch (error) {
        console.error("❌ Error checking adapter:", error.message);
    }
    
    // Get recent ReactionExecuted events
    try {
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 10000);
        
        const filter = adapter.filters.ReactionExecuted(RSC_ADDRESS, VAULT_ADDRESS);
        const events = await adapter.queryFilter(filter, fromBlock, 'latest');
        
        console.log("");
        console.log(`Recent Executions: ${events.length}`);
        
        if (events.length > 0) {
            console.log("");
            for (let i = 0; i < Math.min(events.length, 5); i++) {
                const event = events[i];
                const block = await provider.getBlock(event.blockNumber);
                const parsed = adapter.interface.parseLog(event);
                
                console.log(`Execution ${i + 1}:`);
                console.log(`  Block: ${event.blockNumber}`);
                console.log(`  Time: ${new Date(block.timestamp * 1000).toISOString()}`);
                console.log(`  Success: ${parsed.args.success ? '✅ Yes' : '❌ No'}`);
                if (!parsed.args.success) {
                    console.log(`  Error: Check transaction receipt`);
                }
            }
        } else {
            console.log("⚠️  No execution events found");
            console.log("   RSC callbacks are not reaching adapter");
        }
    } catch (error) {
        console.error("❌ Error checking events:", error.message);
    }
    
    // Check for RSC callbacks on Arbitrum
    console.log("");
    console.log("=".repeat(70));
    console.log("2. RSC CALLBACK EXECUTION");
    console.log("=".repeat(70));
    console.log("");
    
    // Check QueryHelper for recent queries
    const queryHelper = "0x7D0B3A06aE0ceaf35B658579A1F5730D3539f914";
    const queryHelperABI = [
        "event CompoundApyQueried(uint256 indexed nonce, uint256 apyBps, uint256 timestamp)"
    ];
    
    try {
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 5000);
        
        const queryContract = new ethers.Contract(queryHelper, queryHelperABI, provider);
        const filter = queryContract.filters.CompoundApyQueried();
        const queryEvents = await queryContract.queryFilter(filter, fromBlock, 'latest');
        
        console.log(`QueryHelper Executions: ${queryEvents.length}`);
        
        if (queryEvents.length > 0) {
            console.log("");
            const latest = queryEvents[queryEvents.length - 1];
            const parsed = queryContract.interface.parseLog(latest);
            console.log("Latest Query:");
            console.log(`  Block: ${latest.blockNumber}`);
            console.log(`  Nonce: ${parsed.args.nonce.toString()}`);
            console.log(`  Compound APY: ${parsed.args.apyBps.toNumber() / 100}%`);
        } else {
            console.log("⚠️  No QueryHelper executions found");
            console.log("   Callbacks might not be executing on Arbitrum");
        }
    } catch (error) {
        console.error("❌ Error checking QueryHelper:", error.message);
    }
    
    // Check vault balance
    console.log("");
    console.log("=".repeat(70));
    console.log("3. VAULT BALANCE CHECK");
    console.log("=".repeat(70));
    console.log("");
    
    const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
    const usdcABI = ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"];
    
    try {
        const usdcContract = new ethers.Contract(USDC, usdcABI, provider);
        const balance = await usdcContract.balanceOf(VAULT_ADDRESS);
        const decimals = await usdcContract.decimals();
        const balanceFormatted = ethers.utils.formatUnits(balance, decimals);
        
        console.log(`Vault USDC Balance: ${balanceFormatted} USDC`);
        console.log(`  This confirms funds are in vault but not deployed`);
    } catch (error) {
        console.error("❌ Error checking vault balance:", error.message);
    }
    
    // Check Aave/Compound positions
    console.log("");
    console.log("=".repeat(70));
    console.log("4. CHECKING DEPLOYED POSITIONS");
    console.log("=".repeat(70));
    console.log("");
    
    // Check Aave position
    const AAVE_POOL = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
    const aaveABI = ["function getUserAccountData(address) view returns (uint256,uint256,uint256,uint256,uint256,uint256)"];
    
    try {
        const aavePool = new ethers.Contract(AAVE_POOL, aaveABI, provider);
        const accountData = await aavePool.getUserAccountData(VAULT_ADDRESS);
        const totalCollateralBase = ethers.utils.formatUnits(accountData[0], 8);
        
        console.log(`Aave Position:`);
        console.log(`  Total Collateral: ${totalCollateralBase}`);
        
        if (accountData[0].toString() === '0') {
            console.log("  ⚠️  No Aave position - funds not deployed to Aave");
        }
    } catch (error) {
        console.log(`  ❌ Error checking Aave: ${error.message}`);
    }
    
    console.log("");
    console.log("=".repeat(70));
    console.log("💡 DIAGNOSIS");
    console.log("=".repeat(70));
    console.log("");
    console.log("Based on the checks:");
    console.log("  1. Check if adapter has Alpha role on vault");
    console.log("  2. Check if RSC callbacks are executing on Arbitrum");
    console.log("  3. Check if spread threshold is being met");
    console.log("  4. Check for execution errors in adapter");
    console.log("");
}

checkVaultState().catch(console.error);

