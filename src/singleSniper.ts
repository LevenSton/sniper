import * as web3 from "@solana/web3.js";
import bs58 from 'bs58';
import dotenv from "dotenv";
import buyToken from "../utils/buyToken";
import promptUserBuy from "../utils/promptUserBuy";
import { Keypair } from "@solana/web3.js";
dotenv.config();

async function main() {
  try {
    console.log("Starting the program");

    //Load keypair
    const keypair = Keypair.fromSecretKey(bs58.decode(process.env.PRIVATE_KEY!));
    if (!keypair) {
      throw new Error("Missing secret key. Fill it in .env file");
    }
    // const keypair = getKeypairFromEnvironment("SECRET_KEY");
    // if (!keypair) {
    //   throw new Error("Missing secret key. Fill it in .env file");
    // }

    // Load RPC
    const rpc = process.env.HTTPS_ENDPOINT;
    if (!rpc) {
      throw new Error("Missing RPC. Fill it in .env file");
    }

    // Connect to network
    const connection = new web3.Connection(rpc!, "confirmed");
    if (!connection) {
      throw new Error("Failed to connect to network");
    }
    console.log("Connected to the network");

    const { tokenAddress, solAmount, slippage, priorityFee } = await promptUserBuy();
    const sig = await buyToken(tokenAddress, connection, keypair, solAmount, slippage, priorityFee);
    console.log("Signature:", sig);
  } catch (error) {
    console.error(error.message);
    console.error(error);
  }
  console.log("Program finished");
}

main();
