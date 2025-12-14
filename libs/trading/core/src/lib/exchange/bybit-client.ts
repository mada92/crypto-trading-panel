import * as ccxt from 'ccxt';
import { OHLCV, Timeframe, timeframeToMs } from '../types/ohlcv';
import {
  IExchangeClient,
  ExchangeConfig,
  Balance,
  ExchangePosition,
  ExchangeOrder,
  OrderParams,
  Ticker,
} from './exchange-interface';

/**
 * Mapowanie timeframe na format Bybit
 */
const TIMEFRAME_MAP: Record<Timeframe, string> = {
  '1m': '1',
  '3m': '3',
  '5m': '5',
  '15m': '15',
  '30m': '30',
  '1h': '60',
  '2h': '120',
  '4h': '240',
  '6h': '360',
  '12h': '720',
  '1d': 'D',
  '1w': 'W',
  '1M': 'M',
};

/**
 * Klient Bybit API używający ccxt
 */
export class BybitClient implements IExchangeClient {
  private exchange: ccxt.bybit;
  private connected = false;
  private readonly config: ExchangeConfig;

  constructor(config: ExchangeConfig = {}) {
    this.config = config;
    this.exchange = new ccxt.bybit({
      apiKey: config.apiKey,
      secret: config.apiSecret,
      sandbox: config.testnet ?? false,
      timeout: config.timeout ?? 30000,
      enableRateLimit: true,
      options: {
        defaultType: 'linear', // USDT perpetual
      },
    });
  }

  /**
   * Połącz z giełdą (załaduj rynki)
   */
  async connect(): Promise<void> {
    try {
      await this.exchange.loadMarkets();
      this.connected = true;
    } catch (error) {
      this.connected = false;
      throw new Error(`Failed to connect to Bybit: ${(error as Error).message}`);
    }
  }

  /**
   * Rozłącz
   */
  async disconnect(): Promise<void> {
    this.connected = false;
  }

  /**
   * Sprawdź czy połączony
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Pobierz dane OHLCV
   */
  async fetchOHLCV(
    symbol: string,
    timeframe: Timeframe,
    since?: number,
    limit: number = 200
  ): Promise<OHLCV[]> {
    const ccxtTimeframe = TIMEFRAME_MAP[timeframe];

    try {
      const ohlcv = await this.exchange.fetchOHLCV(
        symbol,
        ccxtTimeframe,
        since,
        limit
      );

      return ohlcv.map((candle) => ({
        timestamp: candle[0] as number,
        open: candle[1] as number,
        high: candle[2] as number,
        low: candle[3] as number,
        close: candle[4] as number,
        volume: candle[5] as number,
      }));
    } catch (error) {
      throw new Error(`Failed to fetch OHLCV: ${(error as Error).message}`);
    }
  }

  /**
   * Pobierz historyczne dane OHLCV (z paginacją)
   * @param onProgress - callback z postępem (loaded, total)
   * @param onBatch - callback z nowymi świecami do inkrementalnego zapisu
   */
  async fetchHistoricalOHLCV(
    symbol: string,
    timeframe: Timeframe,
    startDate: Date,
    endDate: Date,
    onProgress?: (loaded: number, total: number) => void,
    onBatch?: (candles: OHLCV[]) => Promise<void>
  ): Promise<OHLCV[]> {
    const allData: OHLCV[] = [];
    const intervalMs = timeframeToMs(timeframe);
    const batchSize = 200;

    let since = startDate.getTime();
    const endTimestamp = endDate.getTime();
    const estimatedTotal = Math.ceil((endTimestamp - since) / intervalMs);

    while (since < endTimestamp) {
      const batch = await this.fetchOHLCV(symbol, timeframe, since, batchSize);

      if (batch.length === 0) {
        break;
      }

      // Filtruj tylko świece w zakresie
      const filtered = batch.filter(
        (candle) => candle.timestamp >= since && candle.timestamp < endTimestamp
      );

      allData.push(...filtered);

      // Aktualizuj since na ostatni timestamp + interwał
      since = batch[batch.length - 1].timestamp + intervalMs;

      // Raportuj postęp
      if (onProgress) {
        onProgress(allData.length, estimatedTotal);
      }

      // Callback z nowymi świecami do inkrementalnego zapisu
      if (onBatch && filtered.length > 0) {
        await onBatch(filtered);
      }

      // Krótka pauza aby nie przekroczyć rate limit
      await this.sleep(100);
    }

    return allData;
  }

  /**
   * Pobierz ticker
   */
  async fetchTicker(symbol: string): Promise<Ticker> {
    try {
      const ticker = await this.exchange.fetchTicker(symbol);

      return {
        symbol,
        last: ticker.last ?? 0,
        bid: ticker.bid ?? 0,
        ask: ticker.ask ?? 0,
        high: ticker.high ?? 0,
        low: ticker.low ?? 0,
        volume: ticker.baseVolume ?? 0,
        timestamp: ticker.timestamp ?? Date.now(),
      };
    } catch (error) {
      throw new Error(`Failed to fetch ticker: ${(error as Error).message}`);
    }
  }

  /**
   * Utwórz zlecenie
   */
  async createOrder(params: OrderParams): Promise<ExchangeOrder> {
    try {
      const order = await this.exchange.createOrder(
        params.symbol,
        params.type,
        params.side,
        params.amount,
        params.price,
        {
          stopPrice: params.stopPrice,
          reduceOnly: params.reduceOnly,
          ...params.params,
        }
      );

      return this.mapOrder(order);
    } catch (error) {
      throw new Error(`Failed to create order: ${(error as Error).message}`);
    }
  }

  /**
   * Anuluj zlecenie
   */
  async cancelOrder(orderId: string, symbol: string): Promise<void> {
    try {
      await this.exchange.cancelOrder(orderId, symbol);
    } catch (error) {
      throw new Error(`Failed to cancel order: ${(error as Error).message}`);
    }
  }

  /**
   * Pobierz zlecenie
   */
  async fetchOrder(orderId: string, symbol: string): Promise<ExchangeOrder> {
    try {
      const order = await this.exchange.fetchOrder(orderId, symbol);
      return this.mapOrder(order);
    } catch (error) {
      throw new Error(`Failed to fetch order: ${(error as Error).message}`);
    }
  }

  /**
   * Pobierz otwarte zlecenia
   */
  async fetchOpenOrders(symbol?: string): Promise<ExchangeOrder[]> {
    try {
      const orders = await this.exchange.fetchOpenOrders(symbol);
      return orders.map((o) => this.mapOrder(o));
    } catch (error) {
      throw new Error(`Failed to fetch open orders: ${(error as Error).message}`);
    }
  }

  /**
   * Pobierz pozycję
   */
  async fetchPosition(symbol: string): Promise<ExchangePosition | null> {
    try {
      const positions = await this.exchange.fetchPositions([symbol]);
      const position = positions.find(
        (p) => p.symbol === symbol && (p.contracts ?? 0) > 0
      );

      if (!position) {
        return null;
      }

      return this.mapPosition(position);
    } catch (error) {
      throw new Error(`Failed to fetch position: ${(error as Error).message}`);
    }
  }

  /**
   * Pobierz wszystkie pozycje
   */
  async fetchPositions(): Promise<ExchangePosition[]> {
    try {
      const positions = await this.exchange.fetchPositions();
      return positions
        .filter((p) => (p.contracts ?? 0) > 0)
        .map((p) => this.mapPosition(p));
    } catch (error) {
      throw new Error(`Failed to fetch positions: ${(error as Error).message}`);
    }
  }

  /**
   * Zamknij pozycję
   */
  async closePosition(symbol: string): Promise<ExchangeOrder> {
    const position = await this.fetchPosition(symbol);

    if (!position) {
      throw new Error(`No open position for ${symbol}`);
    }

    // Zamknij pozycję zleceniem przeciwnym
    const side = position.side === 'long' ? 'sell' : 'buy';

    return this.createOrder({
      symbol,
      type: 'market',
      side,
      amount: position.size,
      reduceOnly: true,
    });
  }

  /**
   * Pobierz saldo
   */
  async fetchBalance(): Promise<Balance[]> {
    try {
      const balance = await this.exchange.fetchBalance();
      const result: Balance[] = [];
      const totalObj = balance['total'] as unknown as Record<string, number>;
      const freeObj = balance['free'] as unknown as Record<string, number>;
      const usedObj = balance['used'] as unknown as Record<string, number>;

      for (const currency of Object.keys(totalObj)) {
        const total = totalObj[currency] ?? 0;
        if (total > 0) {
          result.push({
            currency,
            total,
            free: freeObj[currency] ?? 0,
            used: usedObj[currency] ?? 0,
          });
        }
      }

      return result;
    } catch (error) {
      throw new Error(`Failed to fetch balance: ${(error as Error).message}`);
    }
  }

  /**
   * Ustaw dźwignię
   */
  async setLeverage(symbol: string, leverage: number): Promise<void> {
    try {
      await this.exchange.setLeverage(leverage, symbol);
    } catch (error) {
      throw new Error(`Failed to set leverage: ${(error as Error).message}`);
    }
  }

  /**
   * Pobierz nazwę giełdy
   */
  getExchangeName(): string {
    return 'bybit';
  }

  /**
   * Pobierz obsługiwane symbole
   */
  async getSupportedSymbols(): Promise<string[]> {
    if (!this.connected) {
      await this.connect();
    }

    return Object.keys(this.exchange.markets).filter((symbol) => {
      const market = this.exchange.markets[symbol];
      return market.linear && market.active;
    });
  }

  /**
   * Pobierz obsługiwane timeframe'y
   */
  getSupportedTimeframes(): Timeframe[] {
    return ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'];
  }

  /**
   * Mapuj zlecenie ccxt na nasz format
   */
  private mapOrder(order: ccxt.Order): ExchangeOrder {
    return {
      id: order.id,
      symbol: order.symbol,
      type: order.type as ExchangeOrder['type'],
      side: order.side as 'buy' | 'sell',
      price: order.price ?? undefined,
      amount: order.amount,
      filled: order.filled,
      remaining: order.remaining,
      status: order.status as ExchangeOrder['status'],
      timestamp: order.timestamp ?? Date.now(),
    };
  }

  /**
   * Mapuj pozycję ccxt na nasz format
   */
  private mapPosition(position: ccxt.Position): ExchangePosition {
    return {
      symbol: position.symbol,
      side: position.side === 'long' ? 'long' : 'short',
      size: position.contracts ?? 0,
      entryPrice: position.entryPrice ?? 0,
      markPrice: position.markPrice ?? 0,
      unrealizedPnl: position.unrealizedPnl ?? 0,
      leverage: position.leverage ?? 1,
      liquidationPrice: position.liquidationPrice ?? undefined,
    };
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Factory do tworzenia klienta Bybit
 */
export function createBybitClient(config?: ExchangeConfig): BybitClient {
  return new BybitClient(config);
}
