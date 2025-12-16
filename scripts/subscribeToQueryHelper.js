const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function subscribeToQueryHelper() {
    console.log("=".repeat(60));
    console.log("SUBSCRIBING TO QUERYHELPER EVENTS");
    console.log("=".repeat(60));
    console.log("");
    
    const REACTIVE_RPC = process.env.REACTIVE_RPC || "https://mainnet-rpc.rnk.dev";
    const REACTIVE_PRIVATE_KEY = process.env.REACTIVE_PRIVATE_KEY;
    const RSC_ADDRESS = process.env.RSC_ADDRESS;
    const QUERY_HELPER_ADDRESS = process.env.QUERY_HELPER_ADDRESS;
    
    if (!REACTIVE_PRIVATE_KEY) {
        throw new Error("REACTIVE_PRIVATE_KEY must be set in .env");
    }
    
    if (!RSC_ADDRESS || RSC_ADDRESS === "0x0000000000000000000000000000000000000000") {
        throw new Error("RSC_ADDRESS must be set in .env (deploy RSC first)");
    }
    
    if (!QUERY_HELPER_ADDRESS || QUERY_HELPER_ADDRESS === "0x0000000000000000000000000000000000000000") {
        throw new Error("QUERY_HELPER_ADDRESS must be set in .env (deploy QueryHelper first)");
    }
    
    const provider = new ethers.providers.JsonRpcProvider(REACTIVE_RPC);
    const wallet = new ethers.Wallet(REACTIVE_PRIVATE_KEY, provider);
    
    console.log("Configuration:");
    console.log(`  RSC: ${RSC_ADDRESS}`);
    console.log(`  QueryHelper: ${QUERY_HELPER_ADDRESS}`);
    console.log(`  Network: Reactive Network (1597)`);
    console.log(`  Signer: ${wallet.address}`);
    console.log("");
    
    // RSC ABI (only subscribeToQueryHelper function)
    const rscABI = [
        "function subscribeToQueryHelper() external",
        "function queryHelperSubscribed() external view returns (bool)"
    ];
    
    const rsc = new ethers.Contract(RSC_ADDRESS, rscABI, wallet);
    
    // Check if already subscribed
    try {
        const isSubscribed = await rsc.queryHelperSubscribed();
        if (isSubscribed) {
            console.log("✅ Already subscribed to QueryHelper events");
            return;
        }
    } catch (error) {
        console.log(`⚠️  Could not check subscription status: ${error.message}`);
    }
    
    console.log("Subscribing to QueryHelper CompoundApyQueried events...");
    console.log("-".repeat(60));
    
    try {
        const tx = await rsc.subscribeToQueryHelper({
            gasLimit: 500000
        });
        
        console.log(`\n  Transaction hash: ${tx.hash}`);
        console.log(`  Waiting for confirmation...`);
        
        const receipt = await tx.wait();
        
        console.log("\n" + "=".repeat(60));
        console.log("✅ SUBSCRIPTION SUCCESSFUL");
        console.log("=".repeat(60));
        console.log(`\nTransaction Hash: ${tx.hash}`);
        console.log(`Block: ${receipt.blockNumber}`);
        console.log(`Gas Used: ${receipt.gasUsed.toString()}`);
        console.log("");
        console.log("RSC is now subscribed to QueryHelper events");
        console.log("Expected topic0: 0xbc75181d726fb199839a4832ddc558e7942ef478af322c6d275d9415ebd3ff4b");
        console.log("");
        console.log("🔗 View on Reactscan:");
        console.log(`   https://reactscan.io/address/${RSC_ADDRESS}`);
        console.log("");
        
    } catch (error) {
        console.log("\n❌ Subscription failed!");
        console.log(`Error: ${error.message}`);
        
        if (error.transaction) {
            console.log(`Transaction hash: ${error.transaction.hash}`);
        }
        
        throw error;
    }
}

subscribeToQueryHelper().catch(console.error);

