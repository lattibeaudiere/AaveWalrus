const https = require('http');
const { ethers } = require('ethers');
require('dotenv').config();

/**
 * Real-Time Spending Measurement Script
 * 
 * Measures actual REACT token spending by:
 * 1. Checking initial balance/reserves
 * 2. Monitoring event stream for 10 minutes
 * 3. Counting events processed
 * 4. Checking final balance/reserves
 * 5. Calculating cost per event
 * 6. Projecting to 24 hours
 */

const REACTIVE_RPC = process.env.REACTIVE_RPC || 'https://mainnet-rpc.rnk.dev';
const RSC_ADDRESS = '0xbc183f419B48D4fd5Ad4e375e198ECc0fd48d8A5';
const SYSTEM_CONTRACT = '0x0000000000000000000000000000000000fffFfF';
const MONITORING_DURATION_SECONDS = 600; // 10 minutes

const systemAbi = [
  'function reserves(address) view returns (uint256)',
  'function debts(address) view returns (uint256)'
];

async function getEconomyStatus(provider) {
  const systemContract = new ethers.Contract(SYSTEM_CONTRACT, systemAbi, provider);
  const [balance, reserves, debt] = await Promise.all([
    provider.getBalance(RSC_ADDRESS),
    systemContract.reserves(RSC_ADDRESS),
    systemContract.debts(RSC_ADDRESS)
  ]);
  
  return {
    directBalance: balance,
    reserves: reserves,
    debt: debt,
    netBalance: reserves.sub(debt),
    totalInSystem: reserves.add(balance)
  };
}

async function fetchEvents() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      rscAddress: RSC_ADDRESS,
      limit: 200
    });

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/rsc-events',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function measureSpending() {
  console.log('='.repeat(70));
  console.log('💰 REAL-TIME SPENDING MEASUREMENT');
  console.log('='.repeat(70));
  console.log(`Monitoring Duration: ${MONITORING_DURATION_SECONDS} seconds (10 minutes)`);
  console.log(`RSC Address: ${RSC_ADDRESS}`);
  console.log('');

  const provider = new ethers.providers.JsonRpcProvider(REACTIVE_RPC);

  // Step 1: Check initial balance
  console.log('📊 Step 1: Checking Initial Balance...');
  const initialStatus = await getEconomyStatus(provider);
  console.log('  Direct Balance:', ethers.utils.formatEther(initialStatus.directBalance), 'REACT');
  console.log('  Reserves:', ethers.utils.formatEther(initialStatus.reserves), 'REACT');
  console.log('  Debt:', ethers.utils.formatEther(initialStatus.debt), 'REACT');
  console.log('  Net Balance:', ethers.utils.formatEther(initialStatus.netBalance), 'REACT');
  console.log('  Total in System:', ethers.utils.formatEther(initialStatus.totalInSystem), 'REACT');
  console.log('');

  // Step 2: Get initial event count
  console.log('📡 Step 2: Getting Initial Event Count...');
  const initialEvents = await fetchEvents();
  const initialEventCount = initialEvents.count || 0;
  const initialEventIds = new Set();
  if (initialEvents.events) {
    initialEvents.events.forEach(e => {
      const key = `${e.transactionHash}-${e.topics[0]}`;
      initialEventIds.add(key);
    });
  }
  console.log('  Initial Events:', initialEventCount);
  console.log('  Unique Event IDs:', initialEventIds.size);
  console.log('');

  // Step 3: Monitor for 10 minutes
  console.log('⏱️  Step 3: Monitoring Event Stream for 10 Minutes...');
  console.log('  Started at:', new Date().toISOString());
  console.log('  Watching for new events...');
  console.log('');

  const startTime = Date.now();
  const endTime = startTime + (MONITORING_DURATION_SECONDS * 1000);
  const newEvents = [];
  let pollCount = 0;

  // Poll every 5 seconds
  const pollInterval = setInterval(async () => {
    try {
      pollCount++;
      const result = await fetchEvents();
      
      if (result.events) {
        result.events.forEach(e => {
          const key = `${e.transactionHash}-${e.topics[0]}`;
          if (!initialEventIds.has(key)) {
            // New event
            if (!newEvents.find(ne => `${ne.transactionHash}-${ne.topics[0]}` === key)) {
              newEvents.push(e);
              initialEventIds.add(key);
            }
          }
        });
      }

      const elapsed = (Date.now() - startTime) / 1000;
      const remaining = MONITORING_DURATION_SECONDS - elapsed;
      process.stdout.write(`\r  [${elapsed.toFixed(0)}s] New events: ${newEvents.length} (${remaining.toFixed(0)}s remaining)`);
    } catch (error) {
      console.error(`\n  Error polling: ${error.message}`);
    }
  }, 5000);

  // Wait for monitoring period
  await new Promise(resolve => setTimeout(resolve, MONITORING_DURATION_SECONDS * 1000));
  clearInterval(pollInterval);
  console.log('\n');

  // Step 4: Check final balance
  console.log('📊 Step 4: Checking Final Balance...');
  const finalStatus = await getEconomyStatus(provider);
  console.log('  Direct Balance:', ethers.utils.formatEther(finalStatus.directBalance), 'REACT');
  console.log('  Reserves:', ethers.utils.formatEther(finalStatus.reserves), 'REACT');
  console.log('  Debt:', ethers.utils.formatEther(finalStatus.debt), 'REACT');
  console.log('  Net Balance:', ethers.utils.formatEther(finalStatus.netBalance), 'REACT');
  console.log('  Total in System:', ethers.utils.formatEther(finalStatus.totalInSystem), 'REACT');
  console.log('');

  // Step 5: Calculate spending
  console.log('💰 Step 5: Calculating Spending...');
  const reservesSpent = initialStatus.reserves.sub(finalStatus.reserves);
  const balanceSpent = initialStatus.directBalance.sub(finalStatus.directBalance);
  const totalSpent = reservesSpent.add(balanceSpent);
  const debtChange = finalStatus.debt.sub(initialStatus.debt);
  
  console.log('  Reserves Change:', ethers.utils.formatEther(reservesSpent), 'REACT');
  console.log('  Direct Balance Change:', ethers.utils.formatEther(balanceSpent), 'REACT');
  console.log('  Total Spent:', ethers.utils.formatEther(totalSpent), 'REACT');
  console.log('  Debt Change:', ethers.utils.formatEther(debtChange), 'REACT');
  console.log('');

  // Step 6: Analyze events
  console.log('📈 Step 6: Event Analysis...');
  console.log('  New Events Detected:', newEvents.length);
  
  const byType = {};
  newEvents.forEach(e => {
    byType[e.eventType] = (byType[e.eventType] || 0) + 1;
  });
  
  console.log('  Events by Type:');
  Object.keys(byType).forEach(type => {
    console.log(`    ${type}: ${byType[type]}`);
  });
  
  const apyQueries = newEvents.filter(e => e.apyQuery).length;
  const rebalances = newEvents.filter(e => e.callbackData && e.callbackData.action === 'executeReaction').length;
  console.log('  APY Queries:', apyQueries);
  console.log('  Rebalance Executions:', rebalances);
  console.log('');

  // Step 7: Calculate cost per event
  console.log('💵 Step 7: Cost Per Event Calculation...');
  if (newEvents.length > 0 && totalSpent.gt(0)) {
    const costPerEvent = totalSpent.div(newEvents.length);
    console.log('  Cost per Event:', ethers.utils.formatEther(costPerEvent), 'REACT');
    console.log('  Cost per Event (wei):', costPerEvent.toString());
  } else if (newEvents.length > 0) {
    // If no spending detected, calculate based on gas prices
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice;
    const callbackGas = 80000;
    const callbackCost = gasPrice.mul(callbackGas);
    console.log('  No spending detected in reserves (may be using debt)');
    console.log('  Estimated cost per callback (80k gas @ ' + ethers.utils.formatUnits(gasPrice, 'gwei') + ' gwei):', ethers.utils.formatEther(callbackCost), 'REACT');
  } else {
    console.log('  No new events detected - cannot calculate cost');
  }
  console.log('');

  // Step 8: Project to 24 hours
  console.log('📊 Step 8: 24-Hour Projection...');
  const monitoringSeconds = MONITORING_DURATION_SECONDS;
  const eventsPerSecond = newEvents.length / monitoringSeconds;
  const eventsPerMinute = eventsPerSecond * 60;
  const eventsPerHour = eventsPerMinute * 60;
  const eventsPerDay = eventsPerHour * 24;
  
  console.log('  Events per Second:', eventsPerSecond.toFixed(4));
  console.log('  Events per Minute:', eventsPerMinute.toFixed(2));
  console.log('  Events per Hour:', eventsPerHour.toFixed(2));
  console.log('  Events per Day (projected):', eventsPerDay.toFixed(0));
  console.log('');

  if (newEvents.length > 0 && totalSpent.gt(0)) {
    const costPerEvent = totalSpent.div(newEvents.length);
    const dailyCost = costPerEvent.mul(Math.floor(eventsPerDay));
    const monthlyCost = dailyCost.mul(30);
    
    console.log('  Daily Cost (projected):', ethers.utils.formatEther(dailyCost), 'REACT');
    console.log('  Monthly Cost (projected):', ethers.utils.formatEther(monthlyCost), 'REACT');
  } else if (newEvents.length > 0) {
    // Use estimated gas costs
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice;
    const callbackGas = 80000;
    const callbackCost = gasPrice.mul(callbackGas);
    const dailyCost = callbackCost.mul(Math.floor(eventsPerDay));
    const monthlyCost = dailyCost.mul(30);
    
    console.log('  Daily Cost (estimated):', ethers.utils.formatEther(dailyCost), 'REACT');
    console.log('  Monthly Cost (estimated):', ethers.utils.formatEther(monthlyCost), 'REACT');
  }
  console.log('');

  // Step 9: Summary
  console.log('='.repeat(70));
  console.log('📋 SUMMARY');
  console.log('='.repeat(70));
  console.log('Monitoring Period:', monitoringSeconds, 'seconds');
  console.log('Events Processed:', newEvents.length);
  console.log('Total Spent:', ethers.utils.formatEther(totalSpent), 'REACT');
  if (newEvents.length > 0) {
    console.log('Cost per Event:', ethers.utils.formatEther(totalSpent.div(newEvents.length)), 'REACT');
  }
  console.log('Projected Daily Events:', Math.floor(eventsPerDay));
  if (newEvents.length > 0 && totalSpent.gt(0)) {
    const dailyCost = totalSpent.div(newEvents.length).mul(Math.floor(eventsPerDay));
    console.log('Projected Daily Cost:', ethers.utils.formatEther(dailyCost), 'REACT');
    console.log('Projected Monthly Cost:', ethers.utils.formatEther(dailyCost.mul(30)), 'REACT');
  }
  console.log('='.repeat(70));
}

// Run the measurement
measureSpending().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});

