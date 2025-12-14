import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OHLCV,
  Timeframe,
  BybitClient,
  ExchangeConfig,
  // Single Source of Truth - generator danych z core
  generateSyntheticData,
  getSupportedSymbols,
  fetchCachedCandles,
  getCacheStats,
  aggregateOHLCV,
} from '@trading-system/core';

@Injectable()
export class MarketDataService {
  private readonly logger = new Logger(MarketDataService.name);
  private bybitClient: BybitClient | null = null;
  private useRealData = false;
  private mongoUri: string = 'mongodb://localhost:27017';

  constructor(private readonly configService: ConfigService) {
    this.mongoUri = this.configService.get<string>('MONGODB_URI') || 'mongodb://localhost:27017';
    this.initializeBybitClient();
  }

  /**
   * Inicjalizuj klienta Bybit (dane publiczne bez kluczy API)
   */
  private async initializeBybitClient(): Promise<void> {
    const apiKey = this.configService.get<string>('BYBIT_API_KEY');
    const apiSecret = this.configService.get<string>('BYBIT_API_SECRET');
    const testnet = this.configService.get<string>('BYBIT_TESTNET') === 'true';

    // Możemy używać prawdziwych danych nawet bez kluczy API (tylko odczyt)
    const config: ExchangeConfig = {
      apiKey,
      apiSecret,
      testnet,
    };

    try {
      this.bybitClient = new BybitClient(config);
      await this.bybitClient.connect();
      this.useRealData = true;
      this.logger.log('Bybit client initialized - using REAL market data');
    } catch (error) {
      this.logger.warn(
        `Failed to initialize Bybit client: ${(error as Error).message}. Using synthetic data as fallback.`
      );
      this.useRealData = false;
    }
  }

  /**
   * Pobierz dane historyczne - używa cache MongoDB, pobiera brakujące z Bybit
   * Jeśli w cache są świece 1m, agreguje je do żądanego timeframe
   */
  async getHistoricalData(
    symbol: string,
    timeframe: Timeframe,
    startDate: Date,
    endDate: Date,
    limit?: number
  ): Promise<OHLCV[]> {
    try {
      // Najpierw spróbuj pobrać dane z żądanego timeframe
      this.logger.debug(`Fetching data for ${symbol} ${timeframe} (using cache)`);
      
      const result = await fetchCachedCandles(
        symbol,
        timeframe,
        startDate,
        endDate,
        { mongoUri: this.mongoUri },
        (message) => {
          this.logger.debug(message);
        }
      );

      if (result.candles.length > 0) {
        this.logger.log(
          `Loaded ${result.candles.length} ${timeframe} candles: ${result.stats.fromCache} from cache, ${result.stats.fromApi} from API`
        );

        let data = result.candles;
        if (limit && data.length > limit) {
          data = data.slice(-limit);
        }
        return data;
      }

      // Jeśli nie ma danych z żądanego timeframe, spróbuj zagregować z 1m
      if (timeframe !== '1m') {
        this.logger.debug(`No ${timeframe} data, trying to aggregate from 1m...`);
        
        const result1m = await fetchCachedCandles(
          symbol,
          '1m',
          startDate,
          endDate,
          { mongoUri: this.mongoUri },
          (message) => {
            this.logger.debug(message);
          }
        );

        if (result1m.candles.length > 0) {
          this.logger.log(`Aggregating ${result1m.candles.length} 1m candles to ${timeframe}...`);
          const aggregated = aggregateOHLCV(result1m.candles, '1m', timeframe);
          
          this.logger.log(`Created ${aggregated.length} ${timeframe} candles from 1m data`);
          
          let data = aggregated;
          if (limit && data.length > limit) {
            data = data.slice(-limit);
          }
          return data;
        }
      }

      // Jeśli nadal brak danych, pobierz bezpośrednio z Bybit
      this.logger.debug(`No cached data, fetching ${timeframe} from Bybit...`);
      const directResult = await fetchCachedCandles(
        symbol,
        timeframe,
        startDate,
        endDate,
        { mongoUri: this.mongoUri, forceRefresh: true },
        (message) => {
          this.logger.debug(message);
        }
      );

      let data = directResult.candles;
      if (limit && data.length > limit) {
        data = data.slice(-limit);
      }
      return data;
    } catch (error) {
      this.logger.warn(
        `Failed to fetch from cache/Bybit: ${(error as Error).message}. Falling back to synthetic data.`
      );
    }

    // Fallback do syntetycznych danych - Single Source of Truth z core
    this.logger.debug(`Using synthetic data for ${symbol}`);
    const data = generateSyntheticData(symbol, timeframe, startDate, endDate, {
      seed: 42, // Stały seed dla powtarzalności
    });

    if (limit && data.length > limit) {
      return data.slice(-limit);
    }
    return data;
  }

  getAvailableSymbols(): string[] {
    return getSupportedSymbols();
  }

  getAvailableTimeframes(): Timeframe[] {
    return ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'];
  }

  /**
   * Pobierz świeczki 1m z progress callbackiem
   * Używa MongoDB cache - pobiera tylko brakujące dane z Bybit
   */
  async downloadCandlesWithProgress(
    symbol: string,
    startDate: Date,
    endDate: Date,
    onProgress: (loaded: number, total: number, cached: number, downloaded: number) => void
  ): Promise<{ candlesCount: number; cached: number; downloaded: number }> {
    const timeframe: Timeframe = '1m';
    
    // Oblicz szacunkową liczbę świec
    const estimatedTotal = Math.floor((endDate.getTime() - startDate.getTime()) / 60000);
    let lastLoaded = 0;

    const result = await fetchCachedCandles(
      symbol,
      timeframe,
      startDate,
      endDate,
      { mongoUri: this.mongoUri },
      (message, loaded, total) => {
        this.logger.debug(message);
        if (loaded !== undefined && total !== undefined) {
          lastLoaded = loaded;
          onProgress(loaded, total, 0, loaded);
        } else {
          // Aktualizuj z szacowaną wartością
          onProgress(lastLoaded, estimatedTotal, 0, 0);
        }
      }
    );

    return {
      candlesCount: result.candles.length,
      cached: result.stats.fromCache,
      downloaded: result.stats.fromApi,
    };
  }

  /**
   * Pobierz informacje o cache
   */
  async getCacheInfo(symbol: string): Promise<{
    symbol: string;
    available: boolean;
    totalCandles: number;
    symbols: string[];
    timeframes: string[];
  }> {
    try {
      const stats = await getCacheStats();
      return {
        symbol,
        available: stats.available,
        totalCandles: stats.totalCandles,
        symbols: stats.symbols,
        timeframes: stats.timeframes,
      };
    } catch (error) {
      return {
        symbol,
        available: false,
        totalCandles: 0,
        symbols: [],
        timeframes: [],
      };
    }
  }
}
