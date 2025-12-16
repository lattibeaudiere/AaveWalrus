const { ethers } = require('ethers');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function main() {
  const RSC = process.env.RSC_ADDRESS || '0xbc183f419B48D4fd5Ad4e375e198ECc0fd48d8A5';
  const provider = new ethers.providers.JsonRpcProvider(process.env.REACTIVE_RPC || 'https://mainnet-rpc.rnk.dev');
  const topic = ethers.utils.id('Callback(uint256,address,uint64,bytes)');
  const latest = await provider.getBlockNumber();
  const from = Math.max(0, latest - 500000);
  console.log('Fetching Callback logs for', RSC);
  console.log('Blocks', from, 'to', latest);
  const logs = await provider.getLogs({ address: RSC, topics: [topic], fromBlock: from, toBlock: latest });
  console.log('Found logs:', logs.length);
  const iface = new ethers.utils.Interface([
    'event Callback(uint256 indexed chain_id,address indexed _contract,uint64 indexed gas_limit,bytes payload)'
  ]);
  logs.forEach((log, i) => {
    const decoded = iface.decodeEventLog('Callback', log.data, log.topics);
    console.log(`\n#${i + 1}`);
    console.log('  Block:', log.blockNumber);
    console.log('  Tx:', log.transactionHash);
    console.log('  chain_id:', decoded.chain_id.toString());
    console.log('  contract:', decoded._contract);
    console.log('  gas_limit:', decoded.gas_limit.toString());
    console.log('  payload:', decoded.payload.slice(0, 66) + (decoded.payload.length > 66 ? '...' : ''));
  });
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
