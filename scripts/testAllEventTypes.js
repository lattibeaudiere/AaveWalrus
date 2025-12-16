const http = require('http');

/**
 * Test script to check all event types from the server
 * This will help us see what events are actually being returned
 */

const RSC_ADDRESS = process.env.RSC_ADDRESS || '0xbc183f419B48D4fd5Ad4e375e198ECc0fd48d8A5';
const SERVER_URL = 'http://localhost:3000';

async function testAllEventTypes() {
  console.log('='.repeat(70));
  console.log('🧪 TESTING ALL EVENT TYPES');
  console.log('='.repeat(70));
  console.log('');
  console.log(`Server URL: ${SERVER_URL}`);
  console.log(`RSC Address: ${RSC_ADDRESS}`);
  console.log('');

  const postData = JSON.stringify({
    rscAddress: RSC_ADDRESS,
    limit: 100  // Get more events to see patterns
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
    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          console.log(`Status: ${res.statusCode}`);
          console.log(`Total Events: ${response.count}`);
          console.log(`Transactions Queried: ${response.transactionsQueried || 0}`);
          console.log('');

          if (response.events && response.events.length > 0) {
            // Group events by type
            const eventTypes = {};
            response.events.forEach(event => {
              const type = event.eventType || 'Unknown';
              if (!eventTypes[type]) {
                eventTypes[type] = [];
              }
              eventTypes[type].push(event);
            });

            console.log('📊 Event Types Found:');
            console.log('');
            Object.keys(eventTypes).forEach(type => {
              console.log(`  ${type}: ${eventTypes[type].length} events`);
            });
            console.log('');

            // Show sample events of each type
            Object.keys(eventTypes).forEach(type => {
              console.log(`\n${type} Events (sample):`);
              console.log('-'.repeat(70));
              const samples = eventTypes[type].slice(0, 3);
              samples.forEach((event, idx) => {
                console.log(`  Sample ${idx + 1}:`);
                console.log(`    TX: ${event.transactionHash}`);
                console.log(`    Block: ${event.blockNumber}`);
                console.log(`    Topic0: ${event.topic0}`);
                console.log(`    Has originEvent: ${event.originEvent ? 'YES ✅' : 'NO'}`);
                if (event.originEvent) {
                  console.log(`    Origin Address: ${event.originEvent.address}`);
                  console.log(`    Origin Block: ${event.originEvent.blockNumber}`);
                }
                console.log('');
              });
            });

            // Check for ReactHandled events specifically
            const reactHandledEvents = eventTypes['ReactHandled'] || [];
            const callbackEvents = eventTypes['Callback'] || [];

            console.log('='.repeat(70));
            console.log('📋 ANALYSIS');
            console.log('='.repeat(70));
            console.log('');

            if (reactHandledEvents.length > 0) {
              console.log(`✅ Found ${reactHandledEvents.length} ReactHandled events`);
              const withOrigin = reactHandledEvents.filter(e => e.originEvent);
              console.log(`   Events with origin Aave data: ${withOrigin.length}`);
              
              if (withOrigin.length > 0) {
                console.log('');
                console.log('✅ SUCCESS! Aave event fetching is working!');
                console.log('');
                const sample = withOrigin[0];
                console.log('Sample ReactHandled event with origin Aave data:');
                console.log(`  TX: ${sample.transactionHash}`);
                console.log(`  Origin Event:`);
                console.log(`    Address: ${sample.originEvent.address}`);
                console.log(`    Block: ${sample.originEvent.blockNumber}`);
                console.log(`    TX: ${sample.originEvent.transactionHash}`);
                console.log(`    Log Index: ${sample.originEvent.logIndex}`);
                console.log(`    Topics: ${sample.originEvent.topics.length}`);
              } else {
                console.log('');
                console.log('⚠️  ReactHandled events found but no origin Aave data');
                console.log('   This could mean:');
                console.log('     - Events are not from Aave pool');
                console.log('     - Events are from a different chain');
                console.log('     - Transaction receipts not found');
                
                // Show why origin events weren't found
                if (reactHandledEvents.length > 0) {
                  console.log('');
                  console.log('Checking first ReactHandled event:');
                  const first = reactHandledEvents[0];
                  console.log(`  Transaction: ${first.transactionHash}`);
                  console.log(`  Data length: ${first.data ? first.data.length : 0}`);
                }
              }
            } else {
              console.log('⚠️  No ReactHandled events found');
              console.log('   The contract may not have processed any Aave events yet');
              console.log('');
              
              if (callbackEvents.length > 0) {
                console.log(`   However, ${callbackEvents.length} Callback events were found`);
                console.log('   This suggests the contract is active but may not have');
                console.log('   processed any Aave ReserveDataUpdated events yet.');
              }
            }
          } else {
            console.log('⚠️  No events found');
            if (response.message) {
              console.log(`   Message: ${response.message}`);
            }
          }
          
          resolve(response);
        } catch (error) {
          console.log(`❌ Error parsing response: ${error.message}`);
          console.log(`Raw response: ${data.substring(0, 500)}`);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.log(`❌ Request error: ${error.message}`);
      console.log('');
      console.log('Make sure the server is running:');
      console.log('$ node server.js');
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

// Run the test
testAllEventTypes()
  .then(() => {
    console.log('');
    console.log('='.repeat(70));
    console.log('✅ TEST COMPLETE');
    console.log('='.repeat(70));
  })
  .catch((error) => {
    console.log('');
    console.log('='.repeat(70));
    console.log('❌ TEST FAILED');
    console.log('='.repeat(70));
    console.error(error);
    process.exit(1);
  });

