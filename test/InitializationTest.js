const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Initialization System Tests", function () {
    let queryHelper;
    let rsc;
    let owner;
    let aavePool;
    let compoundComet;
    
    const USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
    const AAVE_POOL = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
    const COMPOUND_USDC = "0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA";
    
    beforeEach(async function () {
        [owner] = await ethers.getSigners();
        
        // Deploy QueryHelper
        const QueryHelper = await ethers.getContractFactory("QueryHelper");
        queryHelper = await QueryHelper.deploy();
        await queryHelper.deployed();
        
        // Note: RSC deployment is complex (requires Reactive Network)
        // We'll test QueryHelper functionality here
        // Full RSC testing would require fork testing or Reactive Network setup
    });
    
    describe("QueryHelper.queryBothApys()", function () {
        it("Should query both Aave and Compound APYs", async function () {
            // Get Aave interface for testing
            const aavePoolContract = await ethers.getContractAt(
                [
                    "function getReserveData(address asset) external view returns (tuple(uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256))"
                ],
                AAVE_POOL
            );
            
            // Get Compound interface
            const compoundContract = await ethers.getContractAt(
                ["function supplyRatePerSecond() external view returns (uint256)"],
                COMPOUND_USDC
            );
            
            // Test queryBothApys
            const nonce = ethers.BigNumber.from("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"); // type(uint256).max
            const tx = await queryHelper.queryBothApys(nonce);
            const receipt = await tx.wait();
            
            // Check event was emitted
            const event = receipt.events?.find(e => e.event === "BothApysQueried");
            expect(event).to.not.be.undefined;
            
            // Verify APYs are reasonable (between 0 and 10000 bps = 0-100%)
            const aaveApy = event.args.aaveApyBps;
            const compoundApy = event.args.compoundApyBps;
            
            expect(aaveApy).to.be.gte(0);
            expect(aaveApy).to.be.lte(10000); // 100% max
            expect(compoundApy).to.be.gte(0);
            expect(compoundApy).to.be.lte(10000);
            
            console.log(`Aave APY: ${aaveApy.toString()} bps (${(aaveApy.toNumber() / 100).toFixed(2)}%)`);
            console.log(`Compound APY: ${compoundApy.toString()} bps (${(compoundApy.toNumber() / 100).toFixed(2)}%)`);
        });
        
        it("Should return correct values matching individual queries", async function () {
            // Query individually
            const compoundApyIndividual = await queryHelper.getCompoundApy();
            
            // Query both
            const nonce = ethers.BigNumber.from("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
            const tx = await queryHelper.queryBothApys(nonce);
            const receipt = await tx.wait();
            
            const event = receipt.events?.find(e => e.event === "BothApysQueried");
            const compoundApyBoth = event.args.compoundApyBps;
            
            // Compound APY should match
            expect(compoundApyBoth.toString()).to.equal(compoundApyIndividual.toString());
        });
    });
    
    describe("Event Signatures", function () {
        it("Should have correct BothApysQueried event topic", async function () {
            // Calculate expected topic
            const eventSignature = "BothApysQueried(uint256,uint256,uint256,uint256)";
            const expectedTopic = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(eventSignature));
            
            // Get event from contract
            const filter = queryHelper.filters.BothApysQueried();
            const actualTopic = filter.topics[0];
            
            expect(actualTopic.toLowerCase()).to.equal(expectedTopic.toLowerCase());
        });
    });
});

