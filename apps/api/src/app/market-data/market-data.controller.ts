import { Controller, Get, Post, Query, Body, BadRequestException, Res, Sse } from '@nestjs/common';
import { Response } from 'express';
import { Observable, Subject } from 'rxjs';
import { MarketDataService } from './market-data.service';
import { Timeframe } from '@trading-system/core';
import { DownloadCandlesDto, DownloadProgress } from './dto/download-candles.dto';

@Controller('market-data')
export class MarketDataController {
  constructor(private readonly marketDataService: MarketDataService) {}

  /**
   * SSE endpoint do pobierania świeczek 1m z progress barem
   */
  @Get('download-candles')
  async downloadCandles(
    @Query('symbol') symbol: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Res() res: Response
  ): Promise<void> {
    if (!symbol || !startDate || !endDate) {
      res.status(400).json({ error: 'symbol, startDate and endDate are required' });
      return;
    }

    // Ustawienia SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    const sendEvent = (data: DownloadProgress) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const start = new Date(startDate);
      const end = new Date(endDate);

      const result = await this.marketDataService.downloadCandlesWithProgress(
        symbol,
        start,
        end,
        (loaded, total, cached, downloaded) => {
          const percent = total > 0 ? Math.round((loaded / total) * 100) : 0;
          sendEvent({
            type: 'progress',
            loaded,
            total,
            percent,
            cached,
            downloaded,
            message: `Pobrano 123 ${loaded.toLocaleString()} / ${total.toLocaleString()} świec`,
          });
        }
      );

      sendEvent({
        type: 'complete',
        candlesCount: result.candlesCount,
        cached: result.cached,
        downloaded: result.downloaded,
        message: `Zakończono! Pobrano ${result.candlesCount.toLocaleString()} świec 1m`,
      });
    } catch (error) {
      sendEvent({
        type: 'error',
        message: `Błąd: ${(error as Error).message}`,
      });
    } finally {
      res.end();
    }
  }

  /**
   * Pobierz info o świeczkach w cache
   */
  @Get('cache-info')
  async getCacheInfo(
    @Query('symbol') symbol: string
  ) {
    if (!symbol) {
      throw new BadRequestException('Symbol is required');
    }
    return this.marketDataService.getCacheInfo(symbol);
  }

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
