import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import {
  ApiV3PoolInfoStandardItemCpmm,
  CpmmKeys,
  CpmmRpcData,
  CREATE_CPMM_POOL_PROGRAM, CurveCalculator, Raydium
} from '@raydium-io/raydium-sdk-v2'
import BN from 'bn.js'
import bs58 from 'bs58';
import dotenv from "dotenv";
import { NATIVE_MINT } from '@solana/spl-token';
import { isValidCpmm } from '../utils/config';
dotenv.config();

class RaydiumLiquidityMonitor {
  private connection: Connection;
  private wsConnection: WebSocket | null = null;
  private keypair: Keypair | null = null;
  private raydium: Raydium | null = null;

  constructor() {
    this.keypair = Keypair.fromSecretKey(bs58.decode(process.env.PRIVATE_KEY!));
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

  private async initRaydium() {
    if (!this.raydium) {
      this.raydium = await Raydium.load({
        owner: this.keypair!,
        connection: this.connection,
        cluster: 'mainnet',
        disableFeatureCheck: true,
        disableLoadToken: false,
        blockhashCommitment: 'confirmed',
      });
    }
    return this.raydium;
  }

  async startMonitoring() {
    try {
      await this.initRaydium();

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
                    const poolId = new PublicKey(tx?.transaction.message.staticAccountKeys[2].toBase58()!);
                    console.log("Found pool:", poolId.toString(), new Date().toISOString());
                    const tokenA = new PublicKey(tx?.transaction.message.staticAccountKeys[len - 1].toBase58()!);
                    console.log("Found token:", tokenA.toString(), new Date().toISOString());
                    const tokenB = new PublicKey(tx?.transaction.message.staticAccountKeys[len - 5].toBase58()!);
                    console.log("Found token:", tokenB.toString(), new Date().toISOString());
                    if(!this.isIBoxToken(tokenA, tokenB)) {
                        return
                    }

                    // 买入代币
                    try {
                      console.log('开始买入代币...');
                      const signature = await this.buyToken(poolId, 0.5, 50);
                      console.log('买入成功，交易签名:', signature);
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

  private async buyToken(poolId: PublicKey, amountIn: number, slippage: number) {
    if(!this.raydium) throw new Error('Raydium not initialized')
    if(!this.connection) throw new Error('Connection not initialized')
    if(!this.keypair) throw new Error('Keypair not initialized')

    const inputAmount = new BN(100)
    const inputMint = NATIVE_MINT.toBase58()
    let poolInfo: ApiV3PoolInfoStandardItemCpmm
    let poolKeys: CpmmKeys | undefined
    let rpcData: CpmmRpcData | undefined
    const data = await this.raydium.api.fetchPoolById({ ids: poolId.toBase58() })
    poolInfo = data[0] as ApiV3PoolInfoStandardItemCpmm
    if (!isValidCpmm(poolInfo.programId)) throw new Error('target pool is not CPMM pool')
    rpcData = await this.raydium.cpmm.getRpcPoolInfo(poolInfo.id, true)

    if (inputMint !== poolInfo.mintA.address && inputMint !== poolInfo.mintB.address)
      throw new Error('input mint does not match pool')
    
    const baseIn = inputMint === poolInfo.mintA.address
    // swap pool mintA for mintB
    const swapResult = CurveCalculator.swap(
      inputAmount,
      baseIn ? rpcData.baseReserve : rpcData.quoteReserve,
      baseIn ? rpcData.quoteReserve : rpcData.baseReserve,
      rpcData.configInfo!.tradeFeeRate
    )

    /**
     * swapResult.sourceAmountSwapped -> input amount
     * swapResult.destinationAmountSwapped -> output amount
     * swapResult.tradeFee -> this swap fee, charge input mint
     */
    const { execute } = await this.raydium.cpmm.swap({
      poolInfo,
      poolKeys,
      inputAmount,
      swapResult,
      slippage: 0.5, // range: 1 ~ 0.0001, means 100% ~ 0.01%
      baseIn,
      // optional: set up priority fee here
      // computeBudgetConfig: {
      //   units: 600000,
      //   microLamports: 4659150,
      // },

      // optional: add transfer sol to tip account instruction. e.g sent tip to jito
      // txTipConfig: {
      //   address: new PublicKey('96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5'),
      //   amount: new BN(10000000), // 0.01 sol
      // },
    })

    // don't want to wait confirm, set sendAndConfirm to false or don't pass any params to execute
    const { txId } = await execute({ sendAndConfirm: true })
    console.log(`swapped: ${poolInfo.mintA.symbol} to ${poolInfo.mintB.symbol}:`, {
      txId: `https://explorer.solana.com/tx/${txId}`,
    })
    // process.exit() // if you don't want to end up node execution, comment this line
  }

  private isIBoxToken(tokenAMint: PublicKey, tokenBMint: PublicKey): boolean {
    const mintAddress = tokenAMint.toBase58();
    return mintAddress.toLowerCase().endsWith('ibox') && NATIVE_MINT.equals(tokenBMint);
  }

  async stop() {
    // 清理资源
    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = null;
    }
  }
}

async function main() {
  const monitor = new RaydiumLiquidityMonitor();
  await monitor.startMonitoring();

  // 添加优雅退出处理
  process.on('SIGINT', async () => {
    console.log('Stopping monitor...');
    await monitor.stop();
    process.exit(0);
  });
}

main().catch(console.error);