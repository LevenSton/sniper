import { Connection, Keypair, PublicKey, sendAndConfirmTransaction, Transaction, VersionedTransaction } from '@solana/web3.js';
import {
  API_URLS,
  CREATE_CPMM_POOL_PROGRAM,
  parseTokenAccountResp,
} from '@raydium-io/raydium-sdk-v2'
import axios from 'axios';
import bs58 from 'bs58';
import dotenv from "dotenv";
import { NATIVE_MINT, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token';
dotenv.config();

interface SwapCompute {
  id: string
  success: true
  version: 'V0' | 'V1'
  openTime?: undefined
  msg: undefined
  data: {
    swapType: 'BaseIn' | 'BaseOut'
    inputMint: string
    inputAmount: string
    outputMint: string
    outputAmount: string
    otherAmountThreshold: string
    slippageBps: number
    priceImpactPct: number
    routePlan: {
      poolId: string
      inputMint: string
      outputMint: string
      feeMint: string
      feeRate: number
      feeAmount: string
    }[]
  }
}
class RaydiumLiquidityMonitor {
  private connection: Connection;
  private keypair: Keypair | null = null;

  constructor() {
    const privateKeyString = process.env.PRIVATE_KEY;
    if (!privateKeyString) {
      throw new Error('PRIVATE_KEY environment variable is not set');
    }
    this.keypair = Keypair.fromSecretKey(bs58.decode(privateKeyString));
    this.connection = new Connection(process.env.HTTPS_ENDPOINT!, {
      wsEndpoint: process.env.WSS_ENDPOINT!,
      commitment: 'confirmed',
      // 添加限流配置
      // httpHeaders: {
      //   'Cache-Control': 'no-cache',
      // },
      // // 添加重试配置
      // confirmTransactionInitialTimeout: 60000,
      // disableRetryOnRateLimit: false,
    });
  }

  async startMonitoring() {
    try {
      this.connection.onLogs(
        CREATE_CPMM_POOL_PROGRAM, 
        async (logs, context) => {
            try {
              // 检查是否是创建池子的交易
              if (!logs.logs.some(log => 
                  //log.includes('Program log: Instruction: Initialize') || 
                  log.includes('Program log: liquidity'))) {
                  return
              }
              console.log('signature:', logs.signature);
              // 获取交易详情
              const tx = await this.connection.getTransaction(logs.signature, {
                  commitment: 'confirmed',
                  maxSupportedTransactionVersion: 0
              })
              if (tx) {
                try {
                    console.log('staticAccountKeys:', JSON.stringify(tx?.transaction.message.staticAccountKeys))
                    const len = tx?.transaction.message.staticAccountKeys.length
                    if(len < 6) {
                        return
                    }
                    const tokenA = new PublicKey(tx?.transaction.message.staticAccountKeys[len - 1].toBase58()!);
                    console.log("Found base token:", tokenA.toBase58(), new Date().toISOString());
                    const tokenB = new PublicKey(tx?.transaction.message.staticAccountKeys[len - 5].toBase58()!);
                    console.log("Found quote token:", tokenB.toBase58(), new Date().toISOString());
                    if(!this.isIBoxToken(tokenA, tokenB)) {
                        return
                    }

                    // 买入代币
                    try {
                      console.log('开始买入代币...', tokenA.toBase58());
                      const txId = await this.swap(tokenA);
                      console.log('买入成功，交易签名:', txId);
                    } catch (error) {
                        console.error('买入失败:', error);
                    }
                } catch (error) {
                    console.error('获取Base Token信息失败:', error)
                }
              }
            } catch (error) {
                console.error('处理日志时出错:', error)
            }
        },
        "confirmed"
      );

      console.log('Started monitoring liquidity additions...');
    } catch (error) {
      console.error('Error starting monitoring:', error);
    }
  }

  private async swap(tokenA: PublicKey) : Promise<string | null> {
    if(!this.connection) throw new Error('Connection not initialized')
    if(!this.keypair) throw new Error('Keypair not initialized')

    const inputMint = NATIVE_MINT.toBase58()
    const outputMint = tokenA.toBase58()
    const amount = 10000
    const slippage = 0.5 // in percent, for this example, 0.5 means 0.5%
    const txVersion: string = 'V0' // or LEGACY
    const isV0Tx = txVersion === 'V0'
    console.log('start swap....')

    const [isInputSol, isOutputSol] = [inputMint === NATIVE_MINT.toBase58(), outputMint === NATIVE_MINT.toBase58()]
    console.log('isInputSol:', isInputSol, 'isOutputSol:', isOutputSol)
    const { tokenAccounts } = await this.fetchTokenAccountData()
    const inputTokenAcc = tokenAccounts.find((a) => a.mint.toBase58() === inputMint)?.publicKey
    const outputTokenAcc = tokenAccounts.find((a) => a.mint.toBase58() === outputMint)?.publicKey
    console.log('inputTokenAcc:', inputTokenAcc?.toBase58(), 'outputTokenAcc:', outputTokenAcc?.toBase58())
    if (!inputTokenAcc && !isInputSol) {
      console.error('do not have input token account')
      return null
    }
    console.log(`url: ${API_URLS.BASE_HOST}${API_URLS.PRIORITY_FEE}`)
    const { data } = await axios.get<{
      id: string
      success: boolean
      data: { default: { vh: number; h: number; m: number } }
    }>(`${API_URLS.BASE_HOST}${API_URLS.PRIORITY_FEE}`)
    console.log('data:', data)

    const { data: swapResponse } = await axios.get<SwapCompute>(
      `${
        API_URLS.SWAP_HOST
      }/compute/swap-base-in?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${
        slippage * 100
      }&txVersion=${txVersion}`
    )
    console.log('swapResponse:', swapResponse)
    if (!swapResponse.success && swapResponse.openTime) {
      const openTime = parseInt(swapResponse.openTime) * 1000; // 转换为毫秒
      const now = Date.now();
      if (openTime > now) {
        const delayMs = openTime - now;
        console.log(`池子将在 ${new Date(openTime).toLocaleString()} 开放，等待 ${Math.floor(delayMs/1000)} 秒...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        // 重新尝试交易
        return await this.swap(tokenA);
      }
    }

    const { data: swapTransactions } = await axios.post<{
      id: string
      version: string
      success: boolean
      data: { transaction: string }[]
    }>(`${API_URLS.SWAP_HOST}/transaction/swap-base-in`, {
      computeUnitPriceMicroLamports: String(data.data.default.h),
      swapResponse,
      txVersion,
      wallet: this.keypair!.publicKey.toBase58(),
      wrapSol: isInputSol,
      unwrapSol: isOutputSol, // true means output mint receive sol, false means output mint received wsol
      inputAccount: isInputSol ? undefined : inputTokenAcc?.toBase58(),
      outputAccount: isOutputSol ? undefined : outputTokenAcc?.toBase58(),
    })
    console.log('swapTransactions:', swapTransactions)
  
    const allTxBuf = swapTransactions.data.map((tx) => Buffer.from(tx.transaction, 'base64'))
    const allTransactions = allTxBuf.map((txBuf) =>
      isV0Tx ? VersionedTransaction.deserialize(txBuf) : Transaction.from(txBuf)
    )
  
    console.log(`total ${allTransactions.length} transactions`, swapTransactions)
  
    let idx = 0
    let txId = ''
    if (!isV0Tx) {
      for (const tx of allTransactions) {
        console.log(`${++idx} transaction sending...`)
        const transaction = tx as Transaction
        transaction.sign(this.keypair!)
        txId = await sendAndConfirmTransaction(this.connection, transaction, [this.keypair!], { skipPreflight: true })
        console.log(`${++idx} transaction confirmed, txId: ${txId}`)
      }
    } else {
      for (const tx of allTransactions) {
        idx++
        const transaction = tx as VersionedTransaction
        transaction.sign([this.keypair!])
        txId = await this.connection.sendTransaction(tx as VersionedTransaction, { skipPreflight: true })
        const { lastValidBlockHeight, blockhash } = await this.connection.getLatestBlockhash({
          commitment: 'confirmed',
        })
        console.log(`${idx} transaction sending..., txId: ${txId}`)
        await this.connection.confirmTransaction(
          {
            blockhash,
            lastValidBlockHeight,
            signature: txId,
          },
          'confirmed'
        )
        console.log(`${idx} transaction confirmed`)
      }
    }
    return txId
  }

  private fetchTokenAccountData = async () => {
    const solAccountResp = await this.connection.getAccountInfo(this.keypair!.publicKey)
    const tokenAccountResp = await this.connection.getTokenAccountsByOwner(this.keypair!.publicKey, { programId: TOKEN_PROGRAM_ID })
    const token2022Req = await this.connection.getTokenAccountsByOwner(this.keypair!.publicKey, { programId: TOKEN_2022_PROGRAM_ID })
    const tokenAccountData = parseTokenAccountResp({
      owner: this.keypair!.publicKey,
      solAccountResp,
      tokenAccountResp: {
        context: tokenAccountResp.context,
        value: [...tokenAccountResp.value, ...token2022Req.value],
      },
    })
    return tokenAccountData
  }

  private isIBoxToken(tokenAMint: PublicKey, tokenBMint: PublicKey): boolean {
    const mintAddress = tokenAMint.toBase58();
    return mintAddress.toLowerCase().endsWith('ibox') && NATIVE_MINT.equals(tokenBMint);
  }
}

async function main() {
  const monitor = new RaydiumLiquidityMonitor();
  await monitor.startMonitoring();

  // 添加优雅退出处理
  process.on('SIGINT', async () => {
    console.log('Stopping monitor...');
    process.exit(0);
  });
}

main().catch(console.error);