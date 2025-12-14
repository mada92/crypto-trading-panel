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

/**
 * Stan aktywnego pobierania
 */
export interface DownloadStatus {
  id: string;
  symbol: string;
  startDate: Date;
  endDate: Date;
  status: 'running' | 'completed' | 'failed';
  progress: number;
  loaded: number;
  total: number;
  message: string;
  startedAt: Date;
  completedAt?: Date;
}

@Injectable()
export class MarketDataService {
  private readonly logger = new Logger(MarketDataService.name);
  private bybitClient: BybitClient | null = null;
  private useRealData = false;
  private mongoUri: string = 'mongodb://localhost:27017';
  
  // Mapa aktywnych i ostatnich pobierań (klucz = symbol)
  private activeDownloads: Map<string, DownloadStatus> = new Map();

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
   * Pobierz dane historyczne - ZAWSZE używa danych 1m z cache
   * 
   * Logika:
   * 1. Pobierz świece 1m z cache (NIE pobiera z Bybit!)
   * 2. Jeśli żądany TF != 1m → zagreguj do wyższego TF
   * 3. Jeśli brak 1m → fallback do syntetycznych danych
   * 
   * UWAGA: Dane 1m muszą być wcześniej pobrane przez stronę "Pobieranie danych"
   */
  async getHistoricalData(
    symbol: string,
    timeframe: Timeframe,
    startDate: Date,
    endDate: Date,
    limit?: number
  ): Promise<OHLCV[]> {
    try {
      this.logger.debug(`Fetching ${symbol} ${timeframe} from 1m cache...`);

      // ZAWSZE używaj tylko 1m - jeśli brak w cache, pobierz z Bybit
      const result1m = await fetchCachedCandles(
        symbol,
        '1m',  // ZAWSZE 1m - nigdy inne TF!
        startDate,
        endDate,
        { mongoUri: this.mongoUri },
        (message) => {
          this.logger.debug(message);
        }
      );

      if (result1m.candles.length > 0) {
        let data: OHLCV[];

        if (timeframe === '1m') {
          // Żądany timeframe to 1m - zwróć bez agregacji
          data = result1m.candles;
          this.logger.log(`✅ Loaded ${data.length} 1m candles from cache`);
        } else {
          // Agreguj 1m do żądanego timeframe
          this.logger.log(`Aggregating ${result1m.candles.length} 1m candles to ${timeframe}...`);
          data = aggregateOHLCV(result1m.candles, '1m', timeframe);
          this.logger.log(`✅ Created ${data.length} ${timeframe} candles from 1m data`);
        }

        if (limit && data.length > limit) {
          data = data.slice(-limit);
        }
        return data;
      }

      // Brak danych 1m w cache
      this.logger.warn(
        `⚠️ No 1m data in cache for ${symbol}. Use "Pobieranie danych" page to download candles first.`
      );
      
    } catch (error) {
      this.logger.warn(
        `Failed to fetch 1m data: ${(error as Error).message}. Falling back to synthetic data.`
      );
    }

    // Fallback do syntetycznych danych
    this.logger.debug(`Using synthetic data for ${symbol} ${timeframe}`);
    const data = generateSyntheticData(symbol, timeframe, startDate, endDate, {
      seed: 42,
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
   * Pobierz status pobierania dla symbolu
   */
  getDownloadStatus(symbol: string): DownloadStatus | null {
    return this.activeDownloads.get(symbol) || null;
  }

  /**
   * Pobierz wszystkie aktywne pobierania
   */
  getAllDownloadStatuses(): DownloadStatus[] {
    return Array.from(this.activeDownloads.values());
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

    // Utwórz status pobierania
    const downloadId = `${symbol}-${Date.now()}`;
    const status: DownloadStatus = {
      id: downloadId,
      symbol,
      startDate,
      endDate,
      status: 'running',
      progress: 0,
      loaded: 0,
      total: estimatedTotal,
      message: 'Rozpoczynam pobieranie...',
      startedAt: new Date(),
    };
    this.activeDownloads.set(symbol, status);

    try {
      const result = await fetchCachedCandles(
        symbol,
        timeframe,
        startDate,
        endDate,
        { mongoUri: this.mongoUri },
        (message, loaded, total) => {
          this.logger.debug(message);
          // Używaj wartości z cached-data-provider (są już spójne)
          const currentLoaded = loaded ?? lastLoaded;
          const currentTotal = total ?? estimatedTotal;
          lastLoaded = currentLoaded;
          
          // Aktualizuj status
          const currentStatus = this.activeDownloads.get(symbol);
          if (currentStatus) {
            currentStatus.loaded = currentLoaded;
            currentStatus.total = currentTotal;
            currentStatus.progress = currentTotal > 0 ? Math.round((currentLoaded / currentTotal) * 100) : 0;
            currentStatus.message = message;
          }
          
          onProgress(currentLoaded, currentTotal, 0, currentLoaded);
        }
      );

      // Zakończ pobieranie
      const finalStatus = this.activeDownloads.get(symbol);
      if (finalStatus) {
        finalStatus.status = 'completed';
        finalStatus.progress = 100;
        finalStatus.loaded = result.candles.length;
        finalStatus.message = `Zakończono! Pobrano ${result.candles.length} świec`;
        finalStatus.completedAt = new Date();
      }

      return {
        candlesCount: result.candles.length,
        cached: result.stats.fromCache,
        downloaded: result.stats.fromApi,
      };
    } catch (error) {
      // Błąd pobierania
      const errorStatus = this.activeDownloads.get(symbol);
      if (errorStatus) {
        errorStatus.status = 'failed';
        errorStatus.message = `Błąd: ${(error as Error).message}`;
        errorStatus.completedAt = new Date();
      }
      throw error;
    }
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
