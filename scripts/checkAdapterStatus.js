const { ethers } = require('ethers');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(
    process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || 'https://arb1.arbitrum.io/rpc'
  );

  const deployments = require('../deployment-addresses.json');
  const adapterAddress = deployments.ReactiveAlphaAdapter || process.env.ADAPTER_ADDRESS || '0x58DB4C40CE50FEfAD8EEaA0B609e12dE21b18805';
  const rscAddress = process.env.RSC_ADDRESS || deployments.fusionReactiveRSC?.address || '0xbc183f419B48D4fd5Ad4e375e198ECc0fd48d8A5';

  const adapterAbi = [
    'function MANAGER() view returns (address)',
    'function targetVault() view returns (address)',
    'function getRSCConfig(address) view returns (tuple(bool isActive,uint64 executionCount,uint64 lastExecution,address vault))',
    'event ReactionExecuted(address indexed rsc,address indexed vault,uint256 indexed chainId,bool success,bytes data)'
  ];

  const adapter = new ethers.Contract(adapterAddress, adapterAbi, provider);

  console.log('Adapter:', adapterAddress);
  console.log('RSC:', rscAddress);

  const manager = await adapter.MANAGER().catch(() => null);
  console.log('Manager:', manager);

  const targetVault = await adapter.targetVault().catch(() => null);
  console.log('Target vault:', targetVault);

  const config = await adapter.getRSCConfig(rscAddress).catch((err) => {
    console.log('getRSCConfig reverted:', err.message.split('\n')[0]);
    return null;
  });

  if (config) {
    console.log('RSC Config:');
    console.log('  isActive:', config.isActive);
    console.log('  executionCount:', config.executionCount.toString());
    console.log('  lastExecution:', config.lastExecution.toString());
    console.log('  vault:', config.vault);
  }

  const latest = await provider.getBlockNumber();
  const fromBlock = Math.max(0, latest - 500000);
  const events = await adapter.queryFilter(adapter.filters.ReactionExecuted(rscAddress), fromBlock, latest);

  console.log(`ReactionExecuted events in last 500k blocks: ${events.length}`);
  events.slice(-5).forEach((ev, idx) => {
    const decoded = adapter.interface.decodeEventLog('ReactionExecuted', ev.data, ev.topics);
    console.log(`  #${events.length - Math.min(events.length, 5) + idx + 1}: success=${decoded.success}, tx=${ev.transactionHash}`);
  });
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
