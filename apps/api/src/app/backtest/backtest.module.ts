import { Module } from '@nestjs/common';
import { BacktestController } from './backtest.controller';
import { BacktestService } from './backtest.service';
import { StrategiesModule } from '../strategies/strategies.module';
import { MarketDataModule } from '../market-data/market-data.module';

@Module({
  imports: [StrategiesModule, MarketDataModule],
  controllers: [BacktestController],
  providers: [BacktestService],
  exports: [BacktestService],
})
export class BacktestModule {}
