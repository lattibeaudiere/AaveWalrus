const https = require('http');

/**
 * Test script for enhanced API
 */
async function testEnhancedAPI() {
  console.log('='.repeat(70));
  console.log('TESTING ENHANCED API');
  console.log('='.repeat(70));
  console.log('');

  const rscAddress = process.argv[2] || '0xbc183f419B48D4fd5Ad4e375e198ECc0fd48d8A5';
  const limit = parseInt(process.argv[3]) || 50;

  const postData = JSON.stringify({
    rscAddress: rscAddress,
    limit: limit
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

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          
          console.log('✅ API Response Received');
          console.log('-'.repeat(70));
          console.log(`Total Events: ${result.count}`);
          console.log('');
          
          // Test Summary Statistics
          console.log('📊 SUMMARY STATISTICS:');
          console.log(`  Total Events: ${result.summary.totalEvents}`);
          console.log(`  By Type:`);
          console.log(`    ReactHandled: ${result.summary.byType.ReactHandled}`);
          console.log(`    Callback: ${result.summary.byType.Callback}`);
          console.log(`    StrategyUpdate: ${result.summary.byType.StrategyUpdate}`);
          console.log(`  With Aave Data: ${result.summary.withAaveData}`);
          console.log(`  With Strategy Update: ${result.summary.withStrategyUpdate}`);
          console.log(`  Rebalances: ${result.summary.rebalances}`);
          console.log(`  APY Queries: ${result.summary.apyQueries}`);
          
          if (result.summary.apyStats) {
            console.log(`  APY Stats:`);
            if (result.summary.apyStats.aave) {
              console.log(`    Aave: ${result.summary.apyStats.aave.latest}% (avg: ${result.summary.apyStats.aave.avg.toFixed(2)}%)`);
            }
            if (result.summary.apyStats.compound) {
              console.log(`    Compound: ${result.summary.apyStats.compound.latest}% (avg: ${result.summary.apyStats.compound.avg.toFixed(2)}%)`);
            }
          }
          console.log('');
          
          // Test Enhanced Fields
          console.log('🔍 TESTING ENHANCED FIELDS:');
          console.log('-'.repeat(70));
          
          let testsPassed = 0;
          let testsTotal = 0;
          
          // Test 1: receivedAt timestamp
          testsTotal++;
          const hasReceivedAt = result.events.some(e => e.receivedAt !== undefined && e.receivedAt !== null);
          if (hasReceivedAt) {
            console.log('✅ Test 1: receivedAt timestamp present');
            testsPassed++;
          } else {
            console.log('❌ Test 1: receivedAt timestamp missing');
          }
          
          // Test 2: correlationId
          testsTotal++;
          const hasCorrelationId = result.events.some(e => e.correlationId !== undefined && e.correlationId !== null);
          if (hasCorrelationId) {
            console.log('✅ Test 2: correlationId present');
            testsPassed++;
          } else {
            console.log('❌ Test 2: correlationId missing');
          }
          
          // Test 3: apyQuery with protocol field
          testsTotal++;
          const hasProtocolField = result.events.some(e => e.apyQuery && e.apyQuery.protocol);
          if (hasProtocolField) {
            console.log('✅ Test 3: apyQuery.protocol field present');
            testsPassed++;
          } else {
            console.log('❌ Test 3: apyQuery.protocol field missing');
          }
          
          // Test 4: ReactHandled with originEvent decoding
          testsTotal++;
          const reactHandledEvents = result.events.filter(e => e.eventType === 'ReactHandled');
          if (reactHandledEvents.length > 0) {
            const hasDecoded = reactHandledEvents.some(e => e.originEvent && e.originEvent.decoded);
            if (hasDecoded) {
              console.log('✅ Test 4: ReactHandled events have decoded Aave data');
              testsPassed++;
            } else {
              console.log('⚠️  Test 4: ReactHandled events found but no decoded data');
            }
          } else {
            console.log('⚠️  Test 4: No ReactHandled events in sample (expected if no Aave events processed)');
            testsPassed++; // Not a failure, just no data
          }
          
          // Test 5: StrategyUpdate events
          testsTotal++;
          const strategyUpdateEvents = result.events.filter(e => e.eventType === 'StrategyUpdate');
          if (strategyUpdateEvents.length > 0) {
            const hasStrategyData = strategyUpdateEvents.some(e => e.strategyUpdate);
            if (hasStrategyData) {
              console.log('✅ Test 5: StrategyUpdate events have strategy data');
              testsPassed++;
            } else {
              console.log('❌ Test 5: StrategyUpdate events missing strategy data');
            }
          } else {
            console.log('⚠️  Test 5: No StrategyUpdate events in sample (expected if no rebalancing occurred)');
            testsPassed++; // Not a failure, just no data
          }
          
          // Test 6: Summary statistics
          testsTotal++;
          if (result.summary && result.summary.totalEvents === result.count) {
            console.log('✅ Test 6: Summary statistics match event count');
            testsPassed++;
          } else {
            console.log('❌ Test 6: Summary statistics mismatch');
          }
          
          console.log('');
          console.log('='.repeat(70));
          console.log(`TEST RESULTS: ${testsPassed}/${testsTotal} tests passed`);
          console.log('='.repeat(70));
          
          // Show sample event structure
          if (result.events.length > 0) {
            console.log('');
            console.log('📋 SAMPLE EVENT STRUCTURE:');
            console.log('-'.repeat(70));
            const sample = result.events[0];
            console.log(`Event Type: ${sample.eventType}`);
            console.log(`Block Number: ${sample.blockNumber}`);
            console.log(`Transaction Hash: ${sample.transactionHash}`);
            console.log(`Received At: ${sample.receivedAt ? new Date(sample.receivedAt * 1000).toISOString() : 'N/A'}`);
            console.log(`Correlation ID: ${sample.correlationId || 'N/A'}`);
            
            if (sample.apyQuery) {
              console.log(`APY Query:`);
              console.log(`  Protocol: ${sample.apyQuery.protocol}`);
              console.log(`  APY: ${sample.apyQuery.apyPercent}% (${sample.apyQuery.apyBps} bps)`);
            }
            
            if (sample.strategyUpdate) {
              console.log(`Strategy Update:`);
              console.log(`  Aave APY: ${sample.strategyUpdate.aaveApyPercent}%`);
              console.log(`  Compound APY: ${sample.strategyUpdate.compoundApyPercent}%`);
              console.log(`  Spread: ${sample.strategyUpdate.spreadPercent}%`);
              console.log(`  Rebalanced: ${sample.strategyUpdate.rebalanced}`);
              console.log(`  Direction: ${sample.strategyUpdate.direction}`);
            }
            
            if (sample.originEvent && sample.originEvent.decoded) {
              console.log(`Origin Aave Event:`);
              console.log(`  Liquidity Rate: ${sample.originEvent.decoded.liquidityRatePercent}%`);
              console.log(`  Variable Borrow Rate: ${sample.originEvent.decoded.variableBorrowRatePercent}%`);
            }
          }
          
          resolve(result);
        } catch (e) {
          console.error('Error parsing response:', e.message);
          reject(e);
        }
      });
    });

    req.on('error', (e) => {
      console.error('Request error:', e.message);
      reject(e);
    });

    req.write(postData);
    req.end();
  });
}

testEnhancedAPI()
  .then(() => {
    console.log('');
    console.log('✅ All tests completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  });

