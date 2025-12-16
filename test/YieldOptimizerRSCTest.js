const { expect } = require("chai");
const { ethers } = require("hardhat");

/**
 * Comprehensive test suite for YieldOptimizerRSC
 * Tests the core logic without requiring actual vault deployment
 */

const MOCK_VAULT = "0x1234567890123456789012345678901234567890";
const AAVE_POOL = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
const COMPOUND_MARKET = "0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA";
const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";

describe("Yield Optimizer RSC - Core Logic Tests", function () {
  let adapter, rsc;
  let owner, addr1;

  beforeEach(async function () {
    [owner, addr1] = await ethers.getSigners();

    // Deploy ReactiveAlphaAdapter
    const AdapterFactory = await ethers.getContractFactory("ReactiveAlphaAdapter");
    adapter = await AdapterFactory.deploy(owner.address);

    // Deploy YieldOptimizerRSC with mock addresses
    const RSCFactory = await ethers.getContractFactory("YieldOptimizerRSC");
    rsc = await RSCFactory.deploy(
      MOCK_VAULT,
      await adapter.getAddress(),
      AAVE_POOL,
      COMPOUND_MARKET,
      50,
      ethers.ZeroAddress,
      ethers.ZeroAddress,
      ethers.ZeroAddress,
      ethers.ZeroAddress,
      "0x69FA688f1Dc47d4B5d8029D5a35FB7a548310654"
    );

    // Register RSC with adapter
    await adapter.registerRSC(await rsc.getAddress(), "USDC Yield Optimizer Test");
  });

  describe("Deployment", function () {
    it("Should deploy with correct parameters", async function () {
      expect(await rsc.TARGET_VAULT()).to.equal(MOCK_VAULT);
      expect(await rsc.ALPHA_ADAPTER()).to.equal(await adapter.getAddress());
      expect(await rsc.MIN_SPREAD_BPS()).to.equal(50);
      expect(await rsc.USDC()).to.equal(USDC);
    });

    it("Should be registered with adapter", async function () {
      const isRegistered = await adapter.isRSCRegistered(await rsc.getAddress());
      expect(isRegistered).to.be.true;
    });

    it("Should return correct strategy description", async function () {
      const description = await rsc.getStrategyDescription();
      expect(description).to.include("USDC");
      expect(description).to.include("Aave");
      expect(description).to.include("Compound");
    });

    it("Should monitor and execute on Arbitrum", async function () {
      const monitoringChain = await rsc.getMonitoringChainId();
      const targetChain = await rsc.getTargetChainId();
      expect(monitoringChain).to.equal(42161); // Arbitrum
      expect(targetChain).to.equal(42161); // Arbitrum
    });
  });

  describe("State Management", function () {
    it("Should allow owner to pause/unpause", async function () {
      expect(await rsc.paused()).to.be.false;
      
      await rsc.setPaused(true);
      expect(await rsc.paused()).to.be.true;
      
      await rsc.setPaused(false);
      expect(await rsc.paused()).to.be.false;
    });

    it("Should track last rebalance timestamp", async function () {
      expect(await rsc.lastRebalance()).to.equal(0);
    });

    it("Should enforce cooldown period", async function () {
      const cooldown = await rsc.COOLDOWN_SECONDS();
      expect(cooldown).to.equal(3600); // 1 hour
    });
  });

  describe("Strategy State", function () {
    it("Should return current strategy state", async function () {
      const [aaveAPY, compoundAPY, spread, lastRebalance] = await rsc.getStrategyState();
      
      expect(aaveAPY).to.equal(0);
      expect(compoundAPY).to.equal(0);
      expect(spread).to.equal(0);
      expect(lastRebalance).to.equal(0);
    });
  });

  describe("Configuration Validation", function () {
    it("Should have correct market IDs", async function () {
      const aaveMarketId = await rsc.AAVE_MARKET_ID();
      const compoundMarketId = await rsc.COMPOUND_MARKET_ID();
      
      expect(aaveMarketId).to.equal(1);
      expect(compoundMarketId).to.equal(2);
    });
  });

  describe("Adapter Integration", function () {
    it("Should allow adapter to track executions", async function () {
      const config = await adapter.getRSCConfig(await rsc.getAddress());
      expect(config.vault).to.equal(MOCK_VAULT);
      expect(config.isActive).to.be.true;
      expect(config.executionCount).to.equal(0);
    });

    it("Should allow manager to activate/deactivate RSC", async function () {
      await adapter.setRSCActive(await rsc.getAddress(), false);
      const config = await adapter.getRSCConfig(await rsc.getAddress());
      expect(config.isActive).to.be.false;

      await adapter.setRSCActive(await rsc.getAddress(), true);
      const config2 = await adapter.getRSCConfig(await rsc.getAddress());
      expect(config2.isActive).to.be.true;
    });
  });
});

describe("ReactiveAlphaAdapter Tests", function () {
  let adapter;
  let owner, addr1;

  beforeEach(async function () {
    [owner, addr1] = await ethers.getSigners();
    const AdapterFactory = await ethers.getContractFactory("ReactiveAlphaAdapter");
    adapter = await AdapterFactory.deploy(owner.address);
  });

  describe("RSC Registration", function () {
    it("Should register new RSC", async function () {
      // Deploy RSC for this test
      const RSCFactory = await ethers.getContractFactory("YieldOptimizerRSC");
      const testRSC = await RSCFactory.deploy(
        MOCK_VAULT,
        await adapter.getAddress(),
        AAVE_POOL,
        COMPOUND_MARKET,
        50,
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        "0x69FA688f1Dc47d4B5d8029D5a35FB7a548310654"
      );

      await adapter.registerRSC(await testRSC.getAddress(), "Test RSC");
      expect(await adapter.isRSCRegistered(await testRSC.getAddress())).to.be.true;
    });

    it("Should prevent duplicate registration", async function () {
      // Deploy RSC for this test
      const RSCFactory = await ethers.getContractFactory("YieldOptimizerRSC");
      const testRSC = await RSCFactory.deploy(
        MOCK_VAULT,
        await adapter.getAddress(),
        AAVE_POOL,
        COMPOUND_MARKET,
        50,
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        "0x69FA688f1Dc47d4B5d8029D5a35FB7a548310654"
      );

      await adapter.registerRSC(await testRSC.getAddress(), "Test RSC");
      await expect(
        adapter.registerRSC(await testRSC.getAddress(), "Test RSC Again")
      ).to.be.revertedWithCustomError(adapter, "RSCAlreadyRegistered");
    });

    it("Should only allow manager to register", async function () {
      // Deploy RSC for this test
      const RSCFactory = await ethers.getContractFactory("YieldOptimizerRSC");
      const testRSC = await RSCFactory.deploy(
        MOCK_VAULT,
        await adapter.getAddress(),
        AAVE_POOL,
        COMPOUND_MARKET,
        50,
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        "0x69FA688f1Dc47d4B5d8029D5a35FB7a548310654"
      );

      await expect(
        adapter.connect(addr1).registerRSC(await testRSC.getAddress(), "Unauthorized")
      ).to.be.reverted;
    });
  });

  describe("RSC Management", function () {
    let testRSC;

    beforeEach(async function () {
      // Deploy RSC for management tests
      const RSCFactory = await ethers.getContractFactory("YieldOptimizerRSC");
      testRSC = await RSCFactory.deploy(
        MOCK_VAULT,
        await adapter.getAddress(),
        AAVE_POOL,
        COMPOUND_MARKET,
        50,
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        ethers.ZeroAddress,
        "0x69FA688f1Dc47d4B5d8029D5a35FB7a548310654"
      );
      await adapter.registerRSC(await testRSC.getAddress(), "Test RSC");
    });

    it("Should unregister RSC", async function () {
      await adapter.unregisterRSC(await testRSC.getAddress());
      expect(await adapter.isRSCRegistered(await testRSC.getAddress())).to.be.false;
    });

    it("Should update RSC activity status", async function () {
      await adapter.setRSCActive(await testRSC.getAddress(), false);
      const config = await adapter.getRSCConfig(await testRSC.getAddress());
      expect(config.isActive).to.be.false;

      await adapter.setRSCActive(await testRSC.getAddress(), true);
      const config2 = await adapter.getRSCConfig(await testRSC.getAddress());
      expect(config2.isActive).to.be.true;
    });
  });
});
