const ethers = require('ethers');
const fs = require('fs');
const path = require('path');

async function verifyCompilation() {
    console.log("=".repeat(70));
    console.log("🔍 VERIFYING COMPILATION");
    console.log("=".repeat(70));
    console.log("");
    
    // Check QueryHelper.sol
    console.log("1️⃣  Checking QueryHelper.sol:");
    const queryHelperPath = path.join(__dirname, '..', 'contracts', 'QueryHelper.sol');
    
    if (fs.existsSync(queryHelperPath)) {
        const content = fs.readFileSync(queryHelperPath, 'utf8');
        
        // Check for new function
        const hasQueryBothApys = content.includes('function queryBothApys');
        const hasBothApysEvent = content.includes('event BothApysQueried');
        const hasAavePool = content.includes('AAVE_POOL');
        const hasUSDC = content.includes('USDC');
        
        console.log(`   File exists: ✅`);
        console.log(`   Has queryBothApys(): ${hasQueryBothApys ? "✅" : "❌"}`);
        console.log(`   Has BothApysQueried event: ${hasBothApysEvent ? "✅" : "❌"}`);
        console.log(`   Has AAVE_POOL constant: ${hasAavePool ? "✅" : "❌"}`);
        console.log(`   Has USDC constant: ${hasUSDC ? "✅" : "❌"}`);
        console.log("");
        
        if (!hasQueryBothApys || !hasBothApysEvent) {
            console.log("   ⚠️  QueryHelper.sol missing required functions/events!");
        }
    } else {
        console.log("   ❌ QueryHelper.sol not found!");
        console.log("");
    }
    
    // Check RSC contract
    console.log("2️⃣  Checking FusionReactiveRSC.sol:");
    const rscPath = path.join(__dirname, '..', 'reactive', 'contracts', 'FusionReactiveRSC.sol');
    
    if (fs.existsSync(rscPath)) {
        const content = fs.readFileSync(rscPath, 'utf8');
        
        // Check for new functions and constants
        const hasInitialize = content.includes('function initializeStrategy');
        const hasSubscribeBoth = content.includes('function subscribeToBothApys');
        const hasBothApysTopic = content.includes('BOTH_APYS_QUERIED_TOPIC');
        const hasInitialized = content.includes('bool public initialized');
        const handlesBothApys = content.includes('BOTH_APYS_QUERIED_TOPIC && log._contract == queryHelper');
        
        console.log(`   File exists: ✅`);
        console.log(`   Has initializeStrategy(): ${hasInitialize ? "✅" : "❌"}`);
        console.log(`   Has subscribeToBothApys(): ${hasSubscribeBoth ? "✅" : "❌"}`);
        console.log(`   Has BOTH_APYS_QUERIED_TOPIC: ${hasBothApysTopic ? "✅" : "❌"}`);
        console.log(`   Has initialized flag: ${hasInitialized ? "✅" : "❌"}`);
        console.log(`   Handles BothApysQueried event: ${handlesBothApys ? "✅" : "❌"}`);
        console.log("");
        
        if (!hasInitialize || !hasSubscribeBoth || !handlesBothApys) {
            console.log("   ⚠️  RSC contract missing required functions!");
        }
    } else {
        console.log("   ❌ FusionReactiveRSC.sol not found!");
        console.log("");
    }
    
    // Verify topic calculation
    console.log("3️⃣  Verifying Event Topic:");
    console.log("");
    
    const eventSig = "BothApysQueried(uint256,uint256,uint256,uint256)";
    const calculatedTopic = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(eventSig));
    const expectedTopic = "0x2c1947c3f10fa78b7b64309a9d8353cbd8ed1c60e2c184a73c7ffc8f994383b5";
    
    console.log(`   Event: ${eventSig}`);
    console.log(`   Calculated: ${calculatedTopic}`);
    console.log(`   Expected:   ${expectedTopic}`);
    console.log(`   Match: ${calculatedTopic.toLowerCase() === expectedTopic.toLowerCase() ? "✅" : "❌"}`);
    console.log("");
    
    console.log("=".repeat(70));
    console.log("📊 SUMMARY");
    console.log("=".repeat(70));
    console.log("");
    
    const allGood = (
        (hasQueryBothApys && hasBothApysEvent) &&
        (hasInitialize && hasSubscribeBoth && handlesBothApys) &&
        (calculatedTopic.toLowerCase() === expectedTopic.toLowerCase())
    );
    
    if (allGood) {
        console.log("✅ All checks passed! Code is ready for compilation.");
    } else {
        console.log("⚠️  Some checks failed. Review the code before compiling.");
    }
    console.log("");
}

verifyCompilation().catch(console.error);

