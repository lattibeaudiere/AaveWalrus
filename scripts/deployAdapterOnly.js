require("dotenv").config();
const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying ReactiveAlphaAdapter to Arbitrum...");

  let [deployer] = await ethers.getSigners();
  if (!deployer) {
    const pk = process.env.PRIVATE_KEY || process.env.ARBITRUM_PRIVATE_KEY;
    if (!pk) {
      console.error("❌ No PRIVATE_KEY found in environment.");
      process.exit(1);
    }
    const { Wallet } = require("ethers");
    deployer = new Wallet(pk, ethers.provider);
  }

  console.log("Deployer:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");
  try {
    const FactoryTmp = await ethers.getContractFactory("ReactiveAlphaAdapter");
    const feeData = await ethers.provider.getFeeData();
    const deployTx = FactoryTmp.getDeployTransaction(deployer.address);
    // Optional: show fee data
    console.log("FeeData maxFeePerGas:", feeData.maxFeePerGas?.toString() || "auto");
  } catch (e) {
    // ignore estimate errors; proceed with default deployment
  }

  const Factory = await ethers.getContractFactory("ReactiveAlphaAdapter", deployer);
  const adapter = await Factory.deploy(deployer.address);
  await adapter.waitForDeployment();
  const address = await adapter.getAddress();
  console.log("✅ Adapter deployed:", address);
  console.log("   Tx:", adapter.deploymentTransaction()?.hash || "");
}

main().catch((e) => {
  console.error("❌ Deployment failed:", e);
  process.exit(1);
});


