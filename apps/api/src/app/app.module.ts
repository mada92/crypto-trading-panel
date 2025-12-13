import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StrategiesModule } from './strategies/strategies.module';
import { BacktestModule } from './backtest/backtest.module';
import { MarketDataModule } from './market-data/market-data.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    StrategiesModule,
    BacktestModule,
    MarketDataModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
