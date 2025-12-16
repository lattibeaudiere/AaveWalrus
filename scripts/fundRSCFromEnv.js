const { ethers } = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function fundRSC() {
  const RSC_ADDRESS = process.env.RSC_ADDRESS || '0xbc183f419B48D4fd5Ad4e375e198ECc0fd48d8A5';
  const SYSTEM_CONTRACT = '0x0000000000000000000000000000000000fffFfF';
  const AMOUNT = process.env.FUND_AMOUNT || '1.0'; // Default 1 REACT
  const REACTIVE_RPC = process.env.REACTIVE_RPC || 'https://mainnet-rpc.rnk.dev';
  const PRIVATE_KEY = process.env.REACTIVE_PRIVATE_KEY;

  if (!PRIVATE_KEY) {
    console.error('❌ REACTIVE_PRIVATE_KEY not set in .env');
    process.exit(1);
  }

  const provider = new ethers.providers.JsonRpcProvider(REACTIVE_RPC);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const amountWei = ethers.utils.parseEther(AMOUNT);

  console.log('💰 Funding Reactive RSC...\n');
  console.log('RSC Contract:', RSC_ADDRESS);
  console.log('System Contract:', SYSTEM_CONTRACT);
  console.log('Amount:', AMOUNT, 'REACT');
  console.log('Wallet:', wallet.address);
  console.log('');

  // Check balance
  const balance = await provider.getBalance(wallet.address);
  console.log('Wallet Balance:', ethers.utils.formatEther(balance), 'REACT');

  if (balance.lt(amountWei)) {
    console.error('❌ Insufficient balance!');
    process.exit(1);
  }

  // Check current contract status
  const contractBalance = await provider.getBalance(RSC_ADDRESS);
  const systemAbi = ['function debts(address) view returns (uint256)'];
  const systemContract = new ethers.Contract(SYSTEM_CONTRACT, systemAbi, provider);
  let debt = ethers.BigNumber.from(0);
  try {
    debt = await systemContract.debts(RSC_ADDRESS);
  } catch (e) {
    console.log('Could not check debt:', e.message);
  }

  console.log('Contract Balance:', ethers.utils.formatEther(contractBalance), 'REACT');
  console.log('Contract Debt:', ethers.utils.formatEther(debt), 'REACT');
  console.log('');

  // Fund using depositTo
  const depositAbi = ['function depositTo(address reactiveContract) external payable'];
  const depositContract = new ethers.Contract(SYSTEM_CONTRACT, depositAbi, wallet);

  console.log('📤 Sending transaction...');
  const tx = await depositContract.depositTo(RSC_ADDRESS, {
    value: amountWei,
    gasLimit: 100000
  });

  console.log('Transaction hash:', tx.hash);
  console.log('Waiting for confirmation...');

  const receipt = await tx.wait();

  if (receipt.status === 1) {
    console.log('✅ Deposit successful! Debt automatically settled.');
    console.log('');

    // Final status
    const finalBalance = await provider.getBalance(RSC_ADDRESS);
    let finalDebt = ethers.BigNumber.from(0);
    try {
      finalDebt = await systemContract.debts(RSC_ADDRESS);
    } catch (e) {
      // Ignore
    }

    console.log('📊 Final Status:');
    console.log('Contract Balance:', ethers.utils.formatEther(finalBalance), 'REACT');
    console.log('Contract Debt:', ethers.utils.formatEther(finalDebt), 'REACT');
    console.log('');
    console.log('✅ Funding complete!');
    console.log('View on Reactscan:', `https://reactscan.io/tx/${tx.hash}`);
  } else {
    console.error('❌ Transaction failed');
    process.exit(1);
  }
}

fundRSC().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});

