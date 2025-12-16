const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function testCompoundContract() {
    console.log("=".repeat(70));
    console.log("🔍 TESTING COMPOUND CONTRACT");
    console.log("=".repeat(70));
    console.log("");
    
    const COMPOUND_USDC = "0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA";
    
    const arbitrumProvider = new ethers.providers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc"
    );
    
    console.log("Compound USDC Address:", COMPOUND_USDC);
    console.log("");
    
    // Check if contract exists
    console.log("1️⃣  Checking Contract Existence:");
    console.log("");
    
    try {
        const code = await arbitrumProvider.getCode(COMPOUND_USDC);
        if (code === "0x") {
            console.log("   ❌ Contract doesn't exist!");
            return;
        }
        console.log(`   ✅ Contract exists (${code.length / 2 - 1} bytes)`);
        console.log("");
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        return;
    }
    
    // Try different Compound V3 function signatures
    console.log("2️⃣  Testing Different Function Signatures:");
    console.log("");
    
    const functionSignatures = [
        "function supplyRatePerSecond() external view returns (uint256)",
        "function getSupplyRate() external view returns (uint256)",
        "function getUtilization() external view returns (uint256)",
        "function totalSupply() external view returns (uint256)",
        "function totalBorrow() external view returns (uint256)",
        "function baseToken() external view returns (address)",
        "function name() external view returns (string)",
    ];
    
    for (const sig of functionSignatures) {
        try {
            const iface = new ethers.utils.Interface([sig]);
            const contract = new ethers.Contract(COMPOUND_USDC, iface, arbitrumProvider);
            
            // Try to get the function name
            const funcName = sig.split("(")[0].replace("function ", "");
            
            try {
                const result = await contract[funcName]();
                console.log(`   ✅ ${funcName}(): ${result.toString()}`);
            } catch (error) {
                console.log(`   ❌ ${funcName}(): ${error.message.split('\n')[0]}`);
            }
        } catch (error) {
            console.log(`   ⚠️  Error testing ${sig}: ${error.message.split('\n')[0]}`);
        }
    }
    
    console.log("");
    
    // Try to get contract info from Arbiscan/Etherscan API
    console.log("3️⃣  Checking Contract on Arbiscan:");
    console.log("");
    console.log(`   🔗 https://arbiscan.io/address/${COMPOUND_USDC}`);
    console.log("");
    console.log("   Look for:");
    console.log("   • Contract name and type");
    console.log("   • Verified source code");
    console.log("   • Available functions");
    console.log("");
    
    // Try calling a standard ERC20 function to verify it's a contract
    console.log("4️⃣  Testing Standard Functions:");
    console.log("");
    
    const erc20Abi = [
        "function name() external view returns (string)",
        "function symbol() external view returns (string)",
        "function decimals() external view returns (uint8)"
    ];
    
    try {
        const erc20 = new ethers.Contract(COMPOUND_USDC, erc20Abi, arbitrumProvider);
        const name = await erc20.name();
        const symbol = await erc20.symbol();
        const decimals = await erc20.decimals();
        
        console.log(`   ✅ Contract is responsive`);
        console.log(`   Name: ${name}`);
        console.log(`   Symbol: ${symbol}`);
        console.log(`   Decimals: ${decimals}`);
        console.log("");
    } catch (error) {
        console.log(`   ⚠️  Standard functions failed: ${error.message.split('\n')[0]}`);
        console.log("");
    }
    
    // Check if this is the correct Compound V3 address
    console.log("5️⃣  Verifying Compound V3 Address:");
    console.log("");
    console.log("   According to Compound docs, Arbitrum USDC market should be:");
    console.log("   Official: Check Compound docs or verified source");
    console.log("");
    console.log("   Current address:", COMPOUND_USDC);
    console.log("   This should be a Comet (Compound V3) contract");
    console.log("");
    
    console.log("=".repeat(70));
    console.log("💡 DIAGNOSIS");
    console.log("=".repeat(70));
    console.log("");
    console.log("If Compound contract calls are failing:");
    console.log("  1. Address might be wrong");
    console.log("  2. Function signature might be wrong");
    console.log("  3. Contract might not be a Comet contract");
    console.log("  4. RPC might have issues");
    console.log("");
    console.log("Next steps:");
    console.log("  1. Verify Compound V3 USDC address on Arbitrum");
    console.log("  2. Check Compound V3 documentation for correct function names");
    console.log("  3. Verify QueryHelper is using correct interface");
    console.log("");
}

testCompoundContract().catch(console.error);

