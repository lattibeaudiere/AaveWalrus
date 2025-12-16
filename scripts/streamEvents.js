const https = require('http');

/**
 * CLI Event Streamer - Polls server API and displays events in real-time
 */
class EventStreamer {
  constructor(rscAddress, serverUrl = 'http://localhost:3000') {
    this.rscAddress = rscAddress;
    this.serverUrl = serverUrl;
    this.lastSeenEvents = new Set();
    this.eventCount = 0;
    this.startTime = new Date();
  }

  async fetchEvents() {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify({
        rscAddress: this.rscAddress,
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

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            resolve(result);
          } catch (e) {
            reject(new Error(`Parse error: ${e.message}`));
          }
        });
      });

      req.on('error', (e) => {
        reject(e);
      });

      req.write(postData);
      req.end();
    });
  }

  displayEvent(event) {
    const timestamp = new Date().toISOString();
    const eventKey = `${event.transactionHash}-${event.topics[0]}`;
    
    if (this.lastSeenEvents.has(eventKey)) {
      return false; // Already displayed
    }
    
    this.lastSeenEvents.add(eventKey);
    this.eventCount++;
    
    // Keep set manageable (last 1000 events)
    if (this.lastSeenEvents.size > 1000) {
      const entries = Array.from(this.lastSeenEvents);
      entries.slice(0, 100).forEach(k => this.lastSeenEvents.delete(k));
    }

    console.log('\n' + '='.repeat(70));
    console.log(`[${timestamp}] Event #${this.eventCount} - ${event.eventType}`);
    console.log('='.repeat(70));
    console.log(`Block Number:     ${event.blockNumber || 'N/A'}`);
    console.log(`Transaction Hash: ${event.transactionHash}`);
    console.log(`Transaction #:    ${event.transactionNumber || 'N/A'}`);
    
    // Enhanced fields
    if (event.receivedAt) {
      const receivedDate = new Date(event.receivedAt * 1000).toISOString();
      console.log(`Received At:      ${receivedDate} (${event.receivedAt})`);
    }
    if (event.correlationId) {
      console.log(`Correlation ID:   ${event.correlationId}`);
    }
    
    if (event.eventType === 'ReactHandled') {
      console.log(`\n🔵 ReactHandled Event:`);
      if (event.originEvent) {
        console.log(`  Origin Chain:    ${event.originEvent.chainId || 'N/A'}`);
        console.log(`  Origin Emitter:  ${event.originEvent.address || 'N/A'}`);
        console.log(`  Origin Block:    ${event.originEvent.blockNumber || 'N/A'}`);
        console.log(`  Origin Tx Hash:  ${event.originEvent.transactionHash || 'N/A'}`);
        console.log(`  Log Index:       ${event.originEvent.logIndex || 'N/A'}`);
        
        if (event.originEvent.decoded) {
          console.log(`\n  📊 Decoded Aave Event:`);
          const decoded = event.originEvent.decoded;
          if (decoded.liquidityRatePercent !== undefined) {
            console.log(`    💰 Liquidity Rate (Supply APY): ${decoded.liquidityRatePercent.toFixed(4)}% (${decoded.liquidityRateBps} bps)`);
          }
          if (decoded.stableBorrowRatePercent !== undefined) {
            console.log(`    📈 Stable Borrow Rate: ${decoded.stableBorrowRatePercent.toFixed(4)}% (${decoded.stableBorrowRateBps} bps)`);
          }
          if (decoded.variableBorrowRatePercent !== undefined) {
            console.log(`    📉 Variable Borrow Rate: ${decoded.variableBorrowRatePercent.toFixed(4)}% (${decoded.variableBorrowRateBps} bps)`);
          }
          if (decoded.reserve) {
            console.log(`    🪙 Reserve: ${decoded.reserve}`);
          }
        }
      }
    } else if (event.eventType === 'Callback') {
      console.log(`\n🟢 Callback Event:`);
      if (event.callbackData) {
        console.log(`  Target Chain:    ${event.callbackData.chainId || 'N/A'}`);
        console.log(`  Target Contract: ${event.callbackData.contract || 'N/A'}`);
        console.log(`  Gas Limit:       ${event.callbackData.gasLimit || 'N/A'}`);
        if (event.callbackData.action) {
          console.log(`  Action:          ${event.callbackData.action} (${event.callbackData.actionType || 'N/A'})`);
        }
      }
      if (event.apyQuery) {
        console.log(`\n  📊 APY Query:`);
        console.log(`    Protocol:      ${event.apyQuery.protocol || 'Unknown'}`);
        if (event.apyQuery.assetAddress) {
          console.log(`    Asset:         ${event.apyQuery.assetAddress}`);
        }
        if (event.apyQuery.apyPercent !== undefined) {
          console.log(`    APY:           ${event.apyQuery.apyPercent.toFixed(2)}% (${event.apyQuery.apyBps} bps)`);
        }
        if (event.apyQuery.queryTimestamp) {
          const date = new Date(event.apyQuery.queryTimestamp * 1000);
          console.log(`    Query Time:    ${date.toISOString()}`);
        }
        if (event.apyQuery.nonce) {
          console.log(`    Nonce:         ${event.apyQuery.nonce}`);
        }
      }
    } else if (event.eventType === 'StrategyUpdate') {
      console.log(`\n🟡 StrategyUpdate Event:`);
      if (event.strategyUpdate) {
        const su = event.strategyUpdate;
        console.log(`  📊 APY Comparison:`);
        console.log(`    Aave APY:      ${su.aaveApyPercent.toFixed(2)}% (${su.aaveApyBps} bps)`);
        console.log(`    Compound APY:  ${su.compoundApyPercent.toFixed(2)}% (${su.compoundApyBps} bps)`);
        console.log(`    Spread:        ${su.spreadPercent.toFixed(2)}% (${su.spreadBps} bps)`);
        console.log(`    Direction:     ${su.direction || 'N/A'}`);
        console.log(`    Higher APY:    ${su.higherApy || 'N/A'}`);
        console.log(`\n  ⚡ Action:`);
        if (su.rebalanced) {
          console.log(`    ✅ REBALANCED - Funds moved ${su.direction}`);
        } else {
          console.log(`    ⏸️  NO REBALANCE - Spread below threshold`);
        }
        if (su.timestamp) {
          const date = new Date(su.timestamp * 1000);
          console.log(`    Timestamp:     ${date.toISOString()}`);
        }
      }
    }
    
    console.log(`\n📋 Event Details:`);
    console.log(`  Topics:`);
    event.topics.forEach((topic, i) => {
      const preview = topic.length > 20 ? topic.slice(0, 20) + '...' : topic;
      console.log(`    Topic${i}: ${preview}`);
    });
    
    if (event.data && event.data !== '0x') {
      const dataPreview = event.data.length > 66 ? event.data.slice(0, 66) + '...' : event.data;
      console.log(`  Data: ${dataPreview}`);
    }
    
    console.log('='.repeat(70));
    
    return true;
  }

  async poll() {
    try {
      const result = await this.fetchEvents();
      
      if (result.events && result.events.length > 0) {
        // Process events in reverse order (oldest first) to show them chronologically
        const newEvents = result.events.reverse().filter(event => {
          const key = `${event.transactionHash}-${event.topics[0]}`;
          return !this.lastSeenEvents.has(key);
        });
        
        newEvents.forEach(event => {
          this.displayEvent(event);
        });
        
        if (newEvents.length === 0) {
          process.stdout.write('.');
        }
      } else {
        process.stdout.write('.');
      }
    } catch (error) {
      console.error(`\nError fetching events: ${error.message}`);
    }
  }

  async start() {
    console.log('='.repeat(70));
    console.log(' 🚀 LIVE EVENT STREAM - Enhanced RSC Monitor');
    console.log('='.repeat(70));
    console.log(`RSC Address: ${this.rscAddress}`);
    console.log(`Server:      ${this.serverUrl}`);
    console.log(`Started:     ${this.startTime.toISOString()}`);
    console.log('Press Ctrl+C to stop');
    console.log('-'.repeat(70));
    console.log('📊 Enhanced Features:');
    console.log('  ✅ Server-side timestamps (receivedAt)');
    console.log('  ✅ Event correlation IDs');
    console.log('  ✅ Decoded Aave event data');
    console.log('  ✅ Strategy update decisions');
    console.log('  ✅ Protocol identification (Aave/Compound)');
    console.log('-'.repeat(70));
    console.log('Polling for new events...\n');

    // Initial poll
    await this.poll();

    // Poll every 5 seconds
    setInterval(async () => {
      await this.poll();
    }, 5000);
  }
}

// Get RSC address from command line or use default
const rscAddress = process.argv[2] || '0xbc183f419B48D4fd5Ad4e375e198ECc0fd48d8A5';
const serverUrl = process.argv[3] || 'http://localhost:3000';

const streamer = new EventStreamer(rscAddress, serverUrl);

streamer.start().catch((error) => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\n\nStream stopped.');
  console.log(`Total events displayed: ${streamer.eventCount}`);
  process.exit(0);
});

