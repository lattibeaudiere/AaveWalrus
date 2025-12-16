const { ethers } = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function checkRecentTx() {
  const provider = new ethers.providers.JsonRpcProvider(process.env.REACTIVE_RPC || 'https://mainnet-rpc.rnk.dev');
  const rsc = '0xbc183f419B48D4fd5Ad4e375e198ECc0fd48d8A5';
  
  // Get a recent transaction hash from the list
  const txHash = '0x2e17fa9f685119a'; // This is partial, but let's try to get receipt
  const latest = await provider.getBlockNumber();
  
  console.log('Latest block:', latest);
  console.log('Checking logs from deployment block to latest...');
  
  // Query from deployment block
  const fromBlock = 2970366;
  const toBlock = latest;
  
  console.log(`Querying blocks ${fromBlock} to ${toBlock} (${toBlock - fromBlock} blocks)`);
  
  // Get ALL logs
  const allLogs = await provider.getLogs({
    address: rsc,
    fromBlock,
    toBlock: Math.min(toBlock, fromBlock + 10000) // Limit to 10k blocks
  });
  
  console.log(`Found ${allLogs.length} total logs`);
  
  if (allLogs.length > 0) {
    console.log('\nFirst 5 logs:');
    allLogs.slice(0, 5).forEach((log, i) => {
      console.log(`\nLog ${i + 1}:`);
      console.log('  Block:', log.blockNumber);
      console.log('  Tx:', log.transactionHash);
      console.log('  Topic0:', log.topics[0]);
      console.log('  Topics:', log.topics.length);
    });
    
    // Check for ReactHandled
    const reactHandledTopic = ethers.utils.id('ReactHandled(uint256,address,uint256,uint256)');
    const callbackTopic = ethers.utils.id('Callback(uint256,address,uint64,bytes)');
    
    const reactHandled = allLogs.filter(l => l.topics[0] === reactHandledTopic);
    const callbacks = allLogs.filter(l => l.topics[0] === callbackTopic);
    
    console.log(`\nReactHandled events: ${reactHandled.length}`);
    console.log(`Callback events: ${callbacks.length}`);
  } else {
    console.log('\n  No logs found!');
    console.log('This could mean:');
    console.log('  1. Events are not being emitted');
    console.log('  2. RPC endpoint issue');
    console.log('  3. Events are in a different block range');
  }
}

checkRecentTx().catch(console.error);
