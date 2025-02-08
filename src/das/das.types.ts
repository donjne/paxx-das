export interface BaseOptions {
    network?: 'mainnet' | 'devnet';
  }
  
export interface TipLinkOptions extends BaseOptions {
    amount: number;
    splMintAddress?: string;
  }
  
  export interface TipLinkResponse {
    url: string;
    signature: string;
  }