const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function testCurrentSystem() {
    console.log("🧪 Testing Current System Before Redeployment\n");
    console.log("=" .repeat(60));
    
    const ADAPTER_ADDRESS = process.env.ADAPTER_ADDRESS || "0xa60c91Aa6E0e203De3a6692a82eE65884B3B2D09";
    const RSC_ADDRESS = process.env.RSC_ADDRESS || "0xEFD20dC51F7c82B7430490Bf45767bA57F6819fc";
    const VAULT_ADDRESS = process.env.TARGET_VAULT;
    const QUERY_HELPER_ADDRESS = process.env.QUERY_HELPER_ADDRESS;
    
    const provider = new ethers.providers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc"
    );
    
    const reactiveProvider = new ethers.providers.JsonRpcProvider(
        process.env.REACTIVE_RPC || "https://mainnet-rpc.rnk.dev"
    );
    
    console.log("\n1️⃣  Contract Addresses:");
    console.log("   Adapter:", ADAPTER_ADDRESS);
    console.log("   RSC:", RSC_ADDRESS);
    console.log("   Vault:", VAULT_ADDRESS);
    console.log("   QueryHelper:", QUERY_HELPER_ADDRESS);
    
    // Test 1: Check if contracts exist
    console.log("\n2️⃣  Contract Existence:");
    const adapterCode = await provider.getCode(ADAPTER_ADDRESS);
    const rscCode = await reactiveProvider.getCode(RSC_ADDRESS);
    const vaultCode = provider.getCode(VAULT_ADDRESS);
    const queryHelperCode = provider.getCode(QUERY_HELPER_ADDRESS);
    
    const [adapterExists, rscExists, vaultExists, queryHelperExists] = await Promise.all([
        Promise.resolve(adapterCode !== "0x"),
        Promise.resolve(rscCode !== "0x"),
        vaultCode.then(code => code !== "0x"),
        queryHelperCode.then(code => code !== "0x")
    ]);
    
    console.log("   Adapter:", adapterExists ? "✅ Exists" : "❌ Not found");
    console.log("   RSC:", rscExists ? "✅ Exists" : "❌ Not found");
    console.log("   Vault:", vaultExists ? "✅ Exists" : "❌ Not found");
    console.log("   QueryHelper:", queryHelperExists ? "✅ Exists" : "❌ Not found");
    
    if (!adapterExists || !rscExists || !vaultExists || !queryHelperExists) {
        console.log("\n❌ Some contracts missing - cannot proceed");
        return;
    }
    
    // Test 2: Check adapter function signature
    console.log("\n3️⃣  Adapter Function Signature:");
    const adapterABI = [
        "function executeReaction(tuple(address fuse, bytes data)[] actions) external returns (bool success, bytes memory data)",
        "function executeReaction(address rsc, tuple(address fuse, bytes data)[] actions) external returns (bool success, bytes memory data)",
        "function isRSCRegistered(address rsc) external view returns (bool)",
        "function getRSCConfig(address rsc) external view returns (tuple(address vault, uint256 targetChainId, bool isActive, uint256 lastExecution, uint256 executionCount))"
    ];
    
    const adapter = new ethers.Contract(ADAPTER_ADDRESS, adapterABI, provider);
    
    // Try old signature
    try {
        await adapter.callStatic.executeReaction([], { gasLimit: 100000 });
        console.log("   OLD signature (no address): ✅ Available");
    } catch (error) {
        if (error.message.includes("function") || error.message.includes("selector")) {
            console.log("   OLD signature (no address): ❌ Not available");
        } else {
            console.log("   OLD signature (no address): ⚠️  Available but reverts:", error.message.split('\n')[0].substring(0, 80));
        }
    }
    
    // Try new signature
    try {
        await adapter.callStatic.executeReaction(ethers.constants.AddressZero, [], { gasLimit: 100000 });
        console.log("   NEW signature (with address): ✅ Available");
    } catch (error) {
        if (error.message.includes("function") || error.message.includes("selector")) {
            console.log("   NEW signature (with address): ❌ Not available");
        } else {
            console.log("   NEW signature (with address): ⚠️  Available but reverts:", error.message.split('\n')[0].substring(0, 80));
        }
    }
    
    // Test 3: Check RSC registration
    console.log("\n4️⃣  RSC Registration:");
    try {
        const isRegistered = await adapter.isRSCRegistered(RSC_ADDRESS);
        const config = await adapter.getRSCConfig(RSC_ADDRESS);
        
        console.log("   Registered:", isRegistered ? "✅ Yes" : "❌ No");
        console.log("   Active:", config.isActive ? "✅ Yes" : "❌ No");
        console.log("   Vault:", config.vault);
        console.log("   Last Execution:", config.lastExecution.toString() === "0" ? "Never" : new Date(config.lastExecution.toNumber() * 1000).toISOString());
        console.log("   Execution Count:", config.executionCount.toString());
        
        if (!isRegistered || !config.isActive) {
            console.log("\n   ⚠️  RSC not properly registered or inactive");
        }
    } catch (error) {
        console.log("   ❌ Error checking registration:", error.message.split('\n')[0]);
    }
    
    // Test 4: Check Alpha role (try to read vault)
    console.log("\n5️⃣  Alpha Role Check:");
    if (VAULT_ADDRESS) {
        try {
            const vault = new ethers.Contract(
                VAULT_ADDRESS,
                ["function hasRole(bytes32 role, address account) external view returns (bool)"],
                provider
            );
            
            const { utils } = require('ethers');
            const ALPHA_ROLE = utils.keccak256(utils.toUtf8Bytes("ALPHA_ROLE"));
            
            try {
                const hasRole = await vault.hasRole(ALPHA_ROLE, ADAPTER_ADDRESS);
                console.log("   Adapter has Alpha role:", hasRole ? "✅ Yes" : "❌ No");
            } catch (error) {
                console.log("   ⚠️  Could not check Alpha role:", error.message.split('\n')[0]);
            }
        } catch (error) {
            console.log("   ⚠️  Could not access vault:", error.message.split('\n')[0]);
        }
    }
    
    // Test 5: Check RSC status on Reactive Network
    console.log("\n6️⃣  RSC Status (Reactive Network):");
    try {
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
        
        console.log("   Direct Balance:", ethers.utils.formatEther(status.directBalance), "REACT");
        console.log("   Reserves:", ethers.utils.formatEther(status.reserves), "REACT");
        console.log("   Debt:", ethers.utils.formatEther(status.debt), "REACT");
        console.log("   Active:", status.isActive ? "✅ Yes" : "❌ No");
        console.log("   Aave Subscribed:", status.aaveSub ? "✅ Yes" : "❌ No");
        console.log("   Compound Subscribed:", status.compoundSub ? "✅ Yes" : "❌ No");
        console.log("   QueryHelper Subscribed:", status.queryHelperSub ? "✅ Yes" : "❌ No");
        console.log("   Last Aave APY:", status.lastAaveApy.toString(), "bps");
        console.log("   Cooldown Remaining:", status.cooldownRemaining.toString(), "seconds");
        console.log("   RSC Adapter:", rscAdapter);
        console.log("   RSC Vault:", rscVault);
        
        // Check if RSC adapter matches deployed adapter
        if (rscAdapter.toLowerCase() !== ADAPTER_ADDRESS.toLowerCase()) {
            console.log("\n   ⚠️  MISMATCH: RSC points to different adapter!");
            console.log("      RSC adapter:", rscAdapter);
            console.log("      Deployed adapter:", ADAPTER_ADDRESS);
        } else {
            console.log("\n   ✅ RSC adapter matches deployed adapter");
        }
        
        if (rscVault.toLowerCase() !== VAULT_ADDRESS.toLowerCase()) {
            console.log("\n   ⚠️  MISMATCH: RSC points to different vault!");
            console.log("      RSC vault:", rscVault);
            console.log("      Expected vault:", VAULT_ADDRESS);
        } else {
            console.log("   ✅ RSC vault matches expected vault");
        }
        
    } catch (error) {
        console.log("   ❌ Error checking RSC status:", error.message.split('\n')[0]);
    }
    
    // Test 6: Simulate callback payload
    console.log("\n7️⃣  Callback Payload Simulation:");
    try {
        // Simulate what RSC would emit (NEW signature)
        const emptyActions = [];
        const rscAddress = RSC_ADDRESS;
        
        const newPayload = ethers.utils.defaultAbiCoder.encode(
            ["address", "tuple(address,bytes)[]"],
            [rscAddress, emptyActions]
        );
        
        const functionSig = "executeReaction(address,(address,bytes)[])";
        const selector = ethers.utils.id(functionSig).slice(0, 10);
        
        const fullPayload = selector + newPayload.slice(2);
        
        console.log("   Function:", functionSig);
        console.log("   Selector:", selector);
        console.log("   Payload length:", fullPayload.length, "bytes");
        console.log("   RSC address in payload:", rscAddress);
        
        // Try to decode
        try {
            const decoded = ethers.utils.defaultAbiCoder.decode(
                ["address", "tuple(address,bytes)[]"],
                "0x" + fullPayload.slice(10)
            );
            console.log("   ✅ Payload encoding valid");
            console.log("   Decoded RSC address:", decoded[0]);
            console.log("   Decoded actions count:", decoded[1].length);
        } catch (error) {
            console.log("   ❌ Payload encoding invalid:", error.message.split('\n')[0]);
        }
    } catch (error) {
        console.log("   ❌ Error simulating payload:", error.message.split('\n')[0]);
    }
    
    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("\n📋 TEST SUMMARY:");
    console.log("\n✅ Contracts exist and accessible");
    console.log("⚠️  Verify adapter signature compatibility");
    console.log("⚠️  Verify RSC adapter/vault configuration");
    console.log("⚠️  Verify Alpha role grant");
    console.log("\n💡 If adapter has OLD signature → REDEPLOYMENT REQUIRED");
    console.log("💡 If adapter has NEW signature → May not need redeployment");
    console.log("\n");
}

testCurrentSystem().catch(console.error);

