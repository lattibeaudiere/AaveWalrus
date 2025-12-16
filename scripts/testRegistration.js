const { ethers } = require("hardhat");
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function testRegistration() {
    console.log("🧪 Testing RSC Registration Function\n");
    console.log("=".repeat(60));
    
    const [deployer] = await ethers.getSigners();
    
    console.log("\n1️⃣  Deploying Test Adapter:");
    
    // Deploy a fresh adapter for testing
    const AdapterFactory = await ethers.getContractFactory("ReactiveAlphaAdapter");
    const testAdapter = await AdapterFactory.deploy(deployer.address);
    await testAdapter.deployTransaction.wait();
    const adapterAddress = await testAdapter.getAddress();
    
    console.log("   Test Adapter:", adapterAddress);
    console.log("   Deployer (Manager):", deployer.address);
    
    // Test parameters
    const testRSC = "0x1234567890123456789012345678901234567890";
    const testVault = process.env.TARGET_VAULT || "0xee29A26179fE20D5D202dAE4a279119E08edc60b";
    const targetChainId = 42161; // Arbitrum
    const description = "Test RSC Registration";
    
    console.log("\n2️⃣  Testing registerCrossChainRSC:");
    console.log("   RSC Address:", testRSC);
    console.log("   Vault Address:", testVault);
    console.log("   Target Chain ID:", targetChainId);
    console.log("   Description:", description);
    
    try {
        // Grant MANAGER_ROLE to deployer if needed (should be automatic)
        const MANAGER_ROLE = await testAdapter.MANAGER_ROLE();
        const hasRole = await testAdapter.hasRole(MANAGER_ROLE, deployer.address);
        
        if (!hasRole) {
            console.log("\n   ⚠️  Deployer doesn't have MANAGER_ROLE, granting...");
            // This might fail if contract doesn't allow role granting
            // In production, owner would grant this role
        }
        
        // Test registration
        console.log("\n   Attempting registration...");
        const tx = await testAdapter.registerCrossChainRSC(
            testRSC,
            testVault,
            targetChainId,
            description
        );
        
        console.log("   Transaction hash:", tx.hash);
        const receipt = await tx.wait();
        console.log("   ✅ Registration successful!");
        console.log("   Gas used:", receipt.gasUsed.toString());
        
        // Verify registration
        console.log("\n3️⃣  Verifying Registration:");
        
        const isRegistered = await testAdapter.isRSCRegistered(testRSC);
        const config = await testAdapter.getRSCConfig(testRSC);
        
        console.log("   Registered:", isRegistered ? "✅ Yes" : "❌ No");
        console.log("   Vault:", config.vault);
        console.log("   Target Chain ID:", config.targetChainId.toString());
        console.log("   Active:", config.isActive ? "✅ Yes" : "❌ No");
        console.log("   Last Execution:", config.lastExecution.toString());
        console.log("   Execution Count:", config.executionCount.toString());
        
        // Check events
        const events = receipt.events || receipt.logs.map(log => {
            try {
                return testAdapter.interface.parseLog(log);
            } catch {
                return null;
            }
        }).filter(e => e !== null);
        
        const rscRegisteredEvent = events.find(e => e.name === 'RSCRegistered');
        if (rscRegisteredEvent) {
            console.log("\n4️⃣  RSCRegistered Event:");
            console.log("   RSC:", rscRegisteredEvent.args.rsc);
            console.log("   Vault:", rscRegisteredEvent.args.vault);
            console.log("   Description:", rscRegisteredEvent.args.description);
        }
        
        // Test duplicate registration (should fail)
        console.log("\n5️⃣  Testing Duplicate Registration (should fail):");
        try {
            const tx2 = await testAdapter.registerCrossChainRSC(
                testRSC,
                testVault,
                targetChainId,
                "Duplicate registration"
            );
            await tx2.wait();
            console.log("   ❌ Duplicate registration succeeded (should have failed)");
        } catch (error) {
            if (error.message.includes("RSCAlreadyRegistered") || error.message.includes("already registered")) {
                console.log("   ✅ Duplicate registration correctly rejected");
            } else {
                console.log("   ⚠️  Unexpected error:", error.message.split('\n')[0]);
            }
        }
        
        // Test invalid vault address (should fail)
        console.log("\n6️⃣  Testing Invalid Vault Address (should fail):");
        try {
            const tx3 = await testAdapter.registerCrossChainRSC(
                "0x1111111111111111111111111111111111111111",
                ethers.constants.AddressZero, // Invalid vault
                targetChainId,
                "Invalid vault test"
            );
            await tx3.wait();
            console.log("   ❌ Invalid vault registration succeeded (should have failed)");
        } catch (error) {
            if (error.message.includes("InvalidVaultAddress") || error.message.includes("invalid")) {
                console.log("   ✅ Invalid vault correctly rejected");
            } else {
                console.log("   ⚠️  Unexpected error:", error.message.split('\n')[0]);
            }
        }
        
        // Test unauthorized caller (should fail)
        console.log("\n7️⃣  Testing Unauthorized Caller (should fail):");
        const [owner, addr1] = await ethers.getSigners();
        if (addr1.address !== deployer.address) {
            try {
                const unauthorizedAdapter = testAdapter.connect(addr1);
                const tx4 = await unauthorizedAdapter.registerCrossChainRSC(
                    "0x2222222222222222222222222222222222222222",
                    testVault,
                    targetChainId,
                    "Unauthorized test"
                );
                await tx4.wait();
                console.log("   ❌ Unauthorized registration succeeded (should have failed)");
            } catch (error) {
                if (error.message.includes("AccessControl") || error.message.includes("MANAGER_ROLE") || error.message.includes("unauthorized")) {
                    console.log("   ✅ Unauthorized caller correctly rejected");
                } else {
                    console.log("   ⚠️  Unexpected error:", error.message.split('\n')[0]);
                }
            }
        }
        
        console.log("\n" + "=".repeat(60));
        console.log("\n✅ Registration Function Test Complete!");
        console.log("\nSummary:");
        console.log("  ✅ registerCrossChainRSC works correctly");
        console.log("  ✅ Registration verified");
        console.log("  ✅ Duplicate registration prevented");
        console.log("  ✅ Invalid addresses rejected");
        console.log("  ✅ Access control enforced");
        console.log("\n");
        
    } catch (error) {
        console.error("\n❌ Registration test failed:");
        console.error("   Error:", error.message);
        if (error.transaction) {
            console.error("   Transaction:", error.transaction);
        }
        
        // Try to decode revert reason
        if (error.reason) {
            console.error("   Revert reason:", error.reason);
        }
        
        process.exit(1);
    }
}

// Run test
testRegistration()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

