import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    TipLinkOptions,
    TipLinkResponse,
    BaseOptions,
  } from './das.types';
import { TipLink } from '@tiplink/api';
import {
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  PublicKey,
  ComputeBudgetProgram,
  Connection,
  Keypair,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  getMint,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';

@Injectable()
export class DasService {
    private readonly heliusMainnetUrl: string;
    private readonly heliusDevnetUrl: string;
    private readonly NETWORK_URLS = {
      mainnet: '',
      devnet: '',
    };
    private readonly MINIMUM_SOL_BALANCE = 0.003 * LAMPORTS_PER_SOL;
    constructor(
        private configService: ConfigService,
      ) {
        const heliusKey = this.configService.get<string>('HELIUS_API_KEY');
    
        if (!heliusKey) {
          throw new Error('HELIUS_API_KEY is not defined in environment variables');
        }
    
        this.heliusMainnetUrl = `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`;
        this.heliusDevnetUrl = `https://devnet.helius-rpc.com/?api-key=${heliusKey}`;
        this.NETWORK_URLS.mainnet = this.heliusMainnetUrl;
        this.NETWORK_URLS.devnet = this.heliusDevnetUrl;
      }

    private async detectNetwork(
        walletKeypair: Keypair,
      ): Promise<'mainnet' | 'devnet'> {
        try {
          // Try mainnet first
          const mainnetConnection = new Connection(this.heliusMainnetUrl);
          const balance = await mainnetConnection.getBalance(
            walletKeypair.publicKey,
          );
          if (balance > 0) {
            return 'mainnet';
          }
    
          // Try devnet
          const devnetConnection = new Connection(this.heliusDevnetUrl);
          const devBalance = await devnetConnection.getBalance(
            walletKeypair.publicKey,
          );
          if (devBalance > 0) {
            return 'devnet';
          }
    
          // Default to devnet if no balance found on either
          return 'devnet';
        } catch {
          // Default to mainnet if detection fails
          return 'mainnet';
        }
      }
    
      private async getRpcUrl(
        walletKeypair: Keypair,
        preferredNetwork?: 'mainnet' | 'devnet',
      ): Promise<string> {
        // If network preference is specified, use it
        if (preferredNetwork) {
          return this.NETWORK_URLS[preferredNetwork];
        }
    
        // Otherwise detect the network
        const detectedNetwork = await this.detectNetwork(walletKeypair);
        return this.NETWORK_URLS[detectedNetwork];
      }
    
    
      // Helper for creating connections
      private async createConnection(
        walletKeypair: Keypair,
        options?: BaseOptions,
      ): Promise<Connection> {
        const rpcUrl = await this.getRpcUrl(walletKeypair, options?.network);
        return new Connection(rpcUrl, 'confirmed');
      }

    async createTipLink(
        walletAddress: PublicKey,
        walletKeypair: Keypair,
        options: TipLinkOptions,
      ): Promise<TipLinkResponse> {
        try {
          // Use the new createConnection helper
          const connection = await this.createConnection(walletKeypair, options);
          const tiplink = await TipLink.create();
    
          if (!options.splMintAddress) {
            // Handle SOL transfer
            const transaction = new Transaction();
            transaction.add(
              SystemProgram.transfer({
                fromPubkey: walletAddress,
                toPubkey: tiplink.keypair.publicKey,
                lamports: options.amount * LAMPORTS_PER_SOL,
              }),
            );
    
            const signature = await sendAndConfirmTransaction(
              connection,
              transaction,
              [walletKeypair],
              { commitment: 'confirmed' },
            );
    
            return {
              url: tiplink.url.toString(),
              signature,
            };
          } else {
            // Handle SPL token transfer
            const mintPubkey = new PublicKey(options.splMintAddress);
            const fromAta = await getAssociatedTokenAddress(
              mintPubkey,
              walletAddress,
            );
            const toAta = await getAssociatedTokenAddress(
              mintPubkey,
              tiplink.keypair.publicKey,
            );
    
            const mintInfo = await getMint(connection, mintPubkey);
            const adjustedAmount = options.amount * Math.pow(10, mintInfo.decimals);
    
            const transaction = new Transaction();
    
            // Add compute budget instruction
            transaction.add(
              ComputeBudgetProgram.setComputeUnitPrice({
                microLamports: 5000,
              }),
            );
    
            // Transfer minimum SOL for rent
            transaction.add(
              SystemProgram.transfer({
                fromPubkey: walletAddress,
                toPubkey: tiplink.keypair.publicKey,
                lamports: this.MINIMUM_SOL_BALANCE,
              }),
            );
    
            // Create ATA for recipient if needed
            transaction.add(
              createAssociatedTokenAccountInstruction(
                walletAddress,
                toAta,
                tiplink.keypair.publicKey,
                mintPubkey,
              ),
            );
    
            // Transfer tokens
            transaction.add(
              createTransferInstruction(
                fromAta,
                toAta,
                walletAddress,
                adjustedAmount,
              ),
            );
    
            const signature = await sendAndConfirmTransaction(
              connection,
              transaction,
              [walletKeypair],
              { commitment: 'confirmed' },
            );
    
            return {
              url: tiplink.url.toString(),
              signature,
            };
          }
        } catch (error) {
          console.error('TipLink Creation Error Details:', {
            error,
            message: error.message,
            stack: error.stack,
            walletAddress: walletAddress.toString(),
            amount: options.amount,
            splMintAddress: options.splMintAddress || 'none',
            network: options.network || 'auto-detect',
          });
    
          throw new HttpException(
            `Failed to create TipLink: ${error instanceof Error ? error.message : 'Unknown error'}`,
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }
      }
}
