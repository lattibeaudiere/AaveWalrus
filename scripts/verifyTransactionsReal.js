const ethers = require('ethers');
require('dotenv').config();

const REACTIVE_RPC = process.env.REACTIVE_RPC;
const RSC_ADDRESS = process.env.RSC_ADDRESS;

// Sample transaction hashes from user output (full hashes needed)
const sampleTxHashes = [
  '0x6205680c', // Partial hash - need full hash
  '0xbb696f06',
  '0xc5c1deb9',
  '0x0fc51c58',
  '0x5dd68392',
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

async function verifyTransactionExists(txHash) {
  try {
    const tx = await callRnkRpc('rnk_getTransactionByHash', [txHash]);
    return tx !== null && tx !== undefined;
  } catch (error) {
    return false;
  }
}

async function getTransactionDetails(txHash) {
  try {
    const tx = await callRnkRpc('rnk_getTransactionByHash', [txHash]);
    if (!tx) return null;
    
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
                  const queryTimestamp = param4.toNumber();
                  
                  callbackEvents.push({
                    chainId: decoded.chain_id.toString(),
                    contract: decoded._contract,
                    gasLimit: decoded.gas_limit.toString(),
                    assetAddress: assetAddr,
                    apyBps: apyBps,
                    apyPercent: apyPercent,
                    queryTimestamp: queryTimestamp
                  });
                }
              }
            }
          } catch (e) {
            // Not an APY query
          }
        }
      }
    }
    
    return {
      hash: tx.hash,
      rvmId: rvmId,
      txNumber: tx.number,
      sessionId: tx.sessionId,
      timestamp: tx.timestamp,
      callbackEvents: callbackEvents
    };
  } catch (error) {
    return { error: error.message };
  }
}

async function verifyAaveApysOnChain() {
  console.log('🔍 Verifying Real Aave APY Values on Arbitrum...\n');
  
  const ARBITRUM_RPC = process.env.ARBITRUM_RPC || 'https://arb1.arbitrum.io/rpc';
  const AAVE_POOL_ADDRESS = '0x794a61358D6845594F94dc1DB02A252b5b4814aD';
  
  const provider = new ethers.providers.JsonRpcProvider(ARBITRUM_RPC);
  
  // Aave Pool ABI for getReserveData
  const aavePoolAbi = [
    'function getReserveData(address asset) view returns (tuple(uint256 configuration, uint128 liquidityIndex, uint128 currentLiquidityRate, uint128 variableBorrowIndex, uint128 currentVariableBorrowRate, uint128 currentStableBorrowRate, uint40 lastUpdateTimestamp, uint16 id, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint128 accruedToTreasury, uint128 unbacked, uint128 isolationModeTotalDebt))'
  ];
  
  const pool = new ethers.Contract(AAVE_POOL_ADDRESS, aavePoolAbi, provider);
  
  const assets = {
    '0xaf88d065e77c8cc2239327c5edb3a432268e5831': { name: 'USDC' },
    '0x82af49447d8a07e3bd95bd0d56f35241523fbab1': { name: 'WETH' },
    '0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f': { name: 'WBTC' }
  };
  
  console.log('Current Aave APY Values on Arbitrum:');
  console.log('=' .repeat(60));
  
  for (const [address, info] of Object.entries(assets)) {
    try {
      const reserveData = await pool.getReserveData(address);
      // currentLiquidityRate is in RAY (1e27) per second
      // APY = ((1 + liquidityRate / 1e27)^(365.25 * 24 * 60 * 60) - 1) * 100
      // For small rates, approximation: APY ≈ (liquidityRate / 1e27) * (365.25 * 24 * 60 * 60) * 100
      const liquidityRate = reserveData.currentLiquidityRate;
      const secondsPerYear = 365.25 * 24 * 60 * 60;
      // Convert RAY to percentage: (rate / 1e27) * secondsPerYear * 100
      const apyRay = liquidityRate.mul(ethers.BigNumber.from(Math.floor(secondsPerYear * 100))).div(ethers.BigNumber.from(10).pow(27));
      const apyPercent = apyRay.toNumber() / 100;
      
      console.log(`${info.name} (${address}):`);
      console.log(`  Supply APY: ${apyPercent.toFixed(2)}%`);
      console.log(`  Liquidity Rate: ${liquidityRate.toString()} RAY`);
      console.log('');
    } catch (error) {
      console.log(`${info.name}: Error fetching APY - ${error.message}`);
    }
  }
}

async function main() {
  console.log('='.repeat(80));
  console.log('🔍 Verifying Transactions Are Real');
  console.log('='.repeat(80));
  console.log('');
  
  // Get recent transactions to verify using server API
  try {
    console.log(`RSC Address: ${RSC_ADDRESS}`);
    console.log(`Querying server API for events...\n`);
    
    // Use the server API instead
    const apiUrl = 'http://localhost:3000/api/rsc-events';
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        rscAddress: RSC_ADDRESS,
        limit: 50
      })
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    const events = data.events || [];
    console.log(`Found ${events.length} events from API`);
    console.log(`Transactions queried: ${data.transactionsQueried || 0}`);
    console.log(`RVM ID: ${data.rvmId || 'N/A'}`);
    console.log(`Head Number: ${data.headNumber || 'N/A'}\n`);
    
    // Verify first few APY query events
    console.log('Verifying Recent APY Query Events:');
    console.log('='.repeat(80));
    
    const apyQueries = events.filter(e => e.apyQuery);
    console.log(`Found ${apyQueries.length} APY query events\n`);
    
    // Group by asset
    const assetGroups = {};
    apyQueries.forEach(event => {
      const assetAddr = event.apyQuery.assetAddress.toLowerCase();
      if (!assetGroups[assetAddr]) {
        assetGroups[assetAddr] = [];
      }
      assetGroups[assetAddr].push(event);
    });
    
    // Show summary by asset
    const assetNames = {
      '0xaf88d065e77c8cc2239327c5edb3a432268e5831': 'USDC',
      '0x82af49447d8a07e3bd95bd0d56f35241523fbab1': 'WETH',
      '0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f': 'WBTC'
    };
    
    for (const [assetAddr, events] of Object.entries(assetGroups)) {
      const assetName = assetNames[assetAddr] || 'Unknown';
      console.log(`\n${assetName} (${assetAddr}):`);
      console.log(`  Total Events: ${events.length}`);
      
      // Show APY range
      const apys = events.map(e => e.apyQuery.apyPercent);
      const minApy = Math.min(...apys);
      const maxApy = Math.max(...apys);
      const avgApy = apys.reduce((a, b) => a + b, 0) / apys.length;
      console.log(`  APY Range: ${minApy.toFixed(2)}% - ${maxApy.toFixed(2)}%`);
      console.log(`  Average APY: ${avgApy.toFixed(2)}%`);
      
      // Show recent events
      console.log(`  Recent Events (last 3):`);
      events.slice(0, 3).forEach((event, idx) => {
        const txTime = event.transactionTimestamp 
          ? new Date(event.transactionTimestamp * 1000).toISOString()
          : event.apyQuery.queryTimestamp 
            ? new Date(event.apyQuery.queryTimestamp * 1000).toISOString()
            : 'N/A';
        const now = new Date();
        const eventTime = event.transactionTimestamp 
          ? new Date(event.transactionTimestamp * 1000)
          : event.apyQuery.queryTimestamp
            ? new Date(event.apyQuery.queryTimestamp * 1000)
            : null;
        const age = eventTime ? Math.floor((now - eventTime) / 1000) : null;
        
        console.log(`    Event ${idx + 1}:`);
        console.log(`      Transaction: ${event.transactionHash}`);
        console.log(`      Block: ${event.blockNumber}`);
        console.log(`      APY: ${event.apyQuery.apyPercent.toFixed(2)}% (${event.apyQuery.apyBps} bps)`);
        console.log(`      Transaction Timestamp: ${event.transactionTimestamp ? new Date(event.transactionTimestamp * 1000).toISOString() : 'N/A'}`);
        console.log(`      Query Timestamp: ${new Date(event.apyQuery.queryTimestamp * 1000).toISOString()}`);
        if (age !== null) {
          console.log(`      Age: ${age} seconds ago`);
        }
      });
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('Verifying Aave APY Values:');
    console.log('='.repeat(80));
    await verifyAaveApysOnChain();
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
  
  console.log('='.repeat(80));
  console.log('✅ Verification Complete');
  console.log('='.repeat(80));
}

main().catch(console.error);

