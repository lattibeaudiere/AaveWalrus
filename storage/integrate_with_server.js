// Integration code to add to server.js
// This shows how to integrate the Python storage service with your existing Node.js server

const { exec } = require('child_process');
const path = require('path');
const axios = require('axios'); // npm install axios

// Configuration
const STORAGE_API_URL = process.env.STORAGE_API_URL || 'http://localhost:5000';
const STORAGE_PYTHON_SCRIPT = path.join(__dirname, 'storage', 'store_aave_event.py');
const USE_API = process.env.USE_STORAGE_API === 'true'; // Set to 'true' to use Flask API instead of CLI

/**
 * Store Aave event to dual storage (PostgreSQL + Walrus)
 * @param {Object} eventData - Decoded event data from server.js
 */
async function storeAaveEvent(eventData) {
  try {
    // Prepare event data for storage
    const storageData = {
      event_type: eventData.eventType || 'ReactHandled',
      asset_address: extractAssetAddress(eventData),
      tx_hash: eventData.transactionHash,
      block_number: eventData.blockNumber,
      transaction_number: eventData.transactionNumber,
      transaction_timestamp: eventData.transactionTimestamp,
      correlation_id: eventData.correlationId,
      full_data: eventData, // Store complete event data
      store_to_walrus: true
    };

    // Extract APY data from different event types
    if (eventData.originEvent && eventData.originEvent.decoded) {
      const decoded = eventData.originEvent.decoded;
      storageData.supply_apy_ray = decoded.liquidityRate;
      storageData.supply_apy_bps = parseInt(decoded.liquidityRateBps) || null;
      storageData.supply_apy_percent = decoded.liquidityRatePercent || null;
      storageData.stable_borrow_rate_ray = decoded.stableBorrowRate;
      storageData.stable_borrow_rate_bps = parseInt(decoded.stableBorrowRateBps) || null;
      storageData.stable_borrow_rate_percent = decoded.stableBorrowRatePercent || null;
      storageData.variable_borrow_rate_ray = decoded.variableBorrowRate;
      storageData.variable_borrow_rate_bps = parseInt(decoded.variableBorrowRateBps) || null;
      storageData.variable_borrow_rate_percent = decoded.variableBorrowRatePercent || null;
      storageData.liquidity_index = decoded.liquidityIndex;
      storageData.variable_borrow_index = decoded.variableBorrowIndex;
      
      if (decoded.reserve) {
        storageData.asset_address = decoded.reserve;
      }
      
      if (eventData.transactionTimestamp) {
        storageData.block_timestamp = new Date(eventData.transactionTimestamp * 1000).toISOString();
      }
    }

    // Extract APY query data (for Callback events)
    if (eventData.apyQuery) {
      storageData.supply_apy_bps = eventData.apyQuery.apyBps || null;
      storageData.supply_apy_percent = eventData.apyQuery.apyPercent || null;
      if (eventData.apyQuery.assetAddress) {
        storageData.asset_address = eventData.apyQuery.assetAddress;
      }
    }

    // Extract strategy update data (for StrategyUpdate events)
    if (eventData.strategyUpdate) {
      storageData.aave_apy_bps = parseInt(eventData.strategyUpdate.aaveApyBps) || null;
      storageData.compound_apy_bps = parseInt(eventData.strategyUpdate.compoundApyBps) || null;
      storageData.spread_bps = parseInt(eventData.strategyUpdate.spreadBps) || null;
      storageData.rebalanced = eventData.strategyUpdate.rebalanced || false;
      storageData.direction = eventData.strategyUpdate.direction || null;
      storageData.higher_apy = eventData.strategyUpdate.higherApy || null;
    }

    if (USE_API) {
      // Use Flask API
      const response = await axios.post(`${STORAGE_API_URL}/api/v1/aave-events`, storageData);
      console.log(`✅ Stored event ${response.data.event_id} (Walrus: ${response.data.walrus_blob_id})`);
      return response.data;
    } else {
      // Use Python CLI script
      return new Promise((resolve, reject) => {
        const jsonData = JSON.stringify(storageData);
        // Escape quotes for shell
        const escapedData = jsonData.replace(/'/g, "'\"'\"'");
        
        exec(`python "${STORAGE_PYTHON_SCRIPT}" '${escapedData}'`, (error, stdout, stderr) => {
          if (error) {
            console.error(`❌ Storage error: ${error.message}`);
            console.error(`stderr: ${stderr}`);
            reject(error);
            return;
          }
          
          try {
            const result = JSON.parse(stdout);
            if (result.success) {
              console.log(`✅ Stored event ${result.event_id} (Walrus: ${result.walrus_blob_id})`);
              resolve(result);
            } else {
              reject(new Error(result.error || 'Storage failed'));
            }
          } catch (parseError) {
            console.error(`Failed to parse storage result: ${parseError.message}`);
            console.error(`stdout: ${stdout}`);
            reject(parseError);
          }
        });
      });
    }
  } catch (error) {
    console.error(`Failed to store Aave event: ${error.message}`);
    // Don't throw - allow event processing to continue even if storage fails
    return null;
  }
}

/**
 * Extract asset address from event data
 */
function extractAssetAddress(eventData) {
  if (eventData.originEvent && eventData.originEvent.decoded && eventData.originEvent.decoded.reserve) {
    return eventData.originEvent.decoded.reserve;
  }
  if (eventData.apyQuery && eventData.apyQuery.assetAddress) {
    return eventData.apyQuery.assetAddress;
  }
  // Default to USDC if not found
  return '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
}

// Add this to your /api/rsc-events endpoint in server.js
// After processing events, add storage calls:

/*
// In the /api/rsc-events endpoint, after events.push(eventData):
// Store events to dual storage (PostgreSQL + Walrus)
if (process.env.ENABLE_STORAGE === 'true') {
  for (const eventData of events) {
    // Only store ReactHandled events with Aave data, or StrategyUpdate events
    if ((eventData.eventType === 'ReactHandled' && eventData.originEvent && eventData.originEvent.decoded) ||
        eventData.eventType === 'StrategyUpdate') {
      storeAaveEvent(eventData).catch(err => {
        console.error(`Failed to store event ${eventData.transactionHash}: ${err.message}`);
      });
    }
  }
}
*/

module.exports = { storeAaveEvent };

