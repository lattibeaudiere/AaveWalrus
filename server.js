const express = require('express');
const { ethers } = require('ethers');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));

const REACTIVE_RPC = process.env.REACTIVE_RPC || 'https://mainnet-rpc.rnk.dev';
const REACTIVE_PRIVATE_KEY = process.env.REACTIVE_PRIVATE_KEY;
const ARBITRUM_RPC = process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || 'https://arb1.arbitrum.io/rpc';
const SYSTEM_CONTRACT = '0x0000000000000000000000000000000000fffFfF';
const AAVE_POOL_ADDRESS = '0x794a61358D6845594F94dc1DB02A252b5b4814aD';
const ARBITRUM_CHAIN_ID = 42161;

if (!REACTIVE_PRIVATE_KEY) {
  console.error('⚠️  REACTIVE_PRIVATE_KEY not set in .env');
  console.error('   Funding will not work until private key is configured');
}

// Create Arbitrum provider for fetching origin events
const arbitrumProvider = new ethers.providers.JsonRpcProvider(ARBITRUM_RPC);

// Helper function to fetch original Aave event from Arbitrum
async function fetchOriginAaveEvent(chainId, emitter, txHash, logIndex) {
  try {
    // Only fetch if it's from Arbitrum and from Aave pool
    if (chainId.toString() !== ARBITRUM_CHAIN_ID.toString()) {
      return null;
    }
    
    if (emitter.toLowerCase() !== AAVE_POOL_ADDRESS.toLowerCase()) {
      return null;
    }

    // Convert txHash to hex string if it's a BigNumber
    // ReactHandled event stores txHash as uint256, which is 32 bytes
    let txHashHex = txHash;
    if (ethers.BigNumber.isBigNumber(txHash)) {
      // Convert BigNumber to hex string and pad to 32 bytes (64 hex chars)
      const hexStr = txHash.toHexString();
      txHashHex = ethers.utils.hexZeroPad(hexStr, 32);
    } else if (typeof txHash === 'string') {
      if (!txHash.startsWith('0x')) {
        // If it's a string without 0x prefix, add it and pad
        txHashHex = '0x' + txHash.padStart(64, '0');
      } else {
        // If it already has 0x, ensure it's padded to 32 bytes
        txHashHex = ethers.utils.hexZeroPad(txHash, 32);
      }
    }

    // Get transaction receipt from Arbitrum
    const receipt = await arbitrumProvider.getTransactionReceipt(txHashHex);
    if (!receipt || !receipt.logs) {
      console.log(`No receipt or logs found for txHash: ${txHashHex}`);
      return null;
    }

    // Convert logIndex to number
    const logIndexNum = ethers.BigNumber.isBigNumber(logIndex) 
      ? logIndex.toNumber() 
      : parseInt(logIndex.toString());

    // Find the log at the specified index
    // Note: logIndex in receipt is the actual log index from the transaction
    const originLog = receipt.logs.find(log => log.logIndex === logIndexNum);
    if (!originLog) {
      console.log(`Log index ${logIndexNum} not found in receipt. Available log indices: ${receipt.logs.map(l => l.logIndex).join(', ')}`);
      return null;
    }

    // Verify the log is from the Aave pool
    if (originLog.address.toLowerCase() !== AAVE_POOL_ADDRESS.toLowerCase()) {
      console.log(`Log is not from Aave pool. Address: ${originLog.address}`);
      return null;
    }

    // Return the original event data
    return {
      address: originLog.address,
      blockNumber: originLog.blockNumber,
      transactionHash: originLog.transactionHash,
      logIndex: originLog.logIndex,
      topics: originLog.topics,
      data: originLog.data
    };
  } catch (error) {
    console.log(`Error fetching origin Aave event: ${error.message}`);
    return null;
  }
}

// API endpoint to fund the RSC
app.post('/api/fund', async (req, res) => {
  try {
    if (!REACTIVE_PRIVATE_KEY) {
      return res.status(400).json({ error: 'REACTIVE_PRIVATE_KEY not configured in .env' });
    }

    const { rscAddress, amount } = req.body;

    if (!rscAddress || !amount) {
      return res.status(400).json({ error: 'rscAddress and amount are required' });
    }

    const provider = new ethers.providers.JsonRpcProvider(REACTIVE_RPC);
    const wallet = new ethers.Wallet(REACTIVE_PRIVATE_KEY, provider);
    const amountWei = ethers.utils.parseEther(amount.toString());

    // Check balance
    const balance = await provider.getBalance(wallet.address);
    if (balance.lt(amountWei)) {
      return res.status(400).json({ 
        error: `Insufficient balance. You have ${ethers.utils.formatEther(balance)} REACT` 
      });
    }

    // Fund using depositTo
    const depositAbi = ['function depositTo(address reactiveContract) external payable'];
    const systemContract = new ethers.Contract(SYSTEM_CONTRACT, depositAbi, wallet);

    const tx = await systemContract.depositTo(rscAddress, {
      value: amountWei,
      gasLimit: 100000
    });

    // Wait for confirmation
    const receipt = await tx.wait();

    if (receipt.status === 1) {
      // Get final status
      const finalBalance = await provider.getBalance(rscAddress);
      const systemAbi = ['function debts(address) view returns (uint256)'];
      const systemContractRead = new ethers.Contract(SYSTEM_CONTRACT, systemAbi, provider);
      let finalDebt = ethers.BigNumber.from(0);
      try {
        finalDebt = await systemContractRead.debts(rscAddress);
      } catch (e) {
        // Ignore
      }

      res.json({
        success: true,
        txHash: tx.hash,
        balance: ethers.utils.formatEther(finalBalance),
        debt: ethers.utils.formatEther(finalDebt),
        walletAddress: wallet.address
      });
    } else {
      res.status(500).json({ error: 'Transaction failed' });
    }
  } catch (error) {
    console.error('Funding error:', error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to check contract status
app.post('/api/status', async (req, res) => {
  try {
    const { rscAddress } = req.body;

    if (!rscAddress) {
      return res.status(400).json({ error: 'rscAddress is required' });
    }

    const provider = new ethers.providers.JsonRpcProvider(REACTIVE_RPC);
    const balance = await provider.getBalance(rscAddress);

    const systemAbi = ['function debts(address) view returns (uint256)'];
    const systemContract = new ethers.Contract(SYSTEM_CONTRACT, systemAbi, provider);
    let debt = ethers.BigNumber.from(0);
    try {
      debt = await systemContract.debts(rscAddress);
    } catch (e) {
      // Ignore
    }

    res.json({
      balance: ethers.utils.formatEther(balance),
      debt: ethers.utils.formatEther(debt)
    });
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to get wallet address (for display)
app.get('/api/wallet', (req, res) => {
  if (!REACTIVE_PRIVATE_KEY) {
    return res.status(400).json({ error: 'REACTIVE_PRIVATE_KEY not configured' });
  }

  try {
    const wallet = new ethers.Wallet(REACTIVE_PRIVATE_KEY);
    res.json({ address: wallet.address });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper function to call Reactive Network custom RPC methods
async function callRnkRpc(method, params) {
  const provider = new ethers.providers.JsonRpcProvider(REACTIVE_RPC);
  try {
    const result = await provider.send(method, params);
    return result;
  } catch (error) {
    // If send fails, try direct HTTP request
    const https = require('https');
    const http = require('http');
    const url = require('url');
    
    return new Promise((resolve, reject) => {
      const parsedUrl = url.parse(REACTIVE_RPC);
      const isHttps = parsedUrl.protocol === 'https:';
      const client = isHttps ? https : http;
      
      const postData = JSON.stringify({
        jsonrpc: '2.0',
        method: method,
        params: params,
        id: 1
      });
      
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };
      
      const req = client.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.error) {
              reject(new Error(json.error.message || 'RPC error'));
            } else {
              resolve(json.result);
            }
          } catch (e) {
            reject(e);
          }
        });
      });
      
      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }
}

// API endpoint to get recent RSC transactions and events
app.post('/api/rsc-events', async (req, res) => {
  try {
    const { rscAddress, limit } = req.body;

    if (!rscAddress) {
      return res.status(400).json({ error: 'rscAddress is required' });
    }

    const queryLimit = limit || 50; // Default to last 50 transactions

    // Step 1: Get RVM ID from contract address
    let rvmId;
    try {
      const mapping = await callRnkRpc('rnk_getRnkAddressMapping', [rscAddress]);
      rvmId = mapping.rvmId;
      if (!rvmId) {
        return res.json({ events: [], count: 0, message: 'RVM ID not found for contract' });
      }
    } catch (error) {
      console.log('Could not get RVM ID:', error.message);
      return res.json({ events: [], count: 0, message: 'Could not get RVM ID' });
    }

    // Step 2: Get latest transaction number
    let headNumber;
    try {
      headNumber = await callRnkRpc('rnk_getHeadNumber', [rvmId]);
      if (!headNumber || headNumber === '0x0') {
        return res.json({ events: [], count: 0, message: 'No transactions found' });
      }
    } catch (error) {
      console.log('Could not get head number:', error.message);
      return res.json({ events: [], count: 0, message: 'Could not get head number' });
    }

    // Step 3: Calculate range (from latest backwards)
    const headNum = parseInt(headNumber, 16);
    const fromNum = Math.max(0, headNum - queryLimit + 1);
    const fromHex = '0x' + fromNum.toString(16);
    const limitHex = '0x' + queryLimit.toString(16);

    // Step 4: Get transactions
    let transactions = [];
    try {
      transactions = await callRnkRpc('rnk_getTransactions', [rvmId, fromHex, limitHex]);
      if (!Array.isArray(transactions)) {
        transactions = [];
      }
    } catch (error) {
      console.log('Could not get transactions:', error.message);
      return res.json({ events: [], count: 0, message: 'Could not get transactions' });
    }

    // Get wallet address for Reactscan URLs (RVM address)
    // CRITICAL: Reactscan requires wallet address, NOT RSC address
    // Cache wallet address to avoid recreating wallet on every request
    if (!global.cachedWalletAddress && REACTIVE_PRIVATE_KEY) {
      try {
        const wallet = new ethers.Wallet(REACTIVE_PRIVATE_KEY);
        global.cachedWalletAddress = wallet.address;
        console.log(`Wallet address cached for Reactscan URLs: ${global.cachedWalletAddress}`);
      } catch (e) {
        console.error('Error getting wallet address:', e.message);
      }
    }
    const walletAddress = global.cachedWalletAddress || null;

    // Step 5: Get logs for each transaction
    const events = [];
    const reactHandledTopic = ethers.utils.id('ReactHandled(uint256,address,uint256,uint256)');
    const callbackTopic = ethers.utils.id('Callback(uint256,address,uint64,bytes)');
    const strategyUpdateTopic = ethers.utils.id('StrategyUpdate(uint256,uint256,uint256,bool)');
    
    // Create interfaces for decoding events
    const reactHandledIface = new ethers.utils.Interface([
      'event ReactHandled(uint256 chainId, address emitter, uint256 txHash, uint256 logIndex)'
    ]);
    
    const callbackIface = new ethers.utils.Interface([
      'event Callback(uint256 indexed chain_id, address indexed _contract, uint64 indexed gas_limit, bytes payload)'
    ]);
    
    const strategyUpdateIface = new ethers.utils.Interface([
      'event StrategyUpdate(uint256 aaveApy, uint256 compoundApy, uint256 spread, bool rebalanced)'
    ]);
    
    const aaveEventIface = new ethers.utils.Interface([
      'event ReserveDataUpdated(address indexed reserve, uint256 liquidityRate, uint256 stableBorrowRate, uint256 variableBorrowRate, uint256 liquidityIndex, uint256 variableBorrowIndex)'
    ]);
    
    const reserveDataUpdatedTopic = ethers.utils.id('ReserveDataUpdated(address,uint256,uint256,uint256,uint256,uint256)');
    const RAY = ethers.BigNumber.from(10).pow(27);
    
    // Track event correlation (group events from same transaction)
    const eventCorrelationMap = new Map();

    for (const tx of transactions) {
      try {
        const logs = await callRnkRpc('rnk_getTransactionLogs', [rvmId, tx.number]);
        if (Array.isArray(logs)) {
          for (const log of logs) {
            // Only include logs from our RSC contract
            if (log.address && log.address.toLowerCase() === rscAddress.toLowerCase()) {
              const topic0 = log.topics && log.topics[0];
              if (topic0 === reactHandledTopic || topic0 === callbackTopic || topic0 === strategyUpdateTopic) {
                // Get transaction timestamp (if available)
                let txTimestamp = null;
                if (tx.timestamp) {
                  // Timestamp might be hex or decimal
                  if (typeof tx.timestamp === 'string' && tx.timestamp.startsWith('0x')) {
                    txTimestamp = parseInt(tx.timestamp, 16);
                  } else {
                    txTimestamp = parseInt(tx.timestamp);
                  }
                }
                
                // Add server-side timestamp
                const receivedAt = Math.floor(Date.now() / 1000);
                
                // Generate correlation ID for this transaction (group related events)
                let correlationId = eventCorrelationMap.get(tx.hash);
                if (!correlationId) {
                  correlationId = `tx-${tx.hash}-${Date.now()}`;
                  eventCorrelationMap.set(tx.hash, correlationId);
                }
                
                // Determine event type
                let eventType = 'Unknown';
                if (topic0 === reactHandledTopic) eventType = 'ReactHandled';
                else if (topic0 === callbackTopic) eventType = 'Callback';
                else if (topic0 === strategyUpdateTopic) eventType = 'StrategyUpdate';
                
                const eventData = {
                  blockNumber: tx.sessionId ? parseInt(tx.sessionId, 16) : null,
                  transactionHash: tx.hash,
                  transactionNumber: tx.number,
                  transactionTimestamp: txTimestamp,
                  receivedAt: receivedAt, // Server-side timestamp
                  correlationId: correlationId, // Links related events
                  topic0: topic0,
                  topics: log.topics || [],
                  data: log.data || '0x',
                  address: log.address,
                  eventType: eventType
                };

                // If it's a ReactHandled event, try to fetch the original Aave event
                if (topic0 === reactHandledTopic) {
                  try {
                    const decoded = reactHandledIface.decodeEventLog('ReactHandled', log.data, log.topics);
                    const originEvent = await fetchOriginAaveEvent(
                      decoded.chainId,
                      decoded.emitter,
                      decoded.txHash,
                      decoded.logIndex
                    );
                    
                    if (originEvent) {
                      eventData.originEvent = originEvent;
                      
                      // Decode Aave ReserveDataUpdated event if present
                      if (originEvent.topics && originEvent.topics[0] === reserveDataUpdatedTopic) {
                        try {
                          const decodedAave = aaveEventIface.decodeEventLog('ReserveDataUpdated', originEvent.data, originEvent.topics);
                          
                          // Convert RAY to percentage and basis points
                          const liquidityRatePercent = decodedAave.liquidityRate.mul(100).div(RAY);
                          const stableBorrowRatePercent = decodedAave.stableBorrowRate.mul(100).div(RAY);
                          const variableBorrowRatePercent = decodedAave.variableBorrowRate.mul(100).div(RAY);
                          
                          eventData.originEvent.decoded = {
                            reserve: decodedAave.reserve,
                            liquidityRate: decodedAave.liquidityRate.toString(),
                            liquidityRateBps: liquidityRatePercent.toString(),
                            liquidityRatePercent: parseFloat(liquidityRatePercent.toString()) / 100,
                            stableBorrowRate: decodedAave.stableBorrowRate.toString(),
                            stableBorrowRateBps: stableBorrowRatePercent.toString(),
                            stableBorrowRatePercent: parseFloat(stableBorrowRatePercent.toString()) / 100,
                            variableBorrowRate: decodedAave.variableBorrowRate.toString(),
                            variableBorrowRateBps: variableBorrowRatePercent.toString(),
                            variableBorrowRatePercent: parseFloat(variableBorrowRatePercent.toString()) / 100,
                            liquidityIndex: decodedAave.liquidityIndex.toString(),
                            variableBorrowIndex: decodedAave.variableBorrowIndex.toString()
                          };
                        } catch (decodeError) {
                          console.log(`Could not decode Aave event data: ${decodeError.message}`);
                        }
                      }
                    }
                  } catch (decodeError) {
                    // If decoding fails, just continue without origin event
                    console.log(`Could not decode ReactHandled event: ${decodeError.message}`);
                  }
                }

                // If it's a Callback event, decode the payload for easier frontend processing
                if (topic0 === callbackTopic) {
                  try {
                    const decoded = callbackIface.decodeEventLog('Callback', log.data, log.topics);
                    eventData.callbackData = {
                      chainId: decoded.chain_id.toString(),
                      contract: decoded._contract,
                      gasLimit: decoded.gas_limit.toString(),
                      payload: decoded.payload
                    };
                    
                    // Try to decode APY query parameters if payload matches expected format
                    if (decoded.payload && decoded.payload.length >= 266) {
                      const functionSelector = decoded.payload.slice(0, 10);
                      
                      // Aave APY query: queryAaveApy(uint256 nonce, address asset, uint256 apyBps, uint256 timestamp)
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
                          
                          eventData.apyQuery = {
                            protocol: 'Aave',
                            assetAddress: assetAddr,
                            apyBps: apyBps,
                            apyPercent: apyPercent,
                            queryTimestamp: timestamp,
                            transactionTimestamp: txTimestamp
                          };
                        }
                      }
                      // Compound APY query: queryCompoundApy(uint256 nonce)
                      else if (functionSelector === '0xcb3dd0fd') {
                        // Decode parameters: (uint256 nonce)
                        const paramData = decoded.payload.slice(10);
                        if (paramData.length >= 64) {
                          const nonce = ethers.BigNumber.from('0x' + paramData.slice(0, 64));
                          
                          eventData.apyQuery = {
                            protocol: 'Compound',
                            nonce: nonce.toString(),
                            queryTimestamp: txTimestamp || receivedAt,
                            transactionTimestamp: txTimestamp
                          };
                        }
                      }
                      // Rebalance execution: executeReaction(address rsc, FuseAction[] actions)
                      else if (functionSelector === '0x90b87782') {
                        eventData.callbackData.action = 'executeReaction';
                        eventData.callbackData.actionType = 'rebalance';
                      }
                    }
                  } catch (decodeError) {
                    // If decoding fails, just continue without callback data
                    console.log(`Could not decode Callback event: ${decodeError.message}`);
                  }
                }
                
                // If it's a StrategyUpdate event, decode strategy data
                if (topic0 === strategyUpdateTopic) {
                  try {
                    const decoded = strategyUpdateIface.decodeEventLog('StrategyUpdate', log.data, log.topics);
                    eventData.strategyUpdate = {
                      aaveApyBps: decoded.aaveApy.toString(),
                      aaveApyPercent: parseFloat(decoded.aaveApy.toString()) / 100,
                      compoundApyBps: decoded.compoundApy.toString(),
                      compoundApyPercent: parseFloat(decoded.compoundApy.toString()) / 100,
                      spreadBps: decoded.spread.toString(),
                      spreadPercent: parseFloat(decoded.spread.toString()) / 100,
                      rebalanced: decoded.rebalanced,
                      timestamp: txTimestamp || receivedAt
                    };
                    
                    // Calculate spread direction
                    if (decoded.aaveApy.gt(decoded.compoundApy)) {
                      eventData.strategyUpdate.direction = 'AaveToCompound';
                      eventData.strategyUpdate.higherApy = 'Aave';
                    } else if (decoded.compoundApy.gt(decoded.aaveApy)) {
                      eventData.strategyUpdate.direction = 'CompoundToAave';
                      eventData.strategyUpdate.higherApy = 'Compound';
                    } else {
                      eventData.strategyUpdate.direction = 'Equal';
                      eventData.strategyUpdate.higherApy = 'Equal';
                    }
                  } catch (decodeError) {
                    console.log(`Could not decode StrategyUpdate event: ${decodeError.message}`);
                  }
                }

                events.push(eventData);
              }
            }
          }
        }
      } catch (error) {
        // Skip if logs not available
        console.log(`Could not get logs for tx ${tx.number}:`, error.message);
      }
    }

    // Sort by transaction number (most recent first)
    events.sort((a, b) => {
      const numA = parseInt(a.transactionNumber, 16);
      const numB = parseInt(b.transactionNumber, 16);
      return numB - numA;
    });

    // Calculate summary statistics
    const summary = {
      totalEvents: events.length,
      byType: {
        ReactHandled: events.filter(e => e.eventType === 'ReactHandled').length,
        Callback: events.filter(e => e.eventType === 'Callback').length,
        StrategyUpdate: events.filter(e => e.eventType === 'StrategyUpdate').length
      },
      withAaveData: events.filter(e => e.originEvent && e.originEvent.decoded).length,
      withStrategyUpdate: events.filter(e => e.strategyUpdate).length,
      rebalances: events.filter(e => e.strategyUpdate && e.strategyUpdate.rebalanced).length,
      apyQueries: events.filter(e => e.apyQuery).length
    };

    // Calculate APY statistics if available
    const strategyUpdates = events.filter(e => e.strategyUpdate);
    if (strategyUpdates.length > 0) {
      const aaveApys = strategyUpdates.map(e => parseFloat(e.strategyUpdate.aaveApyPercent)).filter(v => !isNaN(v));
      const compoundApys = strategyUpdates.map(e => parseFloat(e.strategyUpdate.compoundApyPercent)).filter(v => !isNaN(v));
      
      if (aaveApys.length > 0) {
        summary.apyStats = {
          aave: {
            min: Math.min(...aaveApys),
            max: Math.max(...aaveApys),
            avg: aaveApys.reduce((a, b) => a + b, 0) / aaveApys.length,
            latest: aaveApys[0]
          }
        };
      }
      
      if (compoundApys.length > 0) {
        summary.apyStats = summary.apyStats || {};
        summary.apyStats.compound = {
          min: Math.min(...compoundApys),
          max: Math.max(...compoundApys),
          avg: compoundApys.reduce((a, b) => a + b, 0) / compoundApys.length,
          latest: compoundApys[0]
        };
      }
    }

    res.json({
      events: events,
      count: events.length,
      summary: summary,
      metadata: {
        rvmId: rvmId,
        headNumber: headNumber,
        transactionsQueried: transactions.length,
        walletAddress: walletAddress,
        timestamp: Math.floor(Date.now() / 1000)
      }
    });
  } catch (error) {
    console.error('Error fetching RSC events:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('='.repeat(70));
  console.log('🚀 Reactive Network Monitor Server');
  console.log('='.repeat(70));
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Frontend: http://localhost:${PORT}/live-monitor.html`);
  if (REACTIVE_PRIVATE_KEY) {
    const wallet = new ethers.Wallet(REACTIVE_PRIVATE_KEY);
    console.log(`Wallet: ${wallet.address} (from .env)`);
  } else {
    console.log('⚠️  REACTIVE_PRIVATE_KEY not set - funding disabled');
  }
  console.log('='.repeat(70));
});

