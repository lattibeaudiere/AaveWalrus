const { ethers } = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

/**
 * Test script to verify Aave event fetching and display
 * Tests the server.js endpoint functionality
 */

const REACTIVE_RPC = process.env.REACTIVE_RPC || 'https://mainnet-rpc.rnk.dev';
const ARBITRUM_RPC = process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || 'https://arb1.arbitrum.io/rpc';
const RSC_ADDRESS = process.env.RSC_ADDRESS || '0x7Af5dC1f012d4a875E40d2ffD5E39d7468c59E14';
const AAVE_POOL_ADDRESS = '0x794a61358D6845594F94dc1DB02A252b5b4814aD';
const ARBITRUM_CHAIN_ID = 42161;

async function testAaveEventDisplay() {
  console.log('='.repeat(70));
  console.log('🧪 TESTING AAVE EVENT DISPLAY FUNCTIONALITY');
  console.log('='.repeat(70));
  console.log('');
  console.log(`RSC Address: ${RSC_ADDRESS}`);
  console.log(`Reactive RPC: ${REACTIVE_RPC}`);
  console.log(`Arbitrum RPC: ${ARBITRUM_RPC}`);
  console.log('');

  const reactiveProvider = new ethers.providers.JsonRpcProvider(REACTIVE_RPC);
  const arbitrumProvider = new ethers.providers.JsonRpcProvider(ARBITRUM_RPC);

  // Step 1: Get RVM ID from contract address
  console.log('1️⃣  Getting RVM ID from RSC address...');
  let rvmId;
  try {
    const mapping = await reactiveProvider.send('rnk_getRnkAddressMapping', [RSC_ADDRESS]);
    rvmId = mapping.rvmId;
    if (!rvmId) {
      console.log('   ❌ RVM ID not found for contract');
      return;
    }
    console.log(`   ✅ RVM ID: ${rvmId}`);
  } catch (error) {
    console.log(`   ❌ Error getting RVM ID: ${error.message}`);
    return;
  }
  console.log('');

  // Step 2: Get latest transaction number
  console.log('2️⃣  Getting latest transaction number...');
  let headNumber;
  try {
    headNumber = await reactiveProvider.send('rnk_getHeadNumber', [rvmId]);
    if (!headNumber || headNumber === '0x0') {
      console.log('   ❌ No transactions found');
      return;
    }
    console.log(`   ✅ Head Number: ${headNumber} (${parseInt(headNumber, 16)})`);
  } catch (error) {
    console.log(`   ❌ Error getting head number: ${error.message}`);
    return;
  }
  console.log('');

  // Step 3: Get recent transactions
  console.log('3️⃣  Getting recent transactions...');
  const queryLimit = 20;
  const headNum = parseInt(headNumber, 16);
  const fromNum = Math.max(0, headNum - queryLimit + 1);
  const fromHex = '0x' + fromNum.toString(16);
  const limitHex = '0x' + queryLimit.toString(16);

  let transactions = [];
  try {
    transactions = await reactiveProvider.send('rnk_getTransactions', [rvmId, fromHex, limitHex]);
    if (!Array.isArray(transactions)) {
      transactions = [];
    }
    console.log(`   ✅ Found ${transactions.length} transactions`);
  } catch (error) {
    console.log(`   ❌ Error getting transactions: ${error.message}`);
    return;
  }
  console.log('');

  // Step 4: Get logs and find ReactHandled events
  console.log('4️⃣  Searching for ReactHandled events...');
  const reactHandledTopic = ethers.utils.id('ReactHandled(uint256,address,uint256,uint256)');
  const reactHandledIface = new ethers.utils.Interface([
    'event ReactHandled(uint256 chainId, address emitter, uint256 txHash, uint256 logIndex)'
  ]);

  const events = [];
  for (const tx of transactions) {
    try {
      const logs = await reactiveProvider.send('rnk_getTransactionLogs', [rvmId, tx.number]);
      if (Array.isArray(logs)) {
        for (const log of logs) {
          if (log.address && log.address.toLowerCase() === RSC_ADDRESS.toLowerCase()) {
            const topic0 = log.topics && log.topics[0];
            if (topic0 === reactHandledTopic) {
              events.push({
                blockNumber: tx.sessionId ? parseInt(tx.sessionId, 16) : null,
                transactionHash: tx.hash,
                transactionNumber: tx.number,
                topics: log.topics || [],
                data: log.data || '0x',
                address: log.address
              });
            }
          }
        }
      }
    } catch (error) {
      // Skip if logs not available
    }
  }

  console.log(`   ✅ Found ${events.length} ReactHandled events`);
  console.log('');

  if (events.length === 0) {
    console.log('   ⚠️  No ReactHandled events found. The contract may not have processed any events yet.');
    console.log('');
    return;
  }

  // Step 5: Test fetching origin Aave events
  console.log('5️⃣  Testing Aave event fetching...');
  console.log('');

  let aaveEventsFound = 0;
  for (let i = 0; i < Math.min(events.length, 5); i++) {
    const event = events[i];
    try {
      const decoded = reactHandledIface.decodeEventLog('ReactHandled', event.data, event.topics);
      
      console.log(`   Event ${i + 1}:`);
      console.log(`     Chain ID: ${decoded.chainId.toString()}`);
      console.log(`     Emitter: ${decoded.emitter}`);
      console.log(`     TX Hash: ${decoded.txHash.toString()}`);
      console.log(`     Log Index: ${decoded.logIndex.toString()}`);

      // Check if it's from Aave pool
      if (decoded.emitter.toLowerCase() === AAVE_POOL_ADDRESS.toLowerCase() && 
          decoded.chainId.toString() === ARBITRUM_CHAIN_ID.toString()) {
        console.log(`     ✅ This is an Aave event from Arbitrum!`);
        
        // Convert txHash to hex string
        let txHashHex = decoded.txHash;
        if (ethers.BigNumber.isBigNumber(txHashHex)) {
          const hexStr = txHashHex.toHexString();
          txHashHex = ethers.utils.hexZeroPad(hexStr, 32);
        } else if (typeof txHashHex === 'string' && !txHashHex.startsWith('0x')) {
          txHashHex = '0x' + txHashHex.padStart(64, '0');
        } else if (typeof txHashHex === 'string') {
          txHashHex = ethers.utils.hexZeroPad(txHashHex, 32);
        }

        // Try to fetch the original Aave event
        try {
          const receipt = await arbitrumProvider.getTransactionReceipt(txHashHex);
          if (receipt && receipt.logs) {
            const logIndexNum = ethers.BigNumber.isBigNumber(decoded.logIndex) 
              ? decoded.logIndex.toNumber() 
              : parseInt(decoded.logIndex.toString());
            
            const originLog = receipt.logs.find(log => log.logIndex === logIndexNum);
            if (originLog && originLog.address.toLowerCase() === AAVE_POOL_ADDRESS.toLowerCase()) {
              console.log(`     ✅ Successfully fetched origin Aave event!`);
              console.log(`        Block: ${originLog.blockNumber}`);
              console.log(`        TX: ${originLog.transactionHash}`);
              console.log(`        Log Index: ${originLog.logIndex}`);
              console.log(`        Topics: ${originLog.topics.length}`);
              
              // Try to decode ReserveDataUpdated event
              const reserveDataUpdatedTopic = ethers.utils.id('ReserveDataUpdated(address,uint256,uint256,uint256,uint256,uint256)');
              if (originLog.topics[0] === reserveDataUpdatedTopic) {
                console.log(`        ✅ ReserveDataUpdated event detected!`);
                
                const aaveIface = new ethers.utils.Interface([
                  'event ReserveDataUpdated(address indexed reserve, uint256 liquidityRate, uint256 stableBorrowRate, uint256 variableBorrowRate, uint256 liquidityIndex, uint256 variableBorrowIndex)'
                ]);
                const decodedAave = aaveIface.decodeEventLog('ReserveDataUpdated', originLog.data, originLog.topics);
                
                const RAY = ethers.BigNumber.from(10).pow(27);
                const liquidityRatePercent = decodedAave.liquidityRate.mul(100).div(RAY);
                const liquidityRatePercentReadable = parseFloat(liquidityRatePercent.toString()) / 100;
                
                console.log(`        Reserve: ${decodedAave.reserve}`);
                console.log(`        Liquidity Rate: ${liquidityRatePercentReadable.toFixed(4)}% (${liquidityRatePercent.toString()} bps)`);
                console.log(`        Variable Borrow Rate: ${decodedAave.variableBorrowRate.toString()}`);
                aaveEventsFound++;
              } else {
                console.log(`        ⚠️  Event is not ReserveDataUpdated`);
              }
            } else {
              console.log(`     ❌ Could not find origin log at index ${logIndexNum}`);
            }
          } else {
            console.log(`     ❌ Could not fetch transaction receipt`);
          }
        } catch (fetchError) {
          console.log(`     ❌ Error fetching origin event: ${fetchError.message}`);
        }
      } else {
        console.log(`     ⚠️  Not an Aave event (emitter: ${decoded.emitter}, chain: ${decoded.chainId.toString()})`);
      }
      console.log('');
    } catch (decodeError) {
      console.log(`     ❌ Error decoding event: ${decodeError.message}`);
      console.log('');
    }
  }

  console.log('='.repeat(70));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(70));
  console.log('');
  console.log(`Total ReactHandled events: ${events.length}`);
  console.log(`Aave events found: ${aaveEventsFound}`);
  console.log('');

  if (aaveEventsFound > 0) {
    console.log('✅ SUCCESS! Aave event fetching is working correctly!');
    console.log('   The server should be able to display Aave event details in the frontend.');
  } else {
    console.log('⚠️  No Aave events found in recent transactions.');
    console.log('   The contract may not have processed any Aave events yet,');
    console.log('   or the events may be from a different source.');
  }
  console.log('');
}

testAaveEventDisplay().catch(console.error);

