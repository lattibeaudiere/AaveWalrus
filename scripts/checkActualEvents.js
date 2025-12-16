const { ethers } = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function checkRecentTransaction() {
  const provider = new ethers.providers.JsonRpcProvider(process.env.REACTIVE_RPC || 'https://mainnet-rpc.rnk.dev');
  const rsc = '0xbc183f419B48D4fd5Ad4e375e198ECc0fd48d8A5';
  const txHash = '0x2e17fa9f685119a'; // Recent transaction from the list
  
  // Get the latest block and check for logs
  const latest = await provider.getBlockNumber();
  console.log('Latest block:', latest);
  
  // Get logs from recent blocks
  const fromBlock = latest - 100;
  const logs = await provider.getLogs({
    address: rsc,
    fromBlock,
    toBlock: latest
  });
  
  console.log(`Found ${logs.length} logs in last 100 blocks`);
  
  // Check what topics we're seeing
  const topics = new Set();
  logs.forEach(log => {
    if (log.topics[0]) topics.add(log.topics[0]);
  });
  
  console.log('\nUnique Topic0 values found:');
  topics.forEach(topic => {
    console.log('  ', topic);
  });
  
  // Try to decode with our known events
  const iface = new ethers.utils.Interface([
    'event ReactHandled(uint256 chainId,address emitter,uint256 txHash,uint256 logIndex)',
    'event Callback(uint256 indexed chain_id,address indexed _contract,uint64 indexed gas_limit,bytes payload)',
    'event StrategyUpdate(uint256 aaveApy,uint256 compoundApy,uint256 spread,bool rebalanced)'
  ]);
  
  console.log('\nDecodable events:');
  logs.forEach((log, i) => {
    try {
      const decoded = iface.parseLog(log);
      console.log(`  Log ${i}: ${decoded.name}`);
    } catch (e) {
      // Not one of our events
    }
  });
}

checkRecentTransaction().catch(console.error);
