import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import {
    CREATE_CPMM_POOL_PROGRAM,
} from '@raydium-io/raydium-sdk-v2'
import bs58 from 'bs58';
import dotenv from "dotenv";
dotenv.config();

const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112')

class RaydiumLiquidityMonitor {
  private connection: Connection;
  private wsConnection: WebSocket | null = null;
  private keypair: Keypair | null = null;

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
                    console.log("Found token:", tokenA.toString(), new Date().toISOString());
                    const tokenB = new PublicKey(tx?.transaction.message.staticAccountKeys[len - 5].toBase58()!);
                    console.log("Found token:", tokenB.toString(), new Date().toISOString());
                    if(!this.isIBoxToken(tokenA, tokenB)) {
                        return
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

  private isIBoxToken(tokenAMint: PublicKey, tokenBMint: PublicKey): boolean {
    const mintAddress = tokenAMint.toBase58();
    return mintAddress.toLowerCase().endsWith('ibox') && WSOL_MINT.equals(tokenBMint);
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