const { ethers } = require('ethers');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(process.env.REACTIVE_RPC || 'https://mainnet-rpc.rnk.dev');
  const rsc = process.env.RSC_ADDRESS;
  if (!rsc) throw new Error('RSC_ADDRESS not set');

  const reactHandledTopic = ethers.utils.id('ReactHandled(uint256,address,uint256,uint256)');
  const callbackTopic = ethers.utils.id('Callback(uint256,address,uint64,bytes)');
  const iface = new ethers.utils.Interface([
    'event ReactHandled(uint256 chainId,address emitter,uint256 txHash,uint256 logIndex)',
    'event Callback(uint256 indexed chain_id,address indexed _contract,uint64 indexed gas_limit,bytes payload)'
  ]);

  const latest = await provider.getBlockNumber();
  const from = Math.max(0, latest - 200);
  const logs = await provider.getLogs({ address: rsc, topics: [[reactHandledTopic, callbackTopic]], fromBlock: from, toBlock: latest });
  console.log(`Fetched ${logs.length} logs (blocks ${from}  ${latest})`);
  logs.slice(-10).forEach((log, idx) => {
    const topic0 = log.topics[0];
    const ts = new Date().toISOString();
    if (topic0 === reactHandledTopic) {
      const decoded = iface.decodeEventLog('ReactHandled', log.data, log.topics);
      console.log(`\n[#${logs.length - (logs.slice(-10).length) + idx + 1}] ReactHandled`);
      console.log(`  Block: ${log.blockNumber}`);
      console.log(`  Tx:    ${log.transactionHash}`);
      console.log(`  Chain: ${decoded.chainId.toString()}`);
      console.log(`  Source:${decoded.emitter}`);
      console.log(`  Log idx: ${decoded.logIndex.toString()}`);
    } else {
      const decoded = iface.decodeEventLog('Callback', log.data, log.topics);
      console.log(`\n[#${logs.length - (logs.slice(-10).length) + idx + 1}] Callback`);
      console.log(`  Block: ${log.blockNumber}`);
      console.log(`  Tx:    ${log.transactionHash}`);
      console.log(`  Target chain: ${decoded.chain_id.toString()}`);
      console.log(`  Target contract: ${decoded._contract}`);
      const preview = decoded.payload.slice(0, 66);
      console.log(`  Payload: ${preview}${decoded.payload.length > 66 ? '' : ''}`);
    }
  });
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
