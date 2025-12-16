const { ethers } = require('ethers');
const https = require('http');
require('dotenv').config();

/**
 * Automated script to measure actual REACT token spending
 * 
 * Process:
 * 1. Check initial balance/reserves
 * 2. Watch stream for 2 minutes
 * 3. Count events processed
 * 4. Check final balance/reserves
 * 5. Calculate cost per event
 * 6. Project to 24 hours
 */

const REACTIVE_RPC = process.env.REACTIVE_RPC || 'https://mainnet-rpc.rnk.dev';
const RSC_ADDRESS = '0xbc183f419B48D4fd5Ad4e375e198ECc0fd48d8A5';
const SYSTEM_CONTRACT = '0x0000000000000000000000000000000000fffFfF';
const WATCH_DURATION_SECONDS = 120; // 2 minutes

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
    netBalance: reserves.sub(debt)
  };
}

async function fetchEvents(rscAddress, limit = 200) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ rscAddress, limit });
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
  console.log('💰 AUTOMATED REACT SPENDING MEASUREMENT');
  console.log('='.repeat(70));
  console.log('');
  
  const provider = new ethers.providers.JsonRpcProvider(REACTIVE_RPC);
  
  // Step 1: Get initial balance
  console.log('📊 Step 1: Checking Initial Balance...');
  const initialStatus = await getEconomyStatus(provider);
  console.log('  Direct Balance:', ethers.utils.formatEther(initialStatus.directBalance), 'REACT');
  console.log('  Reserves:', ethers.utils.formatEther(initialStatus.reserves), 'REACT');
  console.log('  Debt:', ethers.utils.formatEther(initialStatus.debt), 'REACT');
  console.log('  Net Balance:', ethers.utils.formatEther(initialStatus.netBalance), 'REACT');
  console.log('');
  
  // Get initial event count
  console.log('📊 Step 2: Getting Initial Event Count...');
  const initialEvents = await fetchEvents(RSC_ADDRESS, 500);
  const initialEventCount = initialEvents.count || 0;
  const initialEventHashes = new Set();
  if (initialEvents.events) {
    initialEvents.events.forEach(e => {
      if (e.transactionHash) {
        initialEventHashes.add(e.transactionHash);
      }
    });
  }
  console.log('  Initial Events:', initialEventCount);
  console.log('  Unique Transactions:', initialEventHashes.size);
  console.log('');
  
  // Step 3: Watch stream for 2 minutes
  console.log(`⏱️  Step 3: Watching Stream for ${WATCH_DURATION_SECONDS} seconds...`);
  console.log('  Start Time:', new Date().toISOString());
  console.log('');
  
  const startTime = Date.now();
  const endTime = startTime + (WATCH_DURATION_SECONDS * 1000);
  let lastSeenHashes = new Set(initialEventHashes);
  let newEvents = [];
  let pollCount = 0;
  
  // Poll every 5 seconds
  const pollInterval = setInterval(async () => {
    try {
      pollCount++;
      const result = await fetchEvents(RSC_ADDRESS, 500);
      
      if (result.events) {
        const currentHashes = new Set();
        result.events.forEach(e => {
          if (e.transactionHash) {
            currentHashes.add(e.transactionHash);
            if (!lastSeenHashes.has(e.transactionHash)) {
              newEvents.push({
                ...e,
                receivedAt: e.receivedAt || Date.now() / 1000
              });
            }
          }
        });
        lastSeenHashes = currentHashes;
      }
      
      const elapsed = (Date.now() - startTime) / 1000;
      const remaining = WATCH_DURATION_SECONDS - elapsed;
      process.stdout.write(`\r  Polling... ${elapsed.toFixed(0)}s elapsed, ${remaining.toFixed(0)}s remaining, ${newEvents.length} new events`);
      
      if (Date.now() >= endTime) {
        clearInterval(pollInterval);
        process.stdout.write('\n');
      }
    } catch (error) {
      console.error(`\n  Error polling: ${error.message}`);
    }
  }, 5000);
  
  // Wait for duration
  await new Promise(resolve => setTimeout(resolve, WATCH_DURATION_SECONDS * 1000));
  clearInterval(pollInterval);
  
  console.log('');
  console.log('  End Time:', new Date().toISOString());
  console.log('  Total Polls:', pollCount);
  console.log('');
  
  // Step 4: Get final balance
  console.log('📊 Step 4: Checking Final Balance...');
  const finalStatus = await getEconomyStatus(provider);
  console.log('  Direct Balance:', ethers.utils.formatEther(finalStatus.directBalance), 'REACT');
  console.log('  Reserves:', ethers.utils.formatEther(finalStatus.reserves), 'REACT');
  console.log('  Debt:', ethers.utils.formatEther(finalStatus.debt), 'REACT');
  console.log('  Net Balance:', ethers.utils.formatEther(finalStatus.netBalance), 'REACT');
  console.log('');
  
  // Step 5: Calculate spending
  console.log('💰 Step 5: Calculating Actual Spending...');
  const reserveSpent = initialStatus.reserves.sub(finalStatus.reserves);
  const debtIncrease = finalStatus.debt.sub(initialStatus.debt);
  const netSpent = reserveSpent.add(debtIncrease);
  
  console.log('  Reserve Change:', ethers.utils.formatEther(reserveSpent), 'REACT');
  console.log('  Debt Change:', ethers.utils.formatEther(debtIncrease), 'REACT');
  console.log('  Net Spent:', ethers.utils.formatEther(netSpent), 'REACT');
  console.log('');
  
  // Step 6: Analyze events
  console.log('📊 Step 6: Event Analysis...');
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
  console.log('💰 Step 7: Cost Per Event Calculation...');
  
  if (newEvents.length > 0 && netSpent.gt(0)) {
    const costPerEvent = netSpent.div(newEvents.length);
    console.log('  Cost per Event:', ethers.utils.formatEther(costPerEvent), 'REACT');
    console.log('  Events in', WATCH_DURATION_SECONDS, 'seconds:', newEvents.length);
    
    const eventsPerSecond = newEvents.length / WATCH_DURATION_SECONDS;
    const eventsPerHour = eventsPerSecond * 3600;
    const eventsPerDay = eventsPerHour * 24;
    
    console.log('');
    console.log('  Event Rate:');
    console.log('    Per Second:', eventsPerSecond.toFixed(4));
    console.log('    Per Hour:', eventsPerHour.toFixed(2));
    console.log('    Per Day:', eventsPerDay.toFixed(0));
    console.log('');
    
    // Step 8: Project to 24 hours
    console.log('📈 Step 8: 24-Hour Projection...');
    const dailyCost = netSpent.mul(Math.floor(86400 / WATCH_DURATION_SECONDS));
    const monthlyCost = dailyCost.mul(30);
    
    console.log('  Daily Cost:', ethers.utils.formatEther(dailyCost), 'REACT');
    console.log('  Monthly Cost:', ethers.utils.formatEther(monthlyCost), 'REACT');
    console.log('  Daily Events:', eventsPerDay.toFixed(0));
    console.log('  Monthly Events:', (eventsPerDay * 30).toFixed(0));
    console.log('');
    
    // Calculate days remaining
    const daysRemaining = finalStatus.netBalance.div(dailyCost);
    console.log('  Days Remaining (at current rate):', daysRemaining.toString(), 'days');
    console.log('');
    
    // Summary
    console.log('='.repeat(70));
    console.log('📊 SUMMARY');
    console.log('='.repeat(70));
    console.log('Measurement Period:', WATCH_DURATION_SECONDS, 'seconds');
    console.log('Events Processed:', newEvents.length);
    console.log('REACT Spent:', ethers.utils.formatEther(netSpent), 'REACT');
    console.log('Cost per Event:', ethers.utils.formatEther(costPerEvent), 'REACT');
    console.log('');
    console.log('Projected (24 hours):');
    console.log('  Events:', eventsPerDay.toFixed(0));
    console.log('  Cost:', ethers.utils.formatEther(dailyCost), 'REACT/day');
    console.log('  Monthly:', ethers.utils.formatEther(monthlyCost), 'REACT/month');
    console.log('');
    console.log('Current Reserves:', ethers.utils.formatEther(finalStatus.netBalance), 'REACT');
    console.log('Days Remaining:', daysRemaining.toString(), 'days');
    console.log('='.repeat(70));
    
  } else {
    console.log('  ⚠️  No new events detected or no spending occurred');
    console.log('  This could mean:');
    console.log('    - No events processed during measurement period');
    console.log('    - Events processed but no gas spent (unlikely)');
    console.log('    - Measurement period too short');
  }
}

// Run the measurement
measureSpending().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

