const { ethers } = require('ethers');

// Convert decimal Topic0 to hex and compare
const subscriptionTopic0 = "58031398329522556450788654170672692438439563446005319665422470445414788270458";
const expectedTopic0 = "0x804c9b842b2748a22bb64b345453a3de7ca54a6ca45ce00d415894979e22897a";

console.log("Converting subscription Topic0 to hex...");
const subscriptionTopic0Hex = ethers.BigNumber.from(subscriptionTopic0).toHexString();
console.log(`Subscription Topic0 (decimal): ${subscriptionTopic0}`);
console.log(`Subscription Topic0 (hex): ${subscriptionTopic0Hex}`);
console.log(`Expected Topic0 (hex): ${expectedTopic0}`);
console.log("");

if (subscriptionTopic0Hex.toLowerCase() === expectedTopic0.toLowerCase()) {
    console.log("✅ MATCH!");
} else {
    console.log("❌ MISMATCH!");
    console.log(`   Difference: ${subscriptionTopic0Hex !== expectedTopic0 ? "Values are different" : "Same value"}`);
}

// Also check the other subscription
const oldTopic0 = "80794685868438328884970791486435930598949932607254374762773404702529696899584";
const oldTopic0Hex = ethers.BigNumber.from(oldTopic0).toHexString();
console.log(`\nOld subscription Topic0 (hex): ${oldTopic0Hex}`);
console.log(`Expected: ${expectedTopic0}`);
if (oldTopic0Hex.toLowerCase() === expectedTopic0.toLowerCase()) {
    console.log("✅ Old subscription also matches!");
} else {
    console.log("❌ Old subscription does NOT match - this might be the old wrong signature");
}

