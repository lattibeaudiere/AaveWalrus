const { ethers } = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function fundAndCoverDebt() {
    const CONTRACT = process.env.RSC_ADDRESS || "0x02c904E571749c61bdd05e58FbF91F7921594186";
    const SYSTEM_CONTRACT = "0x0000000000000000000000000000000000fffFfF";
    const AMOUNT = ethers.utils.parseEther(process.env.FUND_AMOUNT || "1.0");
    
    const provider = new ethers.providers.JsonRpcProvider(
        process.env.REACTIVE_RPC || "https://mainnet-rpc.rnk.dev"
    );
    
    if (!process.env.REACTIVE_PRIVATE_KEY) {
        console.error("❌ REACTIVE_PRIVATE_KEY not set in .env");
        process.exit(1);
    }
    
    const signer = new ethers.Wallet(process.env.REACTIVE_PRIVATE_KEY, provider);
    
    console.log("💰 Funding Reactive RSC and Settling Debt...\n");
    console.log("RSC Contract:", CONTRACT);
    console.log("System Contract:", SYSTEM_CONTRACT);
    console.log("Amount:", ethers.utils.formatEther(AMOUNT), "REACT");
    
    // Check current balance
    const balance = await provider.getBalance(CONTRACT);
    console.log("Current Balance:", ethers.utils.formatEther(balance), "REACT");
    
    // Check debt
    const SYSTEM_ABI = ["function debts(address) view returns (uint256)"];
    const systemContract = new ethers.Contract(SYSTEM_CONTRACT, SYSTEM_ABI, provider);
    
    try {
        const debt = await systemContract.debts(CONTRACT);
        console.log("Current Debt:", ethers.utils.formatEther(debt), "REACT");
        
        if (debt.gt(0)) {
            console.log("\n⚠️  Contract has outstanding debt! Will settle after funding.");
        }
    } catch (error) {
        console.log("Could not check debt:", error.message);
    }
    
    // Method 1: Try direct transfer first
    console.log("\n📤 Method 1: Attempting direct transfer...");
    try {
        const transferTx = await signer.sendTransaction({
            to: CONTRACT,
            value: AMOUNT,
            gasLimit: 21000
        });
        
        console.log("Transfer hash:", transferTx.hash);
        const receipt = await transferTx.wait();
        
        if (receipt.status === 1) {
            console.log("✅ Transfer successful!");
            
            // Now settle debt
            console.log("\n📤 Settling debt with coverDebt()...");
            const CONTRACT_ABI = ["function coverDebt() external"];
            const contract = new ethers.Contract(CONTRACT, CONTRACT_ABI, signer);
            
            const coverTx = await contract.coverDebt({ gasLimit: 100000 });
            console.log("Cover debt hash:", coverTx.hash);
            await coverTx.wait();
            console.log("✅ Debt settled!");
            
        } else {
            throw new Error("Transfer failed");
        }
    } catch (error) {
        console.log("❌ Direct transfer failed:", error.message);
        console.log("\n📤 Method 2: Trying system contract depositTo()...");
        
        // Method 2: Use system contract depositTo() (automatically settles debt)
        const SYSTEM_DEPOSIT_ABI = ["function depositTo(address reactiveContract) external payable"];
        const systemDeposit = new ethers.Contract(SYSTEM_CONTRACT, SYSTEM_DEPOSIT_ABI, signer);
        
        try {
            const depositTx = await systemDeposit.depositTo(CONTRACT, {
                value: AMOUNT,
                gasLimit: 100000
            });
            
            console.log("Deposit hash:", depositTx.hash);
            const receipt = await depositTx.wait();
            
            if (receipt.status === 1) {
                console.log("✅ Deposit successful! Debt automatically settled.");
            } else {
                throw new Error("Deposit failed");
            }
        } catch (error2) {
            console.error("❌ System contract deposit also failed:", error2.message);
            console.error("\n💡 Possible reasons:");
            console.error("   - Contract may not accept direct funding");
            console.error("   - Contract may need to be funded through callbacks");
            console.error("   - There may be restrictions on the Reactive Network");
            process.exit(1);
        }
    }
    
    // Final check
    console.log("\n📊 Final Status:");
    const finalBalance = await provider.getBalance(CONTRACT);
    console.log("Contract Balance:", ethers.utils.formatEther(finalBalance), "REACT");
    
    try {
        const finalDebt = await systemContract.debts(CONTRACT);
        console.log("Contract Debt:", ethers.utils.formatEther(finalDebt), "REACT");
    } catch (error) {
        console.log("Could not check final debt");
    }
    
    console.log("\n✅ Funding complete!");
}

fundAndCoverDebt().catch(console.error);

