const { ethers } = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function checkAPYs() {
    const ARBITRUM_RPC = process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc";
    const provider = new ethers.providers.JsonRpcProvider(ARBITRUM_RPC);
    
    const AAVE_POOL = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
    const AAVE_DATA_PROVIDER = "0x69FA688f1Dc47d4B5d8029D5a35FB7a548310654";
    const COMPOUND_USDC = "0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA";
    const USDC_ADDRESS = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"; // Arbitrum USDC
    
    console.log("=".repeat(60));
    console.log("📊 CHECKING APYs FROM BOTH PROTOCOLS");
    console.log("=".repeat(60));
    console.log("");
    
    // Aave V3 APY
    console.log("1. AAVE V3 USDC SUPPLY APY");
    console.log("-".repeat(60));
    
    try {
        // Aave V3 Data Provider ABI for getting reserve data
        const AAVE_DATA_PROVIDER_ABI = [
            "function getReserveData(address asset) external view returns (uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint40)",
            "function getReserveTokensAddresses(address asset) external view returns (address,address,address)",
            "function getReserveConfigurationData(address asset) external view returns (uint256,uint256,uint256,uint256,uint256,uint256,bool,bool,bool,bool)"
        ];
        
        const dataProvider = new ethers.Contract(AAVE_DATA_PROVIDER, AAVE_DATA_PROVIDER_ABI, provider);
        
        // Get reserve data
        const reserveData = await dataProvider.getReserveData(USDC_ADDRESS);
        
        // Reserve data structure:
        // [0] configuration
        // [1] liquidityIndex
        // [2] currentLiquidityRate (THIS IS WHAT WE NEED!)
        // [3] variableBorrowIndex
        // [4] currentVariableBorrowRate
        // [5] currentStableBorrowRate
        // [6] lastUpdateTimestamp
        // [7] id
        // [8] aTokenAddress
        // [9] stableDebtTokenAddress
        // [10] variableDebtTokenAddress
        // [11] interestRateStrategyAddress
        
        const currentLiquidityRate = reserveData[2]; // This is the supply APY in ray (1e27)
        
        // Convert from ray to percentage
        // Aave uses RAY (1e27) for rates (rate per second)
        // For small rates: APY ≈ rate * secondsPerYear / 1e27 * 100
        // For accuracy: APY = ((1 + rate/1e27)^secondsPerYear - 1) * 100
        const SECONDS_PER_YEAR = 365 * 24 * 3600;
        const SECONDS_PER_YEAR_BIG = ethers.BigNumber.from(SECONDS_PER_YEAR);
        const RAY = ethers.BigNumber.from(10).pow(27);
        
        // Simple approximation (for display)
        const apyBpsSimple = currentLiquidityRate.mul(SECONDS_PER_YEAR_BIG).mul(100).div(RAY);
        const apyPercentSimple = parseFloat(apyBpsSimple.toString()) / 10000;
        
        // More accurate: compound interest formula
        // Convert ray to decimal: rateDecimal = liquidityRate / 1e27
        const rateDecimal = parseFloat(currentLiquidityRate.toString()) / 1e27;
        const apyPercentAccurate = ((Math.pow(1 + rateDecimal, SECONDS_PER_YEAR) - 1) * 100);
        
        console.log(`   Reserve: ${USDC_ADDRESS}`);
        console.log(`   Liquidity Rate (ray): ${currentLiquidityRate.toString()}`);
        console.log(`   Supply APY (approx): ${apyPercentSimple.toFixed(4)}%`);
        console.log(`   Supply APY (accurate): ${apyPercentAccurate.toFixed(4)}%`);
        console.log(`   Supply APY (bps): ${Math.round(apyPercentAccurate * 100)} basis points`);
        
        // Also show other rates for context
        const currentVariableBorrowRate = reserveData[4];
        const borrowRateDecimal = parseFloat(currentVariableBorrowRate.toString()) / 1e27;
        const borrowApyPercent = ((Math.pow(1 + borrowRateDecimal, SECONDS_PER_YEAR) - 1) * 100);
        console.log(`   Borrow APY: ${borrowApyPercent.toFixed(4)}%`);
        
    } catch (error) {
        console.log(`   ❌ Error fetching Aave APY: ${error.message}`);
        console.log(`   💡 Try checking if the data provider address is correct`);
    }
    console.log("");
    
    // Compound V3 APY
    console.log("2. COMPOUND V3 USDC SUPPLY APY");
    console.log("-".repeat(60));
    
    try {
        // Compound V3 Comet interface
        // Compound V3 uses a different model - need to calculate from utilization and rate model
        const COMPOUND_ABI = [
            "function getSupplyRate(uint256 utilization) public view returns (uint64)",
            "function getBorrowRate(uint256 utilization) public view returns (uint64)",
            "function totalSupply() public view returns (uint128)",
            "function totalBorrow() public view returns (uint128)",
            "function baseSupplyRate() external view returns (uint64)",
            "function supplyRatePerSecond() external view returns (uint256)",
            "function baseBorrowRate() external view returns (uint64)",
            "function borrowRatePerSecond() external view returns (uint256)"
        ];
        
        const compoundContract = new ethers.Contract(COMPOUND_USDC, COMPOUND_ABI, provider);
        
        try {
            // Method 1: Try supplyRatePerSecond
            const supplyRatePerSecond = await compoundContract.supplyRatePerSecond();
            const SECONDS_PER_YEAR_BIG = ethers.BigNumber.from(SECONDS_PER_YEAR);
            const RAY_BIG = ethers.BigNumber.from(10).pow(27);
            
            // Calculate APY: (ratePerSecond * secondsPerYear) / 1e27 * 100
            const apyRay = supplyRatePerSecond.mul(SECONDS_PER_YEAR_BIG);
            const apyBps = apyRay.mul(100).div(RAY_BIG);
            const apyPercent = parseFloat(apyBps.toString()) / 10000;
            
            console.log(`   Supply Rate Per Second: ${supplyRatePerSecond.toString()}`);
            console.log(`   Supply APY: ${apyPercent.toFixed(4)}%`);
            console.log(`   Supply APY (bps): ${apyBps.toString()} basis points`);
            
            // Get borrow rate too
            const borrowRatePerSecond = await compoundContract.borrowRatePerSecond();
            const borrowApyRay = borrowRatePerSecond.mul(SECONDS_PER_YEAR_BIG);
            const borrowApyBps = borrowApyRay.mul(100).div(RAY_BIG);
            const borrowApyPercent = parseFloat(borrowApyBps.toString()) / 10000;
            console.log(`   Borrow APY: ${borrowApyPercent.toFixed(4)}%`);
            
            // Get utilization
            try {
                const totalSupply = await compoundContract.totalSupply();
                const totalBorrow = await compoundContract.totalBorrow();
                const utilization = totalSupply.gt(0) 
                    ? totalBorrow.mul(10000).div(totalSupply).toString() 
                    : "0";
                const utilizationPercent = parseFloat(utilization) / 100;
                console.log(`   Utilization: ${utilizationPercent.toFixed(2)}%`);
            } catch (e) {
                // Ignore if not available
            }
            
        } catch (error) {
            // Method 2: Try getSupplyRate with utilization
            console.log(`   Trying alternative method...`);
            try {
                const SECONDS_PER_YEAR = 365 * 24 * 3600;
                const totalSupply = await compoundContract.totalSupply();
                const totalBorrow = await compoundContract.totalBorrow();
                
                if (totalSupply.gt(0)) {
                    const utilization = totalBorrow.mul(ethers.BigNumber.from(10).pow(18)).div(totalSupply);
                    const supplyRate = await compoundContract.getSupplyRate(utilization);
                    
                    // Compound uses 1e18 for rates (not 1e27 like Aave)
                    const WAD = ethers.BigNumber.from(10).pow(18);
                    const SECONDS_PER_YEAR_BIG = ethers.BigNumber.from(SECONDS_PER_YEAR);
                    const apyBps = supplyRate.mul(SECONDS_PER_YEAR_BIG).mul(100).div(WAD);
                    const apyPercent = parseFloat(apyBps.toString()) / 10000;
                    
                    console.log(`   Utilization: ${utilization.toString()}`);
                    console.log(`   Supply Rate: ${supplyRate.toString()}`);
                    console.log(`   Supply APY: ${apyPercent.toFixed(4)}%`);
                } else {
                    console.log(`   ❌ No supply in Compound V3 market`);
                }
            } catch (e) {
                console.log(`   ❌ Error with alternative method: ${e.message}`);
            }
        }
        
    } catch (error) {
        console.log(`   ❌ Error fetching Compound APY: ${error.message}`);
        console.log(`   💡 Compound V3 might use a different rate model`);
    }
    console.log("");
    
    // Comparison
    console.log("3. APY COMPARISON");
    console.log("-".repeat(60));
    console.log("");
    console.log("💡 To trigger a rebalance, the APY spread must exceed the threshold");
    console.log("   (typically 10-50 basis points depending on gas costs)");
    console.log("");
    console.log("📝 Note: These are current APYs fetched directly from the protocols.");
    console.log("   Events will trigger when these APYs change due to protocol activity.");
    console.log("");
    
    // Check recent events
    console.log("4. RECENT EVENT ACTIVITY");
    console.log("-".repeat(60));
    
    try {
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = currentBlock - 1000;
        
        // Check Aave events
        const RESERVE_DATA_UPDATED = "0x804c9b842b2748a22bb64b345453a3de7ca54a6ca45ce00d415894979e22897a";
        const aaveFilter = {
            address: AAVE_POOL,
            topics: [RESERVE_DATA_UPDATED],
            fromBlock: fromBlock,
            toBlock: currentBlock
        };
        
        const aaveEvents = await provider.getLogs(aaveFilter);
        console.log(`   Aave V3 ReserveDataUpdated events (last 1000 blocks): ${aaveEvents.length}`);
        
        // Check Compound events
        const ACCRUE_INTEREST = "0x717fee053884ab1935ba6d0140f6ed225371439611d9674ff445419d6a0fa1b7";
        const compoundFilter = {
            address: COMPOUND_USDC,
            topics: [ACCRUE_INTEREST],
            fromBlock: fromBlock,
            toBlock: currentBlock
        };
        
        const compoundEvents = await provider.getLogs(compoundFilter);
        console.log(`   Compound V3 AccrueInterest events (last 1000 blocks): ${compoundEvents.length}`);
        
        if (aaveEvents.length === 0 && compoundEvents.length === 0) {
            console.log("\n   ⚠️  No recent events found");
            console.log("   This explains why no events have been processed yet.");
            console.log("   Events will fire when there's protocol activity.");
        } else {
            console.log("\n   ✅ Events are being emitted!");
            console.log("   If subscriptions are active, these should trigger react() function");
        }
        
    } catch (error) {
        console.log(`   ❌ Error checking events: ${error.message}`);
    }
    console.log("");
}

checkAPYs().catch(console.error);

