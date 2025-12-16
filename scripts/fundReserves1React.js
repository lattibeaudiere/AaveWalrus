const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function fundReserves1React() {
    console.log("=".repeat(70));
    console.log("💰 FUNDING RSC RESERVES WITH 1 REACT");
    console.log("=".repeat(70));
    console.log("");
    
    const RSC_ADDRESS = "0xf64afe64622CeAe79d48A15ebC49CC7FF416c688"; // New RSC with initialization
    const SYSTEM_CONTRACT = "0x0000000000000000000000000000000000fffFfF";
    const REACTIVE_RPC = process.env.REACTIVE_RPC || "https://reactive-network.rpc.thirdweb.com";
    const REACTIVE_PRIVATE_KEY = process.env.REACTIVE_PRIVATE_KEY;
    
    if (!REACTIVE_PRIVATE_KEY) {
        console.error("❌ ERROR: REACTIVE_PRIVATE_KEY must be set");
        process.exit(1);
    }
    
    const provider = new ethers.providers.JsonRpcProvider(REACTIVE_RPC);
    const wallet = new ethers.Wallet(REACTIVE_PRIVATE_KEY, provider);
    
    console.log("RSC Address:", RSC_ADDRESS);
    console.log("Wallet:", wallet.address);
    console.log("");
    
    // System contract ABI
    const systemContractABI = [
        "function reserves(address contract_) external view returns (uint256)",
        "function debts(address contract_) external view returns (uint256)",
        "function depositTo(address contract_) external payable returns (uint256)"
    ];
    
    const systemContract = new ethers.Contract(SYSTEM_CONTRACT, systemContractABI, wallet);
    
    // Check current status
    console.log("Current Status:");
    const reservesBefore = await systemContract.reserves(RSC_ADDRESS);
    const debt = await systemContract.debts(RSC_ADDRESS);
    
    console.log(`   Reserves: ${ethers.utils.formatEther(reservesBefore)} REACT`);
    console.log(`   Debt: ${ethers.utils.formatEther(debt)} REACT`);
    console.log("");
    
    // Check wallet balance
    const walletBalance = await provider.getBalance(wallet.address);
    const walletBalanceReact = ethers.utils.formatEther(walletBalance);
    
    console.log(`Wallet Balance: ${walletBalanceReact} REACT`);
    
    const amountToSend = ethers.utils.parseEther("1.0"); // 1 REACT
    
    if (walletBalance.lt(amountToSend)) {
        console.error(`❌ ERROR: Insufficient balance`);
        console.error(`   Need: 1.0 REACT`);
        console.error(`   Have: ${walletBalanceReact} REACT`);
        process.exit(1);
    }
    console.log("");
    
    // Fund reserves
    console.log("Sending 1 REACT to reserves...");
    console.log("");
    
    try {
        const tx = await systemContract.depositTo(RSC_ADDRESS, {
            value: amountToSend,
            gasLimit: 300000
        });
        
        console.log("Transaction:", tx.hash);
        console.log("Waiting for confirmation...");
        
        const receipt = await tx.wait();
        
        if (receipt.status === 1) {
            console.log("✅ Funding successful!");
            console.log("");
            
            // Check new status
            const reservesAfter = await systemContract.reserves(RSC_ADDRESS);
            const newDebt = await systemContract.debts(RSC_ADDRESS);
            
            console.log("New Status:");
            console.log(`   Reserves: ${ethers.utils.formatEther(reservesAfter)} REACT`);
            console.log(`   Debt: ${ethers.utils.formatEther(newDebt)} REACT`);
            console.log(`   Net Reserves: ${ethers.utils.formatEther(reservesAfter.sub(newDebt))} REACT`);
            console.log("");
            
            const isActive = reservesAfter.gt(newDebt) && reservesAfter.gte(ethers.utils.parseEther("0.001"));
            console.log(`   Active: ${isActive ? "✅ YES" : "❌ NO"}`);
            console.log("");
        } else {
            console.log("❌ Transaction failed");
        }
        
    } catch (error) {
        console.log("❌ Error funding:", error.message);
        if (error.transactionHash) {
            console.log("   Transaction:", error.transactionHash);
        }
    }
    
    console.log("=".repeat(70));
}

fundReserves1React().catch(console.error);

