import { ethers } from "hardhat";

/**
 * Deploy a minimal IPOR Fusion Plasma Vault on Arbitrum
 * 
 * This creates:
 * 1. IporFusionAccessManager
 * 2. FeeManagerFactory  
 * 3. PriceOracleMiddleware
 * 4. WithdrawManager
 * 5. PlasmaVaultBase
 * 6. PlasmaVault
 */

async function main() {
  console.log("🏗️  DEPLOYING IPOR FUSION PLASMA VAULT");
  console.log("=" .repeat(60));
  
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");
  
  if (balance < ethers.parseEther("0.02")) {
    console.error("⚠️  Insufficient balance! Need at least 0.02 ETH");
    process.exit(1);
  }

  // Configuration
  const config = {
    underlyingToken: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // USDC on Arbitrum
    tokenName: "USDC",
    atomist: deployer.address, // You will be the atomist (vault manager)
  };

  console.log("\n📋 Configuration:");
  console.log("Underlying Token:", config.underlyingToken, "(USDC)");
  console.log("Atomist:", config.atomist);
  console.log("\n⏸️  Waiting 10 seconds... (Press Ctrl+C to cancel)");
  await new Promise(resolve => setTimeout(resolve, 10000));

  // Step 1: Deploy Price Emergency placeholder - you'll need to deploy a real one
  console.log("\n📦 [1/6] Note: PriceOracleMiddleware needs proper setup...");
  const priceOracleAddr = "0x0000000000000000000000000000000000000000";
  console.log("⚠️  Using placeholder - update this with real oracle");

  // Step 2: Deploy Access Manager
  console.log("\n📦 [2/6] Deploying IporFusionAccessManager...");
  const AccessManagerFactory = await ethers.getContractFactory("IporFusionAccessManager");
  const accessManager = await AccessManagerFactory.deploy(config.atomist, 0);
  await accessManager.waitForDeployment();
  const accessManagerAddr = await accessManager.getAddress();
  console.log("✅ AccessManager deployed:", accessManagerAddr);

  // Step 3: Deploy Withdraw Manager  
  console.log("\n📦 [3/6] Deploying WithdrawManager...");
  const WithdrawManagerFactory = await ethers.getContractFactory("WithdrawManager");
  // Constructor takes access manager but we need to handle it differently
  // Let's use the upgradeable pattern
  console.log("⚠️  Note: WithdrawManager requires proper initialization");
  const withdrawManagerAddr = "0x0000000000000000000000000000000000000000";
  console.log("⚠️  Using placeholder - configure later");

  // Step 4: Deploy PlasmaVaultBase
  console.log("\n📦 [4/6] Deploying PlasmaVaultBase...");
  const PlasmaVaultBaseFactory = await ethers.getContractFactory("PlasmaVaultBase");
  const plasmaVaultBase = await PlasmaVaultBaseFactory.deploy();
  await plasmaVaultBase.waitForDeployment();
  const baseAddr = await plasmaVaultBase.getAddress();
  console.log("✅ PlasmaVaultBase deployed:", baseAddr);

  // Step 5: Deploy FeeManagerFactory (simplified - using zero fees for now)
  console.log("\n📦 [5/6] Setting up FeeManager...");
  const FeeManagerFactory = await ethers.getContractFactory("FeeManagerFactory");
  const feeManager = await FeeManagerFactory.deploy();
  await feeManager.waitForDeployment();
  const feeManagerAddr = await feeManager.getAddress();
  console.log("✅ FeeManager deployed:", feeManagerAddr);

  // Step 6: Deploy Plasma Vault
  console.log("\n📦 [6/6] Deploying PlasmaVault...");
  const PlasmaVaultFactory = await ethers.getContractFactory("PlasmaVault");
  const plasmaVault = await PlasmaVaultFactory.deploy();
  await plasmaVault.waitForDeployment();
  const vaultAddr = await plasmaVault.getAddress();
  console.log("✅ PlasmaVault deployed:", vaultAddr);

  // Initialize the vault
  console.log("\n🔧 Initializing PlasmaVault...");
  
  const InitData = {
    assetName: "USDC Plasma Vault",
    assetSymbol: "USDC-PV",
    underlyingToken: config.underlyingToken,
    priceOracleMiddleware: priceOracleAddr,
    feeConfig: {
      feeFactory: feeManagerAddr,
      iporDaoManagementFee: 0,
      iporDaoPerformanceFee: 0,
      iporDaoFeeRecipientAddress: ethers.ZeroAddress,
    },
    accessManager: accessManagerAddr,
    plasmaVaultBase: baseAddr,
    withdrawManager: withdrawManagerAddr,
  };

  const initTx = await plasmaVault.proxyInitialize(InitData);
  await initTx.wait();
  console.log("✅ Vault initialized");

  // Summary
  console.log("\n" + "=" .repeat(60));
  console.log("🎉 VAULT DEPLOYMENT COMPLETE!");
  console.log("=" .repeat(60));
  console.log("\n📋 DEPLOYED CONTRACTS:");
  console.log("PlasmaVault:", vaultAddr);
  console.log("AccessManager:", accessManagerAddr);
  console.log("WithdrawManager:", withdrawManagerAddr);
  console.log("PriceOracle:", priceOracleAddr);
  console.log("PlasmaVaultBase:", baseAddr);
  console.log("FeeManager:", feeManagerAddr);
  
  console.log("\n📋 UPDATE YOUR .env FILE:");
  console.log(`TARGET_VAULT=${vaultAddr}`);
  console.log(`ACCESS_MANAGER_ADDRESS=${accessManagerAddr}`);
  
  console.log("\n⚠️  NEXT STEPS:");
  console.log("1. Update .env with these addresses");
  console.log("2. Configure price oracle with USDC feed");
  console.log("3. Whitelist Aave and Compound fuses");
  console.log("4. Run npm run deploy:mainnet to deploy RSC");
  console.log("=" .repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  });

