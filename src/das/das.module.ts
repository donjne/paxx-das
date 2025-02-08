import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DasController } from './das.controller';
import { DasService } from './das.service';

@Module({
  imports: [
    ConfigModule.forRoot(),
  ],
  controllers: [DasController],
  providers: [DasService],
})
export class DasModule {}