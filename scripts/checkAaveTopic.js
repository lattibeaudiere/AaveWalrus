const ethers = require('ethers');

/**
 * Verify Aave event topic
 */
async function checkTopic() {
    // The event signature from Aave V3
    const eventSignature = "ReserveDataUpdated(address,uint256,uint256,uint256,uint256,uint256)";
    
    // Calculate topic0
    const topic0 = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes(eventSignature)
    );
    
    console.log("Aave ReserveDataUpdated Event:");
    console.log("Signature:", eventSignature);
    console.log("Topic0:", topic0);
    console.log("");
    
    // Check which one is in the contract
    const contractTopic1 = "0x804c9b842b2748a22bb64b345453a3de7ca54a6ca45ce00d415894979e22897a";
    const contractTopic2 = "0xb2a02bf1a92354a66946e3533277a66dd13726c1695e5ac302d1c1fcb97d2200";
    
    console.log("Contract uses:", contractTopic1);
    console.log("Subscription uses:", contractTopic2);
    console.log("");
    
    if (topic0.toLowerCase() === contractTopic1.toLowerCase()) {
        console.log("✅ Topic matches contract (0x804...)");
    } else if (topic0.toLowerCase() === contractTopic2.toLowerCase()) {
        console.log("✅ Topic matches subscription (0xb2a...)");
    } else {
        console.log("❌ MISMATCH!");
        console.log("Calculated:", topic0);
        console.log("Contract:", contractTopic1);
        console.log("Subscription:", contractTopic2);
    }
}

checkTopic().catch(console.error);

