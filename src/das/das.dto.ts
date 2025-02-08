import { IsString, IsNumber, IsOptional, Min, IsEnum, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer'; 

// Create a separate class for options
export class TipLinkOptionsDto {
  @ApiProperty({ description: 'Amount to transfer' })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiPropertyOptional({ enum: ['mainnet', 'devnet'] })
  @IsOptional()
  @IsEnum(['mainnet', 'devnet'])
  network?: 'mainnet' | 'devnet';

  @ApiPropertyOptional({ description: 'SPL token mint address' })
  @IsOptional()
  @IsString()
  splMintAddress?: string;
}

export class CreateTipLinkDto {
  @ApiProperty({ description: 'Solana wallet public key' })
  @IsString()
  walletAddress: string;

  @ApiProperty({ description: 'Wallet keypair as JSON string array' })
  @IsString()
  walletKeypair: string;

  @ApiProperty()
  @ValidateNested()
  @Type(() => TipLinkOptionsDto)
  options: TipLinkOptionsDto;
}