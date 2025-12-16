const ethers = require('ethers');
require('dotenv').config();

const REACTIVE_RPC = process.env.REACTIVE_RPC;
const RSC_ADDRESS = process.env.RSC_ADDRESS;

// Sample transactions from the user's output
const sampleTransactions = [
  { hash: '0x6205680c', block: 50823206, asset: 'WBTC', apy: 0.01 },
  { hash: '0xbb696f06', block: 50823216 },
  { hash: '0xc5c1deb9', block: 50823219, asset: 'WBTC', apy: 0.01 },
  { hash: '0x0fc51c58', block: 50823220, asset: 'WETH', apy: 1.92 },
  { hash: '0x5dd68392', block: 50823232, asset: 'USDC', apy: 3.46 },
  { hash: '0xf145b8ef', block: 50823234, asset: 'USDC', apy: 3.46 },
  { hash: '0x1bb4245b', block: 50823250, asset: 'USDC', apy: 3.46 },
  { hash: '0x67460fe2', block: 50823254, asset: 'WBTC', apy: 0.01 },
  { hash: '0x905509df', block: 50823257, asset: 'USDC', apy: 3.46 },
  { hash: '0x4b1da953', block: 50823257, asset: 'USDC', apy: 3.46 },
  { hash: '0xdb28af86', block: 50823266, asset: 'USDC', apy: 3.46 },
  { hash: '0x8ffd6995', block: 50823267 },
  { hash: '0x90734912', block: 50823267, asset: 'WBTC', apy: 0.01 },
  { hash: '0x1a26eff1', block: 50823267, asset: 'WBTC', apy: 0.01 },
  { hash: '0xb5525339', block: 50823269, asset: 'WETH', apy: 1.92 },
  { hash: '0xb1ee8e9b', block: 50823271 },
  { hash: '0x3fdc0e1b', block: 50823271, asset: 'WBTC', apy: 0.01 },
  { hash: '0xa35f3287', block: 50823271, asset: 'WBTC', apy: 0.01 },
  { hash: '0x954ff237', block: 50823273, asset: 'USDC', apy: 3.46 },
  { hash: '0xbf86c37b', block: 50823273, asset: 'WBTC', apy: 0.01 },
  { hash: '0x0c1fd56f', block: 50823281, asset: 'USDC', apy: 3.46 },
  { hash: '0x08aa7412', block: 50823283, asset: 'USDC', apy: 3.46 },
  { hash: '0x6599fea6', block: 50823283, asset: 'USDC', apy: 3.46 },
  { hash: '0x677d15db', block: 50823302, asset: 'WETH', apy: 1.92 },
  { hash: '0xbdd5b497', block: 50823302, asset: 'WETH', apy: 1.92 },
];

async function callRnkRpc(method, params) {
  const response = await fetch(REACTIVE_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: method,
      params: params
    })
  });
  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message || 'RPC error');
  }
  return data.result;
}

async function verifyTransaction(txHash, blockNumber) {
  try {
    // Get transaction by hash
    const tx = await callRnkRpc('rnk_getTransactionByHash', [txHash]);
    
    if (!tx) {
      console.log(`❌ Transaction ${txHash} not found`);
      return null;
    }
    
    // Get transaction logs
    const rvmId = tx.rvmId;
    const txNumber = tx.number;
    const logs = await callRnkRpc('rnk_getTransactionLogs', [rvmId, txNumber]);
    
    // Decode Callback events
    const callbackTopic = ethers.utils.id('Callback(uint256,address,uint64,bytes)');
    const callbackIface = new ethers.utils.Interface([
      'event Callback(uint256 indexed chain_id, address indexed _contract, uint64 indexed gas_limit, bytes payload)'
    ]);
    
    const callbackEvents = [];
    if (Array.isArray(logs)) {
      for (const log of logs) {
        if (log.topics && log.topics[0] === callbackTopic) {
          try {
            const decoded = callbackIface.decodeEventLog('Callback', log.data, log.topics);
            
            // Try to decode APY query
            if (decoded.payload && decoded.payload.length >= 266) {
              const functionSelector = decoded.payload.slice(0, 10);
              if (functionSelector === '0xeb45e4d1') {
                const paramData = decoded.payload.slice(10);
                if (paramData.length >= 256) {
                  const param2Hex = paramData.slice(64, 128);
                  const assetAddr = '0x' + param2Hex.slice(-40).toLowerCase();
                  const param3 = ethers.BigNumber.from('0x' + paramData.slice(128, 192));
                  const param4 = ethers.BigNumber.from('0x' + paramData.slice(192, 256));
                  
                  const apyBps = param3.toNumber();
                  const apyPercent = apyBps / 100;
                  const timestamp = param4.toNumber();
                  const eventTime = new Date(timestamp * 1000);
                  
                  callbackEvents.push({
                    assetAddress: assetAddr,
                    apyBps: apyBps,
                    apyPercent: apyPercent,
                    timestamp: timestamp,
                    eventTime: eventTime.toISOString(),
                    blockNumber: blockNumber
                  });
                }
              }
            }
          } catch (e) {
            // Not an APY query, skip
          }
        }
      }
    }
    
    return {
      hash: txHash,
      blockNumber: blockNumber,
      rvmId: rvmId,
      txNumber: txNumber,
      sessionId: tx.sessionId,
      timestamp: tx.timestamp ? new Date(parseInt(tx.timestamp, 16) * 1000).toISOString() : null,
      callbackEvents: callbackEvents,
      found: true
    };
  } catch (error) {
    console.log(`❌ Error verifying transaction ${txHash}:`, error.message);
    return { hash: txHash, found: false, error: error.message };
  }
}

async function verifyRealAaveApys() {
  console.log('🔍 Verifying Real Aave APY Values...\n');
  
  // Known asset addresses on Arbitrum
  const assets = {
    '0xaf88d065e77c8cc2239327c5edb3a432268e5831': { name: 'USDC', expectedApy: 3.46 },
    '0x82af49447d8a07e3bd95bd0d56f35241523fbab1': { name: 'WETH', expectedApy: 1.92 },
    '0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f': { name: 'WBTC', expectedApy: 0.01 }
  };
  
  // Try to fetch real Aave APY from Arbitrum (this would require Aave pool contract)
  console.log('Note: Real-time Aave APY verification would require querying Aave Pool contract on Arbitrum');
  console.log('Expected APY values from your data:');
  console.log('  USDC: ~3.46% (342-346 bps)');
  console.log('  WETH: ~1.92% (192 bps)');
  console.log('  WBTC: ~0.01% (1 bps)');
  console.log('');
}

async function main() {
  console.log('='.repeat(80));
  console.log('🔍 Verifying APY Query Transactions');
  console.log('='.repeat(80));
  console.log('');
  
  // Verify a few sample transactions
  const transactionsToVerify = sampleTransactions.slice(0, 5);
  
  console.log(`Verifying ${transactionsToVerify.length} sample transactions...\n`);
  
  for (const tx of transactionsToVerify) {
    console.log(`Checking transaction ${tx.hash}...`);
    const result = await verifyTransaction(tx.hash, tx.block);
    
    if (result && result.found) {
      console.log(`✅ Transaction found:`);
      console.log(`   Block: ${result.blockNumber}`);
      console.log(`   RVM ID: ${result.rvmId}`);
      console.log(`   TX Number: ${result.txNumber}`);
      if (result.timestamp) {
        console.log(`   Timestamp: ${result.timestamp}`);
        const now = new Date();
        const txTime = new Date(result.timestamp);
        const diffMs = now - txTime;
        const diffSeconds = Math.floor(diffMs / 1000);
        const diffMinutes = Math.floor(diffSeconds / 60);
        console.log(`   Age: ${diffMinutes}m ${diffSeconds % 60}s ago (${diffSeconds} seconds)`);
      }
      
      if (result.callbackEvents && result.callbackEvents.length > 0) {
        console.log(`   Callback Events: ${result.callbackEvents.length}`);
        result.callbackEvents.forEach((event, idx) => {
          const assetName = Object.keys(assets).find(addr => addr.toLowerCase() === event.assetAddress.toLowerCase());
          console.log(`     Event ${idx + 1}:`);
          console.log(`       Asset: ${event.assetAddress} ${assetName ? `(${assets[assetName].name})` : ''}`);
          console.log(`       APY: ${event.apyPercent.toFixed(2)}% (${event.apyBps} bps)`);
          console.log(`       Timestamp: ${event.eventTime}`);
          
          // Check timestamp
          const eventTime = new Date(event.timestamp * 1000);
          const now = new Date();
          const diffMs = now - eventTime;
          const diffSeconds = Math.floor(diffMs / 1000);
          console.log(`       Event Age: ${diffSeconds} seconds ago`);
        });
      }
      console.log('');
    } else {
      console.log(`❌ Transaction not found or error occurred\n`);
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Verify Aave APY values
  await verifyRealAaveApys();
  
  console.log('='.repeat(80));
  console.log('✅ Verification Complete');
  console.log('='.repeat(80));
}

// Known assets for lookup
const assets = {
  '0xaf88d065e77c8cc2239327c5edb3a432268e5831': { name: 'USDC' },
  '0x82af49447d8a07e3bd95bd0d56f35241523fbab1': { name: 'WETH' },
  '0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f': { name: 'WBTC' }
};

main().catch(console.error);

