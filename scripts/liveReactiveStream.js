const { ethers } = require("ethers");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

class LiveReactiveStream {
  constructor() {
    this.REACTIVE_RPC = process.env.REACTIVE_RPC || "https://mainnet-rpc.rnk.dev";
    this.RSC_ADDRESS = process.env.RSC_ADDRESS;
    if (!this.RSC_ADDRESS) {
      throw new Error("RSC_ADDRESS must be defined (env or .env)");
    }

    this.provider = new ethers.providers.JsonRpcProvider(this.REACTIVE_RPC);
    this.REACT_HANDLED_TOPIC = ethers.utils.id("ReactHandled(uint256,address,uint256,uint256)");
    this.CALLBACK_TOPIC = ethers.utils.id("Callback(uint256,address,uint64,bytes)");
    this.iface = new ethers.utils.Interface([
      "event ReactHandled(uint256 chainId,address emitter,uint256 txHash,uint256 logIndex)",
      "event Callback(uint256 indexed chain_id,address indexed _contract,uint64 indexed gas_limit,bytes payload)"
    ]);

    this.lastBlockChecked = null;
    this.reactCount = 0;
    this.callbackCount = 0;
  }

  async start() {
    console.log("=".repeat(70));
    console.log(" LIVE REACTIVE EVENT STREAM");
    console.log("=".repeat(70));
    console.log(`Monitoring RSC: ${this.RSC_ADDRESS}`);
    console.log(`Provider: ${this.REACTIVE_RPC}`);
    console.log(`Started: ${new Date().toISOString()}`);
    console.log("Press Ctrl+C to stop");
    console.log("-".repeat(70));

    await this.poll();
    setInterval(() => this.poll().catch((err) => console.error("Poll error:", err.message)), 5000);
  }

  async poll() {
    const latest = await this.provider.getBlockNumber();
    if (this.lastBlockChecked === null) {
      this.lastBlockChecked = latest - 20;
    }
    const fromBlock = Math.max(0, this.lastBlockChecked + 1);
    const toBlock = latest;
    if (toBlock < fromBlock) {
      return;
    }

    const topics = [[this.REACT_HANDLED_TOPIC, this.CALLBACK_TOPIC]];
    const logs = await this.provider.getLogs({ address: this.RSC_ADDRESS, topics, fromBlock, toBlock });
    logs.forEach((log) => this.handleLog(log));
    this.lastBlockChecked = toBlock;
  }

  handleLog(log) {
    const topic0 = log.topics[0];
    const timestamp = new Date().toISOString();

    if (topic0 === this.REACT_HANDLED_TOPIC) {
      const decoded = this.iface.decodeEventLog("ReactHandled", log.data, log.topics);
      this.reactCount += 1;
      console.log(`\n[${timestamp}]  ReactHandled #${this.reactCount}`);
      console.log(`  Block: ${log.blockNumber}`);
      console.log(`  Tx:    ${log.transactionHash}`);
      console.log(`  Chain: ${decoded.chainId.toString()}`);
      console.log(`  Source: ${decoded.emitter}`);
      console.log(`  Origin tx hash: ${decoded.txHash.toString()}`);
      console.log(`  Log index: ${decoded.logIndex.toString()}`);
    } else if (topic0 === this.CALLBACK_TOPIC) {
      const decoded = this.iface.decodeEventLog("Callback", log.data, log.topics);
      this.callbackCount += 1;
      console.log(`\n[${timestamp}]  Callback #${this.callbackCount}`);
      console.log(`  Block: ${log.blockNumber}`);
      console.log(`  Tx:    ${log.transactionHash}`);
      console.log(`  Target chain: ${decoded.chain_id.toString()}`);
      console.log(`  Target contract: ${decoded._contract}`);
      console.log(`  Gas limit: ${decoded.gas_limit.toString()}`);
      const preview = decoded.payload.slice(0, 66);
      console.log(`  Payload: ${preview}${decoded.payload.length > 66 ? "" : ""}`);
    }
  }
}

process.on("SIGINT", () => {
  console.log("\n Live stream stopped");
  process.exit(0);
});

new LiveReactiveStream().start().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
