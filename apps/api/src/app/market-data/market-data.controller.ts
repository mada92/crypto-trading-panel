import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { MarketDataService } from './market-data.service';
import { Timeframe } from '@trading-system/core';

@Controller('market-data')
export class MarketDataController {
  constructor(private readonly marketDataService: MarketDataService) {}

  @Get('klines')
  async getKlines(
    @Query('symbol') symbol: string,
    @Query('timeframe') timeframe: Timeframe,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string
  ) {
    if (!symbol) {
      throw new BadRequestException('Symbol is required');
    }
    if (!timeframe) {
      throw new BadRequestException('Timeframe is required');
    }

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    return this.marketDataService.getHistoricalData(
      symbol,
      timeframe,
      start,
      end,
      limit ? parseInt(limit) : undefined
    );
  }

  @Get('symbols')
  async getSymbols() {
    return this.marketDataService.getAvailableSymbols();
  }

  @Get('timeframes')
  async getTimeframes() {
    return this.marketDataService.getAvailableTimeframes();
  }
}
