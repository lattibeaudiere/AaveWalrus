import { ethers } from "hardhat";
import fs from "fs";

/**
 * Grant ALPHA_ROLE to the RSC on the IPOR Fusion vault
 * 
 * This requires ATOMIST_ROLE on the vault's access manager
 */

async function main() {
  // Load deployment addresses
  const addresses = JSON.parse(fs.readFileSync("deployment-addresses.json", "utf8"));
  
  console.log("🔐 Granting ALPHA_ROLE to RSC...");
  console.log("=" .repeat(60));
  
  UP address; RSC Address:", addresses.rsc);
  console.log("Target Vault:", process.env.TARGET_VAULT);
  
  // Read vault's access manager address
  // Note: This is a placeholder - actual vault implementation varies
  // You need to get the access manager address from your vault deployment
  
  const accessManagerAddress = process.env.ACCESS_MANAGER_ADDRESS;
  
  if (!accessManagerAddress) {
    console.error("❌ ACCESS_MANAGER_ADDRESS must be set!");
    console.log("Get it from your IPOR Fusion vault deployment");
    process.exit(1);
  }
  
  console.log("Access Manager:", accessManagerAddress);
  
  // Get signer
  const [signer] = await ethers.getSigners();
  console.log("Using account:", signer.address);
  
  // ALPHA_ROLE constant from IPOR Fusion
  const ALPHA_ROLE = 200n;
  
  // Call grantRole on access manager
  console.log("\n⏸️  Waiting 5 seconds before granting role...");
  console.log("   Press Ctrl+C to cancel");
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  const accessManager = await ethers.getContractAt(
    [
      "function grantRole(uint64 role, address account, uint32 delay) external"
    ],
    accessManagerAddress,
    signer
  );
  
  console.log("\n📝 Granting ALPHA_ROLE to RSC...");
  const tx = await accessManager.grantRole(ALPHA_ROLE, addresses.rsc, 0); // No delay
  await tx.wait();
  
  console.log("✅ ALPHA_ROLE granted!");
  console.log("Transaction:", tx.hash);
  
  // Verify
  const hasRole = await accessManager.hasRole(ALPHA_ROLE, addresses.rsc);
  if (hasRole) {
    console.log("✅ Verified: RSC now has ALPHA_ROLE");
  } else {
    console.log("⚠️  Warning: Role not detected (may need confirmation incubation)");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Failed:", error);
    process.exit(1);
  });

