const { ethers } = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function checkEvents() {
  const provider = new ethers.providers.JsonRpcProvider(process.env.REACTIVE_RPC || 'https://mainnet-rpc.rnk.dev');
  const rsc = '0xbc183f419B48D4fd5Ad4e375e198ECc0fd48d8A5';
  const block = 3077357;
  
  console.log('Checking block', block, 'for events from RSC:', rsc);
  
  const logs = await provider.getLogs({
    address: rsc,
    fromBlock: block,
    toBlock: block
  });
  
  console.log(`\nFound ${logs.length} logs in block ${block}\n`);
  
  const reactHandledTopic = ethers.utils.id('ReactHandled(uint256,address,uint256,uint256)');
  const callbackTopic = ethers.utils.id('Callback(uint256,address,uint64,bytes)');
  
  logs.forEach((log, i) => {
    console.log(`Log ${i + 1}:`);
    console.log('  Block:', log.blockNumber);
    console.log('  Tx:', log.transactionHash);
    console.log('  Topic0:', log.topics[0]);
    console.log('  Topics:', log.topics.length);
    
    if (log.topics[0] === reactHandledTopic) {
      console.log('  ✅ ReactHandled event');
    } else if (log.topics[0] === callbackTopic) {
      console.log('  ✅ Callback event');
    } else {
      console.log('  ⚠️  Unknown event');
    }
    console.log('');
  });
  
  // Also check a wider range
  const latest = await provider.getBlockNumber();
  console.log(`\nChecking last 100 blocks (${latest - 100} to ${latest})...`);
  
  const recentLogs = await provider.getLogs({
    address: rsc,
    fromBlock: latest - 100,
    toBlock: latest
  });
  
  const reactHandledCount = recentLogs.filter(l => l.topics[0] === reactHandledTopic).length;
  const callbackCount = recentLogs.filter(l => l.topics[0] === callbackTopic).length;
  
  console.log(`Found ${recentLogs.length} total logs`);
  console.log(`  ReactHandled: ${reactHandledCount}`);
  console.log(`  Callback: ${callbackCount}`);
}

checkEvents().catch(console.error);

