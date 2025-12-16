const { ethers } = require('ethers');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

class LiveAdapterStream {
  constructor() {
    this.ARBITRUM_RPC = process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || 'https://arb1.arbitrum.io/rpc';
    this.ADAPTER_ADDRESS = process.env.ADAPTER_ADDRESS || require('../deployment-addresses.json').ReactiveAlphaAdapter;
    this.RSC_ADDRESS = process.env.RSC_ADDRESS;
    if (!this.ADAPTER_ADDRESS) {
      throw new Error('Adapter address missing (set ADAPTER_ADDRESS or update deployment-addresses.json)');
    }
    this.provider = new ethers.providers.JsonRpcProvider(this.ARBITRUM_RPC);
    this.TOPIC = ethers.utils.id('ReactionExecuted(address,address,uint256,bool,bytes)');
    this.iface = new ethers.utils.Interface([
      'event ReactionExecuted(address indexed rsc,address indexed vault,uint256 indexed chainId,bool success,bytes data)'
    ]);
    this.lastBlockChecked = null;
    this.eventCount = 0;
  }

  async start() {
    console.log('='.repeat(70));
    console.log(' LIVE ADAPTER EVENT STREAM');
    console.log('='.repeat(70));
    console.log(`Adapter: ${this.ADAPTER_ADDRESS}`);
    console.log(`RSC filter: ${this.RSC_ADDRESS || 'all RSCs'}`);
    console.log(`Provider: ${this.ARBITRUM_RPC}`);
    console.log(`Started: ${new Date().toISOString()}`);
    console.log('Press Ctrl+C to stop');
    console.log('-'.repeat(70));

    await this.poll();
    setInterval(() => this.poll().catch((err) => console.error('Poll error:', err.message)), 5000);
  }

  async poll() {
    const latest = await this.provider.getBlockNumber();
    if (this.lastBlockChecked === null) this.lastBlockChecked = latest - 50;
    const fromBlock = Math.max(0, this.lastBlockChecked + 1);
    const toBlock = latest;
    if (toBlock < fromBlock) return;

    const topics = [this.TOPIC];
    if (this.RSC_ADDRESS) topics.push(ethers.utils.hexZeroPad(this.RSC_ADDRESS, 32));
    const filter = {
      address: this.ADAPTER_ADDRESS,
      topics,
      fromBlock,
      toBlock
    };
    const logs = await this.provider.getLogs(filter);
    logs.forEach((log) => this.handleLog(log));
    this.lastBlockChecked = toBlock;
  }

  handleLog(log) {
    const decoded = this.iface.decodeEventLog('ReactionExecuted', log.data, log.topics);
    this.eventCount += 1;
    const timestamp = new Date().toISOString();
    console.log(`\n[${timestamp}]  ReactionExecuted #${this.eventCount}`);
    console.log(`  Block: ${log.blockNumber}`);
    console.log(`  Tx:    ${log.transactionHash}`);
    console.log(`  RSC:   ${decoded.rsc}`);
    console.log(`  Vault: ${decoded.vault}`);
    console.log(`  Chain: ${decoded.chainId.toString()}`);
    console.log(`  Success: ${decoded.success}`);
    console.log(`  Data: ${decoded.data.length > 66 ? decoded.data.slice(0, 66) + '' : decoded.data}`);
  }
}

process.on('SIGINT', () => {
  console.log('\n Adapter stream stopped');
  process.exit(0);
});

new LiveAdapterStream().start().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
