require("dotenv").config();
const { ethers } = require("hardhat");

/**
 * Mainnet Deployment Script for IPOR Fusion + RSC
 * 
 * Deploys:
 * 1. ReactiveAlphaAdapter
 * 2. YieldOptimizerRSC
 * 
 * WARNING: This deploys to Arbitrum MAINNET with real funds!
 */

async function main() {
  console.log("🚀 STARTING MAINNET DEPLOYMENT TO ARBITRUM");
  console.log("=".repeat(60));
  console.log("⚠️  WARNING: You are deploying to MAINNET!");
  console.log("⚠️  Make sure all addresses are correct!");
  console.log("=".repeat(60));
  
  // Get deployer
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
  console.log("\n📝 Deploying with account:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "ETH");
  
  if (balance < ethers.parseEther("0.01")) {
    console.error("❌ INSUFFICIENT BALANCE! Need at least 0.01 ETH");
    process.exit(1);
  }

  // Configuration from environment
  const config = {
    targetVault: process.env.TARGET_VAULT || "0x0000000000000000000000000000000000000000",
    aavePool: process.env.AAVE_V3_POOL || "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
    compoundMarket: process.env.COMPOUND_MARKET || "0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA",
    aaveDataProvider: process.env.AAVE_DATA_PROVIDER || "0x69FA688f1Dc47d4B5d8029D5a35FB7a548310654",
    minSpreadBps: parseInt(process.env.MIN_SPREAD_BPS || "50"),
    
    // Fuse addresses - MUST BE PROVIDED!
    aaveSupplyFuse: process.env.AAVE_SUPPLY_FUSE,
    aaveBalanceFuse: process.env.AAVE_BALANCE_FUSE,
    compoundSupplyFuse: process.env.COMPOUND_SUPPLY_FUSE,
    compoundBalanceFuse: process.env.COMPOUND_BALANCE_FUSE,
  };

  // Validate critical addresses
  if (config.targetVault === "0x0000000000000000000000000000000000000000") {
    console.error("❌ TARGET_VAULT must be set! Deploy IPOR Fusion vault first.");
    process.exit(1);
  }

  console.log("\n📋 Deployment Configuration:");
  console.log("Target Vault:", config.targetVault);
  console.log("Aave Pool:", config.aavePool);
  console.log("Compound Market:", config.compoundMarket);
  console.log("Min Spread:", config.minSpreadBps, "bps (", config.minSpreadBps / 100, "%)");

  // Confirm deployment
  console.log("\n⏸️  Waiting 10 seconds before deployment...");
  console.log("   Press Ctrl+C to cancel");
  await new Promise(resolve => setTimeout(resolve, 10000));

  // ===== 1. Deploy ReactiveAlphaAdapter =====
  console.log("\n📦 [1/2] Deploying ReactiveAlphaAdapter...");
  const ReactiveAlphaAdapterFactory = await ethers.getContractFactory("ReactiveAlphaAdapter");
  const adapter = await ReactiveAlphaAdapterFactory.deploy(deployer.address);
  await adapter.waitForDeployment();
  const adapterAddress = await adapter.getAddress();
  console.log("✅ ReactiveAlphaAdapter deployed at:", adapterAddress);
  console.log("   Transaction:", adapter.deploymentTransaction()?.hash);

  // ===== 2. Deploy YieldOptimizerRSC =====
  console.log("\n📦 [2/2] Deploying YieldOptimizerRSC...");
  
  // Check if fuse addresses are provided
  if (!config.aaveSupplyFuse || !config.aaveBalanceFuse || 
      !config.compoundSupplyFuse || !config.compoundBalanceFuse) {
    console.warn("⚠️  WARNING: Fuse addresses not set!");
    console.warn("   Deploying with placeholder addresses.");
    console.warn("   You MUST update these before using the RSC!");
  }

  const YieldOptimizerRSCFactory = await ethers.getContractFactory("YieldOptimizerRSC");
  const rsc = await YieldOptimizerRSCFactory.deploy(
    config.targetVault,
    adapterAddress,
    config.aavePool,
    config.compoundMarket,
    config.minSpreadBps,
    config.aaveSupplyFuse || ethers.ZeroAddress,
    config.aaveBalanceFuse || ethers.ZeroAddress,
    config.compoundSupplyFuse || ethers.ZeroAddress,
    config.compoundBalanceFuse || ethers.ZeroAddress,
    config.aaveDataProvider
  );
  await rsc.waitForDeployment();
  const rscAddress = await rsc.getAddress();
  console.log("✅ YieldOptimizerRSC deployed at:", rscAddress);
  console.log("   Transaction:", rsc.deploymentTransaction()?.hash);

  // ===== 3. Register RSC with Adapter =====
  console.log("\n🔗 Registering RSC with adapter...");
  const description = await rsc.getStrategyDescription();
  const regTx = await adapter.registerRSC(rscAddress, description);
  await regTx.wait();
  console.log("✅ RSC registered");
  console.log("   Transaction:", regTx.hash);

  // ===== Summary =====
  console.log("\n" + "=".repeat(60));
  console.log("🎉 DEPLOYMENT COMPLETE!");
  console.log("=".repeat(60));
  console.log("\n📋 DEPLOYED CONTRACT ADDRESSES:");
  console.log("ReactiveAlphaAdapter:", adapterAddress);
  console.log("YieldOptimizerRSC:   ", rscAddress);
  
  console.log("\n📋 NEXT STEPS:");
  console.log("1. Update Fuse addresses (if not set):");
  console.log("   RSC methods: updateFuses(aaveSupply, aaveBalance, compoundSupply, compoundBalance)");
  console.log("");
  console.log("2. Grant ALPHA_ROLE to RSC on vault:");
  console.log(`   accessManager.grantRole(200, "${rscAddress}")`);
  console.log("");
  console.log("3. Test the RSC:");
  console.log(`   const [aaveAPY, compoundAPY, spread] = await rsc.getStrategyState()`);
  console.log("");
  console.log("4. Monitor activity:");
  console.log(`   adapter.on("ReactionExecuted", ...)`);
  console.log("");
  console.log("⚠️  REMEMBER TO:");
  console.log("   - Save these addresses in your .env file");
  console.log("   - Verify contracts on Arbiscan");
  console.log("   - Set up monitoring and alerts");
  console.log("   - Test thoroughly before enabling full automation");
  console.log("=".repeat(60));
  
  // Save addresses to file
  const addresses = {
    adapter: adapterAddress,
    rsc: rscAddress,
    network: "arbitrum",
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
  };
  
  const fs = require('fs');
  fs.writeFileSync('deployment-addresses.json', JSON.stringify(addresses, null, 2));
  console.log("\n💾 Addresses saved to deployment-addresses.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  });

