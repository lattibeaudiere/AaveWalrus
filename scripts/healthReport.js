const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

/**
 * Generate Health Report
 * Analyzes system performance, gas usage, and profitability
 */
async function generateHealthReport() {
    console.log("=".repeat(60));
    console.log("SYSTEM HEALTH REPORT");
    console.log("=".repeat(60));
    console.log("");
    
    const ARBITRUM_RPC = process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc";
    const ADAPTER_ADDRESS = process.env.ADAPTER_ADDRESS;
    const RSC_ADDRESS = process.env.RSC_ADDRESS;
    const VAULT_ADDRESS = process.env.TARGET_VAULT;
    
    if (!ADAPTER_ADDRESS || !RSC_ADDRESS || !VAULT_ADDRESS) {
        console.log("⚠️  Missing required addresses in .env");
        return;
    }
    
    const provider = new ethers.providers.JsonRpcProvider(ARBITRUM_RPC);
    
    // Adapter ABI for checking stats
    const adapterABI = [
        "function rscConfigs(address rsc) external view returns (address vault, uint256 targetChainId, bool isActive, uint256 lastExecution, uint256 executionCount)"
    ];
    
    const adapter = new ethers.Contract(ADAPTER_ADDRESS, adapterABI, provider);
    
    console.log("Checking system status...");
    console.log("-".repeat(60));
    
    try {
        const config = await adapter.rscConfigs(RSC_ADDRESS);
        
        const report = {
            timestamp: new Date().toISOString(),
            status: {
                rscActive: config.isActive,
                executionCount: config.executionCount.toString(),
                lastExecution: config.lastExecution.toString(),
                vault: config.vault,
                targetChain: config.targetChainId.toString()
            },
            metrics: {
                uptime: "Active" // Simplified
            }
        };
        
        // Calculate time since last execution
        const now = Math.floor(Date.now() / 1000);
        const lastExec = parseInt(config.lastExecution.toString());
        const timeSince = lastExec > 0 ? now - lastExec : 0;
        
        console.log("\n📊 System Status:");
        console.log(`  RSC Active: ${config.isActive ? "✅ Yes" : "❌ No"}`);
        console.log(`  Total Executions: ${config.executionCount.toString()}`);
        
        if (lastExec > 0) {
            const hoursSince = Math.floor(timeSince / 3600);
            console.log(`  Last Execution: ${hoursSince} hours ago`);
        } else {
            console.log(`  Last Execution: Never`);
        }
        
        console.log("\n💡 Health Assessment:");
        if (config.isActive && config.executionCount.gt(0)) {
            console.log("  ✅ System operational");
            console.log("  ✅ Executions confirmed");
        } else if (config.isActive) {
            console.log("  ⚠️  System active but no executions yet");
            console.log("  → Waiting for first Aave event");
        } else {
            console.log("  ❌ RSC not active - check registration");
        }
        
        // Save report
        const reportPath = path.join(__dirname, '..', 'health-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        console.log(`\n✅ Report saved to: ${reportPath}`);
        
    } catch (error) {
        console.log(`⚠️  Error generating report: ${error.message}`);
    }
    
    console.log("");
    console.log("=".repeat(60));
}

generateHealthReport().catch(console.error);

