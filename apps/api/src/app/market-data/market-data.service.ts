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
} from '@trading-system/core';

@Injectable()
export class MarketDataService {
  private readonly logger = new Logger(MarketDataService.name);
  private bybitClient: BybitClient | null = null;
  private useRealData = false;

  constructor(private readonly configService: ConfigService) {
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
   * Pobierz dane historyczne - z Bybit lub syntetyczne
   */
  async getHistoricalData(
    symbol: string,
    timeframe: Timeframe,
    startDate: Date,
    endDate: Date,
    limit?: number
  ): Promise<OHLCV[]> {
    // Spróbuj pobrać prawdziwe dane z Bybit
    if (this.useRealData && this.bybitClient) {
      try {
        this.logger.debug(`Fetching real data for ${symbol} from Bybit`);
        const data = await this.bybitClient.fetchHistoricalOHLCV(
          symbol,
          timeframe,
          startDate,
          endDate,
          (loaded, total) => {
            this.logger.debug(`Loading: ${loaded}/${total} candles`);
          }
        );

        if (limit && data.length > limit) {
          return data.slice(-limit);
        }
        return data;
      } catch (error) {
        this.logger.warn(
          `Failed to fetch from Bybit: ${(error as Error).message}. Falling back to synthetic data.`
        );
      }
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
}
