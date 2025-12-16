const { ethers } = require('ethers');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function main() {
  const RSC = process.env.RSC_ADDRESS || '0xbc183f419B48D4fd5Ad4e375e198ECc0fd48d8A5';
  const provider = new ethers.providers.JsonRpcProvider(process.env.REACTIVE_RPC || 'https://mainnet-rpc.rnk.dev');
  const topic = ethers.utils.id('ReactHandled(uint256,address,uint256,uint256)');
  const latest = await provider.getBlockNumber();
  const from = Math.max(0, latest - 500000);
  console.log('Fetching ReactHandled logs for', RSC);
  console.log('Blocks', from, 'to', latest);
  const logs = await provider.getLogs({ address: RSC, topics: [topic], fromBlock: from, toBlock: latest });
  console.log('Found logs:', logs.length);
  const iface = new ethers.utils.Interface(['event ReactHandled(uint256 chainId,address emitter,uint256 txHash,uint256 logIndex)']);
  logs.forEach((log, i) => {
    const decoded = iface.decodeEventLog('ReactHandled', log.data, log.topics);
    console.log(`\n#${i + 1}`);
    console.log('  Block:', log.blockNumber);
    console.log('  Tx:', log.transactionHash);
    console.log('  Chain:', decoded.chainId.toString());
    console.log('  Emitter:', decoded.emitter);
    console.log('  txHash (origin):', decoded.txHash.toString());
    console.log('  logIndex:', decoded.logIndex.toString());
  });
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
