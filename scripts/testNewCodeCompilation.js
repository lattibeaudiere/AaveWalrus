const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log("🧪 Testing New Code Compilation\n");
console.log("=".repeat(60));

// Test 1: Compile RSC
console.log("\n1️⃣  Compiling RSC (Reactive Network):");
try {
    process.chdir(path.join(__dirname, '..', 'reactive'));
    const rscOutput = execSync('forge build', { encoding: 'utf8', stdio: 'pipe' });
    console.log("   ✅ RSC compilation successful");
} catch (error) {
    console.log("   ❌ RSC compilation failed:");
    console.log("   " + error.stdout.split('\n').slice(-5).join('\n   '));
    process.exit(1);
}

// Test 2: Compile Adapter
console.log("\n2️⃣  Compiling Adapter (Hardhat):");
try {
    process.chdir(path.join(__dirname, '..'));
    const adapterOutput = execSync('npx hardhat compile', { encoding: 'utf8', stdio: 'pipe' });
    console.log("   ✅ Adapter compilation successful");
} catch (error) {
    console.log("   ❌ Adapter compilation failed:");
    console.log("   " + error.stderr.split('\n').slice(-5).join('\n   '));
    process.exit(1);
}

// Test 3: Check for function signatures in compiled code
console.log("\n3️⃣  Verifying Function Signatures:");

try {
    process.chdir(path.join(__dirname, '..'));
    
    // Check adapter ABI
    const adapterArtifactPath = path.join(__dirname, '..', 'artifacts', 'contracts', 'rsc', 'ReactiveAlphaAdapter.sol', 'ReactiveAlphaAdapter.json');
    if (fs.existsSync(adapterArtifactPath)) {
        const adapterArtifact = JSON.parse(fs.readFileSync(adapterArtifactPath, 'utf8'));
        const adapterABI = adapterArtifact.abi;
        
        // Find executeReaction function
        const executeReactionFunc = adapterABI.find(f => f.name === 'executeReaction' && f.type === 'function');
        
        if (executeReactionFunc) {
            console.log("   ✅ executeReaction function found in adapter");
            console.log("   Inputs:", executeReactionFunc.inputs.map(i => `${i.type} ${i.name || ''}`).join(', '));
            
            // Check if it has address as first parameter
            if (executeReactionFunc.inputs.length > 0 && executeReactionFunc.inputs[0].type === 'address') {
                console.log("   ✅ Adapter has NEW signature (address as first parameter)");
            } else {
                console.log("   ⚠️  Adapter has OLD signature (no address parameter)");
            }
        } else {
            console.log("   ❌ executeReaction function not found in adapter ABI");
        }
    } else {
        console.log("   ⚠️  Adapter artifact not found");
    }
    
    // Check RSC bytecode
    process.chdir(path.join(__dirname, '..', 'reactive'));
    const rscArtifactPath = path.join(__dirname, '..', 'reactive', 'out', 'FusionReactiveRSC.sol', 'FusionReactiveRSC.json');
    if (fs.existsSync(rscArtifactPath)) {
        const rscArtifact = JSON.parse(fs.readFileSync(rscArtifactPath, 'utf8'));
        const bytecode = rscArtifact.bytecode.object;
        
        // Check for NEW callback selector
        const newSelector = "0b059df9"; // executeReaction(address,(address,bytes)[])
        const oldSelector = "75fb2802"; // executeReaction((address,bytes)[])
        
        const hasNew = bytecode.toLowerCase().includes(newSelector);
        const hasOld = bytecode.toLowerCase().includes(oldSelector);
        
        console.log("\n   RSC callback encoding:");
        if (hasNew && !hasOld) {
            console.log("   ✅ RSC uses NEW signature for callbacks");
        } else if (hasOld && !hasNew) {
            console.log("   ⚠️  RSC uses OLD signature for callbacks");
        } else {
            console.log("   ⚠️  Cannot determine RSC callback signature");
        }
    } else {
        console.log("   ⚠️  RSC artifact not found");
    }
    
} catch (error) {
    console.log("   ❌ Error checking signatures:", error.message);
}

console.log("\n" + "=".repeat(60));
console.log("\n✅ Compilation tests complete!");
console.log("\n");

