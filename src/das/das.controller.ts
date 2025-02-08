import {
    Controller,
    Post,
    Body,
    BadRequestException
  } from '@nestjs/common';
  import { DasService } from './das.service';
  import {
    TipLinkOptions,
    TipLinkResponse,
  } from './das.types';
  import { Keypair, PublicKey } from '@solana/web3.js';
import { ApiResponse, ApiTags, ApiOperation } from '@nestjs/swagger';
import { CreateTipLinkDto } from './das.dto';

  @Controller('das')
  @ApiTags('das')
  export class DasController {
    constructor(private readonly dasService: DasService) {}
  
    @Post('create/tiplink')
    @ApiOperation({ summary: 'Create a new TipLink' })
    @ApiResponse({ status: 201, description: 'TipLink created successfully' })
    @ApiResponse({ status: 400, description: 'Invalid input' })
    async createTipLink(@Body() createTipLinkDto: CreateTipLinkDto): Promise<TipLinkResponse> {
      try {
        const walletAddress = new PublicKey(createTipLinkDto.walletAddress);
        const walletKeypair = Keypair.fromSecretKey(
          Buffer.from(JSON.parse(createTipLinkDto.walletKeypair)),
        );
  
        return this.dasService.createTipLink(
          walletAddress,
          walletKeypair,
          createTipLinkDto.options,
        );
      } catch (error) {
        if (error instanceof Error) {
          throw new BadRequestException(`Invalid input: ${error.message}`);
        }
        throw error;
      }
    }
  }
