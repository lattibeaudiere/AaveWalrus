import { ethers } from "hardhat";
import fs from "fs";

/**
 * Check the status of deployed contracts
 */

async function main() {
  // Load deployment addresses
  const addresses = JSON.parse(fs.readFileSync("deployment-addresses.json", "utf8"));
  
  console.log("📊 CONTRACT STATUS CHECK");
  console.log("=" .repeat(60));
  
  // Get adapter contract
  const adapter = await ethers.getContractAt(
    "ReactiveAlphaAdapter",
    addresses.adapter
  );
  
  // Get RSC contract
  const rsc = await ethers.getContractAt(
    "YieldOptimizerRSC",
    addresses.rsc
  );
  
  console.log("\n📋 Contract Addresses:");
  console.log("Adapter:", addresses.adapter);
  console.log("RSC:", addresses.rsc);
  
  // Check RSC configuration
  console.log("\n📋 RSC Configuration:");
  console.log("Target Vault:", await rsc.TARGET_VAULT());
  console.log("Alpha Adapter:", await rsc.ALPHA_ADAPTER());
  console.log("Min Spread:", await rsc.MIN_SPREAD_BPS(), "bps");
  console.log("Paused:", await rsc.paused());
  
  // Get strategy state
  console.log("\n📊 Strategy State:");
  const [aaveAPY, compoundAPY, spread, lastRebalance] = await rsc.getStrategyState();
  console.log("Aave APY:", aaveAPY.toString(), "bps");
  console.log("Compound APY:", compoundAPY.toString(), "bps");
  console.log("Current Spread:", spread.toString(), "bps");
  
  if (lastRebalance > 0) {
    const lastRebalanceDate = new Date(Number(lastRebalance) * 1000);
    console.log("Last Rebalance:", lastRebalanceDate.toISOString());
  } else {
    console.log("Last Rebalance: Never");
  }
  
  // Check adapter metrics
  console.log("\n📊 Adapter Metrics:");
  const config = await adapter.getRSCConfig(addresses.rsc);
  console.log("Is Active:", config.isActive);
  console.log("Execution Count:", config.executionCount.toString());
  
  if (config.lastExecution > 0) {
    const lastExecutionDate = new Date(Number(config.lastExecution) * 1000);
    console.log("Last Execution:", lastExecutionDate.toISOString());
  } else {
    console.log("Last Execution: Never");
  }
  
  // Check balances
  const [adapterSigner] = await ethers.getSigners();
  console.log("\n💰 Balances:");
  console.log("Signer balance:", ethers.formatEther(await ethers.provider.getBalance(adapterSigner.address)), "ETH");
  console.log("Adapter balance:", ethers.formatEther(await ethers.provider.getBalance(addresses.adapter)), "ETH");
  console.log("RSC balance:", ethers.formatEther(await ethers.provider.getBalance(addresses.rsc)), "ETH");
  
  console.log("\n" + "=" .repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });

