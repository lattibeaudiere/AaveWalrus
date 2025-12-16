const http = require('http');

/**
 * Test script to verify the server API endpoint
 * Tests if the server can fetch and return Aave event data
 */

const RSC_ADDRESS = process.env.RSC_ADDRESS || '0xbc183f419B48D4fd5Ad4e375e198ECc0fd48d8A5';
const SERVER_URL = 'http://localhost:3000';

async function testServerAPI() {
  console.log('='.repeat(70));
  console.log('🧪 TESTING SERVER API ENDPOINT');
  console.log('='.repeat(70));
  console.log('');
  console.log(`Server URL: ${SERVER_URL}`);
  console.log(`RSC Address: ${RSC_ADDRESS}`);
  console.log('');

  // Test the /api/rsc-events endpoint
  console.log('1️⃣  Testing /api/rsc-events endpoint...');
  console.log('');

  const postData = JSON.stringify({
    rscAddress: RSC_ADDRESS,
    limit: 50
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
          
          console.log(`   Status: ${res.statusCode}`);
          console.log(`   Response: ${JSON.stringify(response, null, 2).substring(0, 500)}...`);
          console.log('');

          if (res.statusCode === 200) {
            console.log('   ✅ API endpoint is working!');
            console.log('');
            console.log(`   Events found: ${response.count}`);
            console.log(`   Transactions queried: ${response.transactionsQueried || 0}`);
            console.log(`   RVM ID: ${response.rvmId || 'N/A'}`);
            console.log(`   Head Number: ${response.headNumber || 'N/A'}`);
            console.log('');

            if (response.events && response.events.length > 0) {
              console.log('   📊 Event Details:');
              console.log('');
              
              // Check for ReactHandled events with originEvent
              const reactHandledEvents = response.events.filter(e => e.eventType === 'ReactHandled');
              console.log(`   ReactHandled events: ${reactHandledEvents.length}`);
              
              const eventsWithOrigin = reactHandledEvents.filter(e => e.originEvent);
              console.log(`   Events with origin Aave data: ${eventsWithOrigin.length}`);
              console.log('');

              if (eventsWithOrigin.length > 0) {
                console.log('   ✅ SUCCESS! Found events with origin Aave data!');
                console.log('');
                console.log('   Sample event with origin data:');
                const sample = eventsWithOrigin[0];
                console.log(`     Transaction: ${sample.transactionHash}`);
                console.log(`     Origin Event:`);
                console.log(`       Address: ${sample.originEvent.address}`);
                console.log(`       Block: ${sample.originEvent.blockNumber}`);
                console.log(`       TX: ${sample.originEvent.transactionHash}`);
                console.log(`       Log Index: ${sample.originEvent.logIndex}`);
                console.log(`       Topics: ${sample.originEvent.topics.length}`);
                if (sample.originEvent.topics && sample.originEvent.topics.length > 0) {
                  console.log(`       Topic0: ${sample.originEvent.topics[0]}`);
                }
              } else if (reactHandledEvents.length > 0) {
                console.log('   ⚠️  Found ReactHandled events but no origin Aave data');
                console.log('   This could mean:');
                console.log('     - Events are not from Aave pool');
                console.log('     - Events are from a different chain');
                console.log('     - Transaction receipts not found on Arbitrum');
              } else {
                console.log('   ⚠️  No ReactHandled events found');
                console.log('   The contract may not have processed any events yet');
              }
            } else {
              console.log('   ⚠️  No events found');
              if (response.message) {
                console.log(`   Message: ${response.message}`);
              }
            }
          } else {
            console.log(`   ❌ API error: ${response.error || 'Unknown error'}`);
          }
          
          resolve(response);
        } catch (error) {
          console.log(`   ❌ Error parsing response: ${error.message}`);
          console.log(`   Raw response: ${data.substring(0, 200)}`);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.log(`   ❌ Request error: ${error.message}`);
      console.log('');
      console.log('   Make sure the server is running:');
      console.log('   $ node server.js');
      console.log('');
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

// Run the test
testServerAPI()
  .then(() => {
    console.log('');
    console.log('='.repeat(70));
    console.log('✅ TEST COMPLETE');
    console.log('='.repeat(70));
    console.log('');
  })
  .catch((error) => {
    console.log('');
    console.log('='.repeat(70));
    console.log('❌ TEST FAILED');
    console.log('='.repeat(70));
    console.log('');
    console.error(error);
    process.exit(1);
  });

