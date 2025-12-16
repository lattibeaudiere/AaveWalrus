const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function fundNewRSC() {
    console.log("=".repeat(70));
    console.log("💰 FUNDING NEW RSC TO ACTIVATE IT");
    console.log("=".repeat(70));
    console.log("");
    
    // CRITICAL: Use NEW RSC with NEW adapter
    const RSC_ADDRESS = "0xAC66a994B8BB8b4a9aC90830Ac72207Cd22e7f21";
    const SYSTEM_CONTRACT = "0x0000000000000000000000000000000000fffFfF";
    const REACTIVE_RPC = process.env.REACTIVE_RPC || "https://reactive-network.rpc.thirdweb.com";
    
    const provider = new ethers.providers.JsonRpcProvider(REACTIVE_RPC);
    
    const wallet = new ethers.Wallet(
        process.env.REACTIVE_PRIVATE_KEY,
        provider
    );
    
    console.log("RSC Address:", RSC_ADDRESS);
    console.log("Wallet:", wallet.address);
    console.log("");
    
    // Check current status
    const systemContractABI = [
        "function reserves(address contract_) external view returns (uint256)",
        "function debts(address contract_) external view returns (uint256)",
        "function depositTo(address contract_) external payable returns (uint256)"
    ];
    
    const systemContract = new ethers.Contract(SYSTEM_CONTRACT, systemContractABI, wallet);
    
    const directBalance = await provider.getBalance(RSC_ADDRESS);
    const debt = await systemContract.debts(RSC_ADDRESS);
    const reserves = await systemContract.reserves(RSC_ADDRESS);
    
    console.log("Current Status:");
    console.log(`  Direct Balance: ${ethers.utils.formatEther(directBalance)} REACT`);
    console.log(`  Debt: ${ethers.utils.formatEther(debt)} REACT`);
    console.log(`  Reserves: ${ethers.utils.formatEther(reserves)} REACT`);
    console.log("");
    
    // Check if active
    const netReserves = reserves.gt(debt) ? reserves.sub(debt) : ethers.BigNumber.from(0);
    const minReserves = ethers.utils.parseEther("0.001"); // 0.001 REACT minimum
    const isActive = netReserves.gte(minReserves);
    
    console.log(`  Active: ${isActive ? "✅ YES" : "❌ NO"}`);
    console.log("");
    
    if (isActive) {
        console.log("✅ RSC is already active! No funding needed.");
        return;
    }
    
    // Calculate amount needed: debt + minimum reserves
    const amountNeeded = debt.add(minReserves);
    const amountNeededReact = ethers.utils.formatEther(amountNeeded);
    
    console.log("Funding Required:");
    console.log(`  Debt to cover: ${ethers.utils.formatEther(debt)} REACT`);
    console.log(`  Minimum reserves: ${ethers.utils.formatEther(minReserves)} REACT`);
    console.log(`  Total needed: ${amountNeededReact} REACT`);
    console.log("");
    
    // Check wallet balance
    const walletBalance = await provider.getBalance(wallet.address);
    const walletBalanceReact = ethers.utils.formatEther(walletBalance);
    
    console.log(`Wallet Balance: ${walletBalanceReact} REACT`);
    console.log("");
    
    if (walletBalance.lt(amountNeeded)) {
        console.log("❌ Insufficient wallet balance!");
        console.log(`   Need: ${amountNeededReact} REACT`);
        console.log(`   Have: ${walletBalanceReact} REACT`);
        return;
    }
    
    // Fund via system contract (automatically settles debt)
    console.log("Funding reserves via system contract...");
    console.log("");
    
    try {
        // Add a bit extra for safety (0.002 REACT total)
        const fundingAmount = debt.add(ethers.utils.parseEther("0.002"));
        const tx = await systemContract.depositTo(RSC_ADDRESS, {
            value: fundingAmount,
            gasLimit: 300000
        });
        
        console.log("Transaction:", tx.hash);
        console.log("Waiting for confirmation...");
        
        const receipt = await tx.wait();
        
        if (receipt.status === 1) {
            console.log("✅ Funding successful!");
            console.log("");
            
            // Check new status
            const newDebt = await systemContract.debts(RSC_ADDRESS);
            const newReserves = await systemContract.reserves(RSC_ADDRESS);
            const newNetReserves = newReserves.gt(newDebt) ? newReserves.sub(newDebt) : ethers.BigNumber.from(0);
            const newIsActive = newNetReserves.gte(minReserves);
            
            console.log("New Status:");
            console.log(`  Debt: ${ethers.utils.formatEther(newDebt)} REACT`);
            console.log(`  Reserves: ${ethers.utils.formatEther(newReserves)} REACT`);
            console.log(`  Net Reserves: ${ethers.utils.formatEther(newNetReserves)} REACT`);
            console.log(`  Active: ${newIsActive ? "✅ YES" : "❌ NO"}`);
            console.log("");
            
            if (newIsActive) {
                console.log("🎉 RSC is now ACTIVE and can process events!");
            } else {
                console.log("⚠️  RSC is still inactive - may need more funding");
            }
        } else {
            console.log("❌ Transaction failed");
        }
        
    } catch (error) {
        console.log("❌ Error funding:", error.message);
    }
    
    console.log("");
    console.log("=".repeat(70));
}

fundNewRSC().catch(console.error);

