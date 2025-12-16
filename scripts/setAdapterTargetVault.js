const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function setTargetVault() {
    const ADAPTER_ADDRESS = process.env.ADAPTER_ADDRESS || "0x58DB4C40CE50FEfAD8EEaA0B609e12dE21b18805";
    const TARGET_VAULT = process.env.TARGET_VAULT;
    
    const provider = new ethers.providers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc"
    );
    
    const wallet = new ethers.Wallet(
        process.env.PRIVATE_KEY || process.env.ARBITRUM_PRIVATE_KEY,
        provider
    );
    
    const adapter = new ethers.Contract(
        ADAPTER_ADDRESS,
        [
            "function setTargetVault(address vault) external",
            "function targetVault() external view returns (address)"
        ],
        wallet
    );
    
    console.log("Setting target vault on adapter...");
    console.log("Adapter:", ADAPTER_ADDRESS);
    console.log("Vault:", TARGET_VAULT);
    console.log("");
    
    const current = await adapter.targetVault();
    if (current.toLowerCase() === TARGET_VAULT.toLowerCase()) {
        console.log("✅ Target vault already set!");
        return;
    }
    
    const tx = await adapter.setTargetVault(TARGET_VAULT, { gasLimit: 100000 });
    console.log("Transaction:", tx.hash);
    await tx.wait();
    console.log("✅ Target vault set!");
}

setTargetVault().catch(console.error);

