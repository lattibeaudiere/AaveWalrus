const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function verifySystemStatus() {
    console.log("=".repeat(70));
    console.log("🔍 VERIFYING SYSTEM STATUS");
    console.log("=".repeat(70));
    console.log("");
    
    const OLD_RSC = "0xe39c19A077e33d1145F8Cc78d4235aE8114C640a";
    const NEW_RSC = "0xAC66a994B8BB8b4a9aC90830Ac72207Cd22e7f21";
    const ADAPTER = process.env.ADAPTER_ADDRESS || "0x58DB4C40CE50FEfAD8EEaA0B609e12dE21b18805";
    
    const reactiveProvider = new ethers.providers.JsonRpcProvider(
        process.env.REACTIVE_RPC || "https://reactive-network.rpc.thirdweb.com"
    );
    
    console.log("1️⃣  Checking RSC Status:");
    console.log("");
    
    const statusAbi = [
        "function getContractStatus() external view returns (uint256 directBalance, uint256 reserves, uint256 debt, bool isActive, bool aaveSub, bool compoundSub, bool queryHelperSub, uint256 lastAaveApy, uint256 cooldownRemaining)",
        "function adapter() external view returns (address)"
    ];
    
    for (const [name, address] of [["OLD RSC", OLD_RSC], ["NEW RSC", NEW_RSC]]) {
        console.log(`${name}: ${address}`);
        try {
            const rsc = new ethers.Contract(address, statusAbi, reactiveProvider);
            const status = await rsc.getContractStatus();
            const adapterAddress = await rsc.adapter();
            
            console.log(`  Active: ${status.isActive ? "✅" : "❌"}`);
            console.log(`  Aave Subscribed: ${status.aaveSub ? "✅" : "❌"}`);
            console.log(`  QueryHelper Subscribed: ${status.queryHelperSub ? "✅" : "❌"}`);
            console.log(`  Configured Adapter: ${adapterAddress}`);
            console.log(`  Matches new adapter: ${adapterAddress.toLowerCase() === ADAPTER.toLowerCase() ? "✅ YES" : "❌ NO"}`);
            console.log(`  Last Aave APY: ${status.lastAaveApy.toString()} bps`);
            console.log("");
            
            if (status.isActive && adapterAddress.toLowerCase() === ADAPTER.toLowerCase()) {
                console.log(`  ✅ THIS IS THE ACTIVE RSC!`);
                console.log("");
            }
            
        } catch (error) {
            console.log(`  ❌ Error: ${error.message.split('\n')[0]}`);
            console.log("");
        }
    }
    
    console.log("2️⃣  Checking Recent Activity:");
    console.log("");
    
    // Check which RSC is processing events
    const eventAbi = [
        "event StrategyUpdate(uint256 aaveApyBps, uint256 compoundApyBps, int256 spreadBps, bool rebalanced)"
    ];
    
    for (const [name, address] of [["OLD RSC", OLD_RSC], ["NEW RSC", NEW_RSC]]) {
        try {
            const rsc = new ethers.Contract(address, eventAbi, reactiveProvider);
            const currentBlock = await reactiveProvider.getBlockNumber();
            const events = await rsc.queryFilter(
                rsc.filters.StrategyUpdate(),
                Math.max(0, currentBlock - 5000)
            );
            
            console.log(`${name}:`);
            console.log(`  StrategyUpdate events: ${events.length}`);
            if (events.length > 0) {
                const latest = events[events.length - 1];
                console.log(`  Latest event block: ${latest.blockNumber}`);
            }
            console.log("");
            
        } catch (error) {
            console.log(`${name}: Error checking events`);
            console.log("");
        }
    }
    
    console.log("=".repeat(70));
    console.log("📊 SUMMARY");
    console.log("=".repeat(70));
    console.log("");
    console.log("Determine which RSC is:");
    console.log("  1. Active (has reserves > debt)");
    console.log("  2. Subscribed to events");
    console.log("  3. Configured with NEW adapter");
    console.log("  4. Processing events");
    console.log("");
}

verifySystemStatus().catch(console.error);

