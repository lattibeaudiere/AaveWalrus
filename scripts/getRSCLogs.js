const { ethers } = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function getRSCLogs() {
    console.log('='.repeat(70));
    console.log(' FETCHING RSC LOGS');
    console.log('='.repeat(70));
    console.log('');

    const RSC_ADDRESS = (process.env.RSC_ADDRESS || '').trim() || '0xbc183f419B48D4fd5Ad4e375e198ECc0fd48d8A5';
    const REACTIVE_RPC = process.env.REACTIVE_RPC || 'https://reactive-network.rpc.thirdweb.com';
    const PRIVATE_KEY = process.env.REACTIVE_PRIVATE_KEY;
    const BLOCK_RANGE = parseInt(process.env.LOG_BLOCK_RANGE || '5000', 10);

    if (!RSC_ADDRESS) {
        console.error(' RSC_ADDRESS must be set in .env or environment');
        process.exit(1);
    }

    const provider = new ethers.providers.JsonRpcProvider(REACTIVE_RPC);
    const wallet = PRIVATE_KEY ? new ethers.Wallet(PRIVATE_KEY, provider) : null;

    console.log('Configuration:');
    console.log(`  RPC: ${REACTIVE_RPC}`);
    console.log(`  RSC: ${RSC_ADDRESS}`);
    console.log(`  Range: last ${BLOCK_RANGE} blocks`);
    if (wallet) {
        console.log(`  Using wallet: ${wallet.address}`);
    } else {
        console.log('  Wallet: none (read-only)');
    }
    console.log('');

    const iface = new ethers.utils.Interface([
        'event Callback(uint256 indexed chain_id, address indexed _contract, uint64 indexed gas_limit, bytes payload)',
        'event Subscribed(uint256 chainId, address target, uint256 topic0)',
        'event Unsubscribed(uint256 chainId, address target, uint256 topic0)',
        'event ReactHandled(uint256 chainId, address emitter, uint256 txHash, uint256 logIndex)',
        'event StrategyUpdate(uint256 aaveApy, uint256 compoundApy, uint256 spread, bool rebalanced)',
        'event ReservesFunded(uint256 amount, uint256 newReserves)',
        'event EmergencyWithdraw(address token, uint256 amount)'
    ]);

    try {
        const latestBlock = await provider.getBlockNumber();
        const fromBlock = Math.max(0, latestBlock - BLOCK_RANGE);

        console.log(`Latest block: ${latestBlock}`);
        console.log(`Querying from block ${fromBlock} to ${latestBlock}`);
        console.log('');

        const logs = await provider.getLogs({
            address: RSC_ADDRESS,
            fromBlock,
            toBlock: latestBlock
        });

        if (logs.length === 0) {
            console.log('  No logs found in range');
            return;
        }

        console.log(`Found ${logs.length} logs`);
        console.log('');

        for (let i = 0; i < logs.length; i++) {
            const log = logs[i];
            const block = await provider.getBlock(log.blockNumber);
            const timestamp = block ? new Date(block.timestamp * 1000).toISOString() : 'unknown';

            console.log('-'.repeat(70));
            console.log(`Log #${i + 1}`);
            console.log(`  Address: ${log.address}`);
            console.log(`  Block: ${log.blockNumber} (${timestamp})`);
            console.log(`  Tx: ${log.transactionHash}`);
            console.log(`  Index: ${log.logIndex}`);
            console.log(`  Topics: ${log.topics.length}`);
            log.topics.forEach((topic, idx) => {
                console.log(`    Topic${idx}: ${topic}`);
            });

            try {
                const parsed = iface.parseLog(log);
                console.log(`   Event: ${parsed.name}`);
                Object.entries(parsed.args)
                    .filter(([key]) => isNaN(Number(key)))
                    .forEach(([key, value]) => {
                        if (ethers.BigNumber.isBigNumber(value)) {
                            console.log(`    ${key}: ${value.toString()}`);
                        } else {
                            console.log(`    ${key}: ${value}`);
                        }
                    });

                if (parsed.name === 'Callback') {
                    const payload = parsed.args.payload;
                    console.log('    Payload preview:', payload.slice(0, 66));
                    try {
                        const payloadIface = new ethers.utils.Interface([
                            'function queryCompoundApy(uint256 nonce)',
                            'function queryBothApys(uint256 nonce)'
                        ]);
                        const decoded = payloadIface.parseTransaction({ data: payload });
                        console.log(`    Payload function: ${decoded.name}`);
                        console.log(`    Payload args: ${decoded.args.map(arg => arg.toString()).join(', ')}`);
                    } catch (err) {
                        console.log(`    Payload decode error: ${err.message}`);
                    }
                }

                if (parsed.name === 'StrategyUpdate') {
                    const aave = Number(parsed.args.aaveApy) / 100;
                    const compound = Number(parsed.args.compoundApy) / 100;
                    const spread = Number(parsed.args.spread) / 100;
                    console.log(`    Aave APY: ${aave.toFixed(2)}%`);
                    console.log(`    Compound APY: ${compound.toFixed(2)}%`);
                    console.log(`    Spread: ${spread.toFixed(2)}%`);
                    console.log(`    Rebalanced: ${parsed.args.rebalanced ? ' yes' : ' no'}`);
                }

            } catch (err) {
                console.log('    Could not decode event');
                console.log(`    Error: ${err.message}`);
                console.log(`    Data: ${log.data}`);
            }

            console.log('');
        }

        console.log('-'.repeat(70));
        console.log(' Done');
    } catch (error) {
        console.error(' Error fetching logs:', error.message);
        process.exit(1);
    }
}

getRSCLogs().catch(console.error);
