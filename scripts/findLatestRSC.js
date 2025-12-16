const { ethers } = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function findLatestRSC() {
    const REACTIVE_RPC = process.env.REACTIVE_RPC || "https://mainnet-rpc.rnk.dev";
    
    if (!process.env.REACTIVE_PRIVATE_KEY) {
        console.error("❌ REACTIVE_PRIVATE_KEY not set");
        process.exit(1);
    }
    
    const provider = new ethers.providers.JsonRpcProvider(REACTIVE_RPC);
    const signer = new ethers.Wallet(process.env.REACTIVE_PRIVATE_KEY, provider);
    
    console.log("🔍 Finding Latest Deployed RSC Contract...\n");
    console.log("Signer:", signer.address);
    console.log("");
    
    // Get latest block
    const latestBlock = await provider.getBlockNumber();
    console.log("Latest block:", latestBlock);
    
    // Search recent blocks for contract deployments
    const searchBlocks = 500;
    const fromBlock = Math.max(latestBlock - searchBlocks, 0);
    
    console.log(`Searching blocks ${fromBlock} to ${latestBlock} for contract deployments...\n`);
    
    const ABI = [
        "function owner() view returns (address)",
        "function service() view returns (address)",
        "function adapter() view returns (address)"
    ];
    
    let foundContracts = [];
    
    // Check known transaction hashes
    const knownTxs = [
        "0x37d6f71842858e7edb4304686a57bb0418989da1cae7eb25eb312f38a45db4a8"
    ];
    
    for (const txHash of knownTxs) {
        try {
            const receipt = await provider.getTransactionReceipt(txHash);
            
            if (receipt && receipt.contractAddress) {
                console.log(`✅ Found contract from deployment: ${receipt.contractAddress}`);
                console.log(`   Block: ${receipt.blockNumber}`);
                console.log(`   TX: ${txHash}`);
                
                try {
                    const contract = new ethers.Contract(receipt.contractAddress, ABI, provider);
                    const owner = await contract.owner();
                    const service = await contract.service();
                    const adapter = await contract.adapter();
                    
                    if (owner.toLowerCase() === signer.address.toLowerCase()) {
                        console.log(`   ✅ Owner matches!`);
                        console.log(`   Service: ${service}`);
                        console.log(`   Adapter: ${adapter}`);
                        foundContracts.push({
                            address: receipt.contractAddress,
                            block: receipt.blockNumber,
                            tx: txHash,
                            owner: owner
                        });
                    }
                } catch (e) {
                    console.log(`   ⚠️  Not an RSC contract: ${e.message}`);
                }
            }
        } catch (error) {
            console.log(`   ⚠️  TX ${txHash}: ${error.message}`);
        }
    }
    
    if (foundContracts.length > 0) {
        console.log("\n" + "=".repeat(60));
        console.log("📊 FOUND CONTRACTS:");
        console.log("=".repeat(60));
        
        foundContracts.forEach((contract, index) => {
            console.log(`\n${index + 1}. ${contract.address}`);
            console.log(`   Block: ${contract.block}`);
            console.log(`   TX: ${contract.tx}`);
            console.log(`   Owner: ${contract.owner}`);
        });
        
        const latest = foundContracts.sort((a, b) => b.block - a.block)[0];
        console.log("\n" + "=".repeat(60));
        console.log("✅ LATEST CONTRACT:");
        console.log("=".repeat(60));
        console.log(`Address: ${latest.address}`);
        console.log(`Block: ${latest.block}`);
        console.log(`\n💡 Update your .env with:`);
        console.log(`RSC_ADDRESS=${latest.address}`);
    } else {
        console.log("\n⚠️  No contracts found");
    }
}

findLatestRSC().catch(console.error);

