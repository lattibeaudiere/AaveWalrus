const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function testCompoundInterface() {
    console.log("=".repeat(70));
    console.log("🔍 TESTING COMPOUND V3 INTERFACE");
    console.log("=".repeat(70));
    console.log("");
    
    const COMPOUND_USDC = "0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA";
    
    const provider = new ethers.providers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc"
    );
    
    console.log("Compound USDC:", COMPOUND_USDC);
    console.log("");
    
    // Test different function signatures
    const interfaces = [
        {
            name: "getUtilization()",
            abi: ["function getUtilization() external view returns (uint256)"]
        },
        {
            name: "supplyRate(uint256)",
            abi: ["function supplyRate(uint256 utilization) external view returns (uint256)"]
        },
        {
            name: "supplyRatePerSecond()",
            abi: ["function supplyRatePerSecond() external view returns (uint256)"]
        },
        {
            name: "getSupplyRate(uint256)",
            abi: ["function getSupplyRate(uint256 utilization) external view returns (uint256)"]
        },
        {
            name: "utilization()",
            abi: ["function utilization() external view returns (uint256)"]
        }
    ];
    
    console.log("1️⃣  Testing Function Signatures:");
    console.log("");
    
    for (const iface of interfaces) {
        try {
            const contract = new ethers.Contract(COMPOUND_USDC, iface.abi, provider);
            
            if (iface.name.includes("utilization")) {
                const result = await contract[iface.name.split('(')[0]]();
                console.log(`   ✅ ${iface.name}: ${result.toString()}`);
            } else if (iface.name.includes("supplyRatePerSecond")) {
                const result = await contract.supplyRatePerSecond();
                console.log(`   ✅ ${iface.name}: ${result.toString()}`);
            } else if (iface.name.includes("supplyRate") || iface.name.includes("getSupplyRate")) {
                // First get utilization
                try {
                    const utilContract = new ethers.Contract(
                        COMPOUND_USDC,
                        ["function utilization() external view returns (uint256)"],
                        provider
                    );
                    const utilization = await utilContract.utilization();
                    const result = await contract[iface.name.includes("supplyRate") ? "supplyRate" : "getSupplyRate"](utilization);
                    console.log(`   ✅ ${iface.name}: ${result.toString()}`);
                } catch (e) {
                    console.log(`   ⚠️  ${iface.name}: Needs utilization parameter`);
                }
            }
        } catch (error) {
            console.log(`   ❌ ${iface.name}: Not available`);
        }
    }
    
    console.log("");
    
    // Try the exact QueryHelper pattern
    console.log("2️⃣  Testing QueryHelper Pattern:");
    try {
        const queryHelper = new ethers.Contract(
            "0x7D0B3A06aE0ceaf35B658579A1F5730D3539f914",
            [
                "function queryCompoundApy(uint256 nonce) external returns (uint256 apyBps)",
                "function getCompoundApy() external view returns (uint256 apyBps)"
            ],
            provider
        );
        
        try {
            const apy = await queryHelper.getCompoundApy();
            console.log("   ✅ getCompoundApy():", apy.toString(), "bps");
        } catch (error) {
            console.log("   ❌ getCompoundApy() failed:", error.message.split('\n')[0]);
            
            // Try to identify the issue
            if (error.message.includes("getUtilization")) {
                console.log("   ⚠️  Issue: getUtilization() not available");
            } else if (error.message.includes("supplyRate")) {
                console.log("   ⚠️  Issue: supplyRate() not available");
            } else {
                console.log("   ⚠️  Unknown issue - check Compound contract");
            }
        }
    } catch (error) {
        console.log("   ❌ Error:", error.message.split('\n')[0]);
    }
    
    console.log("");
    
    // Check Compound contract directly
    console.log("3️⃣  Testing Compound Contract Directly:");
    try {
        // Try supplyRatePerSecond (known to work from checkAPYs.js)
        const compound = new ethers.Contract(
            COMPOUND_USDC,
            [
                "function supplyRatePerSecond() external view returns (uint256)",
                "function borrowRatePerSecond() external view returns (uint256)"
            ],
            provider
        );
        
        const supplyRate = await compound.supplyRatePerSecond();
        const borrowRate = await compound.borrowRatePerSecond();
        
        console.log("   ✅ supplyRatePerSecond():", supplyRate.toString());
        console.log("   ✅ borrowRatePerSecond():", borrowRate.toString());
        
        // Calculate APY
        const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;
        const RAY = ethers.BigNumber.from(10).pow(27);
        const apyBps = supplyRate.mul(SECONDS_PER_YEAR).mul(100).div(RAY);
        
        console.log("   Calculated APY:", apyBps.toString(), "bps");
        console.log("   APY (%):", (apyBps.toNumber() / 100).toFixed(2) + "%");
        
    } catch (error) {
        console.log("   ❌ Error:", error.message.split('\n')[0]);
    }
    
    console.log("");
    console.log("=".repeat(70));
    console.log("💡 SOLUTION");
    console.log("=".repeat(70));
    console.log("");
    console.log("QueryHelper needs to use supplyRatePerSecond() instead of:");
    console.log("  • getUtilization() + supplyRate(utilization)");
    console.log("");
    console.log("This is why callbacks are reverting!");
    console.log("");
}

testCompoundInterface().catch(console.error);

