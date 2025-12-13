import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  BacktestEngine,
  BacktestConfig,
  BacktestResult,
  BacktestProgress,
  OHLCV,
} from '@trading-system/core';
import { StrategiesService } from '../strategies/strategies.service';
import { MarketDataService } from '../market-data/market-data.service';
import { RunBacktestDto } from './dto/backtest.dto';

interface StoredBacktest {
  result: BacktestResult;
  createdAt: Date;
}

@Injectable()
export class BacktestService {
  private readonly logger = new Logger(BacktestService.name);
  
  // In-memory storage
  private backtests: Map<string, StoredBacktest> = new Map();
  private progressSubjects: Map<string, Subject<BacktestProgress>> = new Map();

  constructor(
    private readonly strategiesService: StrategiesService,
    private readonly marketDataService: MarketDataService
  ) {}

  async findAll(strategyId?: string, status?: string): Promise<BacktestResult[]> {
    let results = Array.from(this.backtests.values()).map((b) => b.result);

    if (strategyId) {
      results = results.filter((r) => r.strategyId === strategyId);
    }

    if (status) {
      results = results.filter((r) => r.status === status);
    }

    // Sort by creation date descending
    results.sort((a, b) => {
      const dateA = a.startedAt ? new Date(a.startedAt).getTime() : 0;
      const dateB = b.startedAt ? new Date(b.startedAt).getTime() : 0;
      return dateB - dateA;
    });

    return results;
  }

  async findOne(id: string): Promise<BacktestResult> {
    const backtest = this.backtests.get(id);
    if (!backtest) {
      throw new NotFoundException(`Backtest with ID ${id} not found`);
    }
    return backtest.result;
  }

  async run(dto: RunBacktestDto): Promise<{ backtestId: string; status: string }> {
    // Get strategy
    const strategy = this.strategiesService.getSchema(dto.strategyId);
    if (!strategy) {
      throw new NotFoundException(`Strategy with ID ${dto.strategyId} not found`);
    }

    // Create backtest config
    const config: BacktestConfig = {
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      initialCapital: dto.initialCapital || 10000,
      currency: dto.currency || 'USDT',
      commissionPercent: dto.commissionPercent || 0.0006,
      slippagePercent: dto.slippagePercent || 0.0003,
      fillModel: dto.fillModel || 'realistic',
      dataSource: 'local',
    };

    // Validate date range
    if (config.startDate >= config.endDate) {
      throw new BadRequestException('Start date must be before end date');
    }

    // Get market data
    const symbol = dto.symbol || strategy.dataRequirements.symbols[0] || 'BTCUSDT';
    const timeframe = strategy.dataRequirements.primaryTimeframe;

    this.logger.log(`Starting backtest for strategy: ${dto.strategyId}`);
    this.logger.log(`Symbol: ${symbol}, Timeframe: ${timeframe}`);
    this.logger.log(`Date range: ${config.startDate.toISOString()} to ${config.endDate.toISOString()}`);

    const data = await this.marketDataService.getHistoricalData(
      symbol,
      timeframe,
      config.startDate,
      config.endDate
    );

    this.logger.log(`Loaded ${data.length} candles`);

    if (data.length === 0) {
      throw new BadRequestException(
        `No market data available for ${symbol} in the specified date range`
      );
    }
    
    // Log sample data
    if (data.length > 0) {
      this.logger.debug(`First candle: ${JSON.stringify(data[0])}`);
      this.logger.debug(`Last candle: ${JSON.stringify(data[data.length - 1])}`);
    }

    // Create backtest engine
    const engine = new BacktestEngine(strategy, config);

    // Create progress subject
    const progressSubject = new Subject<BacktestProgress>();
    const backtestId = `bt-${Date.now()}`;
    this.progressSubjects.set(backtestId, progressSubject);

    // Run backtest asynchronously
    this.executeBacktest(engine, data, symbol, backtestId, progressSubject);

    return {
      backtestId,
      status: 'running',
    };
  }

  private async executeBacktest(
    engine: BacktestEngine,
    data: OHLCV[],
    symbol: string,
    backtestId: string,
    progressSubject: Subject<BacktestProgress>
  ): Promise<void> {
    try {
      this.logger.log(`Executing backtest ${backtestId}...`);
      
      const result = await engine.run(data, symbol, (progress) => {
        progressSubject.next(progress);
      });

      // Override backtest ID
      result.id = backtestId;

      this.logger.log(`Backtest ${backtestId} completed:`);
      this.logger.log(`  - Total candles: ${result.totalCandles}`);
      this.logger.log(`  - Processed candles: ${result.processedCandles}`);
      this.logger.log(`  - Trades: ${result.trades.length}`);
      this.logger.log(`  - Status: ${result.status}`);
      
      if (result.metrics) {
        this.logger.log(`  - Total Return: ${result.metrics.totalReturn?.toFixed(2)}%`);
        this.logger.log(`  - Win Rate: ${result.metrics.winRate?.toFixed(2)}%`);
      }
      
      if (result.trades.length === 0) {
        this.logger.warn(`No trades generated! Strategy conditions might be too restrictive.`);
      }

      // Store result
      this.backtests.set(backtestId, {
        result,
        createdAt: new Date(),
      });

      // Complete progress stream
      progressSubject.next({
        backtestId,
        progress: 100,
        processedCandles: result.processedCandles,
        totalCandles: result.totalCandles,
      });
      progressSubject.complete();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Store failed result
      const failedResult: BacktestResult = {
        id: backtestId,
        strategyId: engine.getStrategy().id,
        strategyVersion: engine.getStrategy().version,
        config: engine.getConfig(),
        status: 'failed',
        trades: [],
        equityCurve: [],
        error: errorMessage,
        totalCandles: 0,
        processedCandles: 0,
      };

      this.backtests.set(backtestId, {
        result: failedResult,
        createdAt: new Date(),
      });

      progressSubject.error(new Error(errorMessage));
    } finally {
      this.progressSubjects.delete(backtestId);
    }
  }

  async remove(id: string): Promise<void> {
    const exists = this.backtests.has(id);
    if (!exists) {
      throw new NotFoundException(`Backtest with ID ${id} not found`);
    }
    this.backtests.delete(id);
  }

  async getTrades(
    id: string,
    page: number,
    limit: number
  ): Promise<{
    trades: unknown[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const backtest = await this.findOne(id);

    const start = (page - 1) * limit;
    const end = start + limit;
    const trades = backtest.trades.slice(start, end);

    return {
      trades,
      total: backtest.trades.length,
      page,
      totalPages: Math.ceil(backtest.trades.length / limit),
    };
  }

  async getEquityCurve(id: string) {
    const backtest = await this.findOne(id);
    return backtest.equityCurve;
  }

  async getMetrics(id: string) {
    const backtest = await this.findOne(id);
    return backtest.metrics;
  }

  subscribeToProgress(id: string): Observable<MessageEvent> {
    const subject = this.progressSubjects.get(id);

    if (!subject) {
      // Check if backtest exists and is completed
      const backtest = this.backtests.get(id);
      if (backtest) {
        // Return completed progress
        return new Observable((subscriber) => {
          subscriber.next({
            data: {
              backtestId: id,
              progress: 100,
              processedCandles: backtest.result.processedCandles,
              totalCandles: backtest.result.totalCandles,
              status: backtest.result.status,
            },
          } as MessageEvent);
          subscriber.complete();
        });
      }

      throw new NotFoundException(`Backtest with ID ${id} not found`);
    }

    return subject.asObservable().pipe(
      map((progress) => ({
        data: progress,
      }))
    ) as Observable<MessageEvent>;
  }
}

interface MessageEvent {
  data: string | object;
  id?: string;
  type?: string;
  retry?: number;
}
