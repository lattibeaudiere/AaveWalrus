const { ethers } = require("hardhat");

/**
 * Deployment script for IPOR Fusion + RSC integration
 * 
 * This script deploys:
 * 1. ReactiveAlphaAdapter - The adapter contract
 * 2. YieldOptimizerRSC - Example RSC implementation
 * 
 * Prerequisites:
 * - IPOR Fusion Plasma Vault already deployed on target network
 * - Aave V3 and Compound V3 fuses whitelisted on vault
 * - Wallet with sufficient balance for deployment
 */

async function main() {
  console.log("🚀 Starting deployment of IPOR Fusion + RSC integration...\n");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying with account:", deployer.address);
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "ETH\n");

  // ===== Configuration =====
  // TODO: Update these addresses for your deployment
  
  // IPOR Fusion addresses on Arbitrum
  const TARGET_VAULT = "0x0000000000000000000000000000000000000000"; // Plasma Vault address
  const AAVE_SUPPLY_FUSE = "0x0000000000000000000000000000000000000000";
  const AAVE_BALANCE_FUSE = "0x0000000000000000000000000000000000000000";
  const COMPOUND_SUPPLY_FUSE = "0x0000000000000000000000000000000000000000";
  const COMPOUND_BALANCE_FUSE = "0x0000000000000000000000000000000000000000";
  
  // Protocol addresses on Arbitrum
  const AAVE_POOL = "0x794a61358D6845594F94dc1DB02A252b5b4814aD"; // Aave V3 Pool
  const COMPOUND_MARKET = "0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA"; // Compound V3 USDC market
  const AAVE_DATA_PROVIDER = "0x69FA688f1Dc47d4B5d8029D5a35FB7a548310654"; // Aave V3 Data Provider
  
  // Strategy parameters
  const MIN_SPREAD_BPS = 50; // 0.5% minimum spread to trigger rebalance
  
  // Manager address for the adapter (can be deployer or a multisig)
  const MANAGER_ADDRESS = deployer.address;

  // ===== 1. Deploy ReactiveAlphaAdapter =====
  console.log("📦 Deploying ReactiveAlphaAdapter...");
  const ReactiveAlphaAdapterFactory = await ethers.getContractFactory("ReactiveAlphaAdapter");
  const adapter = await ReactiveAlphaAdapterFactory.deploy(MANAGER_ADDRESS);
  await adapter.waitForDeployment();
  const adapterAddress = await adapter.getAddress();
  console.log("✅ ReactiveAlphaAdapter deployed at:", adapterAddress);
  console.log("   Manager:", MANAGER_ADDRESS, "\n");

  // ===== 2. Deploy YieldOptimizerRSC =====
  console.log("📦 Deploying YieldOptimizerRSC...");
  const YieldOptimizerRSCFactory = await ethers.getContractFactory("YieldOptimizerRSC");
  const rsc = await YieldOptimizerRSCFactory.deploy(
    TARGET_VAULT,
    adapterAddress,
    AAVE_POOL,
    COMPOUND_MARKET,
    MIN_SPREAD_BPS,
    AAVE_SUPPLY_FUSE,
    AAVE_BALANCE_FUSE,
    COMPOUND_SUPPLY_FUSE,
    COMPOUND_BALANCE_FUSE,
    AAVE_DATA_PROVIDER
  );
  await rsc.waitForDeployment();
  const rscAddress = await rsc.getAddress();
  console.log("✅ YieldOptimizerRSC deployed at:", rscAddress);
  console.log("   Strategy:", await rsc.getStrategyDescription());
  console.log("   Min Spread:", MIN_SPREAD_BPS, "bps (", MIN_SPREAD_BPS / 100, "%)");
  console.log("   Monitoring Chain:", await rsc.getMonitoringChainId());
  console.log("   Target Chain:", await rsc.getTargetChainId(), "\n");

  // ===== 3. Register RSC with Adapter =====
  console.log("🔗 Registering RSC with adapter...");
  const description = await rsc.getStrategyDescription();
  const tx = await adapter.registerRSC(rscAddress, description);
  await tx.wait();
  console.log("✅ RSC registered successfully\n");

  // ===== Summary =====
  console.log("=" .repeat(60));
  console.log("🎉 Deployment Complete!");
  console.log("=" .repeat(60));
  console.log("\nContract Addresses:");
  console.log("ReactiveAlphaAdapter:", adapterAddress);
  console.log("YieldOptimizerRSC:   ", rscAddress);
  
  console.log("\n📋 Next Steps:");
  console.log("1. Grant ALPHA_ROLE to RSC on the Plasma Vault:");
  console.log("   accessManager.grantRole(200,", rscAddress, ")");
  console.log("2. Register RSC with Reactive Network for event monitoring");
  console.log("3. Fund the Plasma Vault with USDC");
  console.log("4. Monitor via getStrategyState() on RSC contract");
  console.log("\n⚠️  Remember to configure real fuse addresses before deploying!");
  console.log("=" .repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });

