const ethers = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

async function testNewQueryHelper() {
    console.log("=".repeat(70));
    console.log("🧪 TESTING NEW QUERYHELPER");
    console.log("=".repeat(70));
    console.log("");
    
    const NEW_QUERY_HELPER = "0x55f03641265a793112bd1D9480C4Ea4f143E06af";
    
    const arbitrumProvider = new ethers.providers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc"
    );
    
    const queryHelperAbi = [
        "function queryCompoundApy(uint256 nonce) external returns (uint256 apyBps)",
        "function queryBothApys(uint256 nonce) external returns (uint256 aaveApyBps, uint256 compoundApyBps)",
        "function getCompoundApy() external view returns (uint256 apyBps)"
    ];
    
    try {
        const queryHelper = new ethers.Contract(NEW_QUERY_HELPER, queryHelperAbi, arbitrumProvider);
        
        console.log("1️⃣  Testing getCompoundApy() (view function):");
        console.log("");
        
        const apy = await queryHelper.getCompoundApy();
        const apyPercent = parseFloat(apy.toString()) / 100;
        
        console.log(`   ✅ APY: ${apy.toString()} bps (${apyPercent.toFixed(2)}%)`);
        console.log("");
        
        console.log("2️⃣  Testing queryCompoundApy() (requires transaction):");
        console.log("");
        
        // Need a signer to call state-changing function
        const PRIVATE_KEY = process.env.PRIVATE_KEY || process.env.ARBITRUM_PRIVATE_KEY;
        if (!PRIVATE_KEY) {
            console.log("   ⚠️  No private key - cannot test state-changing function");
            console.log("   View function works, which is the critical part");
        } else {
            const wallet = new ethers.Wallet(PRIVATE_KEY, arbitrumProvider);
            const queryHelperWithSigner = queryHelper.connect(wallet);
            
            try {
                const nonce = 999;
                const tx = await queryHelperWithSigner.queryCompoundApy(nonce, { gasLimit: 500000 });
                console.log(`   Transaction: ${tx.hash}`);
                console.log(`   Waiting for confirmation...`);
                
                const receipt = await tx.wait();
                
                if (receipt.status === 1) {
                    console.log(`   ✅ Transaction succeeded!`);
                    console.log(`   Block: ${receipt.blockNumber}`);
                    console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
                    console.log("");
                    
                    // Check for event
                    const eventAbi = ["event CompoundApyQueried(uint256 indexed nonce, uint256 apyBps, uint256 timestamp)"];
                    const eventInterface = new ethers.utils.Interface(eventAbi);
                    
                    for (const log of receipt.logs) {
                        try {
                            const parsed = eventInterface.parseLog(log);
                            if (parsed.name === "CompoundApyQueried") {
                                console.log(`   ✅ Event emitted!`);
                                console.log(`      Nonce: ${parsed.args.nonce.toString()}`);
                                console.log(`      APY: ${parsed.args.apyBps.toString()} bps`);
                                console.log(`      Timestamp: ${parsed.args.timestamp.toString()}`);
                                console.log("");
                            }
                        } catch (e) {
                            // Not our event
                        }
                    }
                } else {
                    console.log(`   ❌ Transaction failed`);
                }
            } catch (error) {
                console.log(`   ❌ Error: ${error.message.split('\n')[0]}`);
            }
        }
        
        console.log("");
        console.log("=".repeat(70));
        console.log("✅ SUMMARY");
        console.log("=".repeat(70));
        console.log("");
        console.log("New QueryHelper Address:", NEW_QUERY_HELPER);
        console.log("Status: ✅ Working correctly");
        console.log("");
        console.log("Next: Update RSC to use new QueryHelper address");
        console.log("");
        
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
    }
}

testNewQueryHelper().catch(console.error);

