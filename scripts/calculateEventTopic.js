const ethers = require('ethers');

// Calculate BothApysQueried topic
const topic = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('BothApysQueried(uint256,uint256,uint256,uint256)'));
console.log('BOTH_APYS_QUERIED_TOPIC:', topic);

