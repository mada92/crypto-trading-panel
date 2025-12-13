import { OHLCV, Timeframe } from '../types/ohlcv';

/**
 * Konfiguracja połączenia z giełdą
 */
export interface ExchangeConfig {
  apiKey?: string;
  apiSecret?: string;
  testnet?: boolean;
  timeout?: number;
}

/**
 * Saldo na koncie
 */
export interface Balance {
  currency: string;
  total: number;
  free: number;
  used: number;
}

/**
 * Pozycja na futures
 */
export interface ExchangePosition {
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  markPrice: number;
  unrealizedPnl: number;
  leverage: number;
  liquidationPrice?: number;
}

/**
 * Zlecenie na giełdzie
 */
export interface ExchangeOrder {
  id: string;
  symbol: string;
  type: 'market' | 'limit' | 'stop_market' | 'take_profit';
  side: 'buy' | 'sell';
  price?: number;
  amount: number;
  filled: number;
  remaining: number;
  status: 'open' | 'closed' | 'canceled';
  timestamp: number;
}

/**
 * Parametry tworzenia zlecenia
 */
export interface OrderParams {
  symbol: string;
  type: 'market' | 'limit' | 'stop_market' | 'take_profit';
  side: 'buy' | 'sell';
  amount: number;
  price?: number;
  stopPrice?: number;
  reduceOnly?: boolean;
  params?: Record<string, unknown>;
}

/**
 * Ticker (aktualna cena)
 */
export interface Ticker {
  symbol: string;
  last: number;
  bid: number;
  ask: number;
  high: number;
  low: number;
  volume: number;
  timestamp: number;
}

/**
 * Interfejs klienta giełdy
 */
export interface IExchangeClient {
  // Połączenie
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // Dane rynkowe
  fetchOHLCV(
    symbol: string,
    timeframe: Timeframe,
    since?: number,
    limit?: number
  ): Promise<OHLCV[]>;

  fetchTicker(symbol: string): Promise<Ticker>;

  // Trading
  createOrder(params: OrderParams): Promise<ExchangeOrder>;
  cancelOrder(orderId: string, symbol: string): Promise<void>;
  fetchOrder(orderId: string, symbol: string): Promise<ExchangeOrder>;
  fetchOpenOrders(symbol?: string): Promise<ExchangeOrder[]>;

  // Pozycje
  fetchPosition(symbol: string): Promise<ExchangePosition | null>;
  fetchPositions(): Promise<ExchangePosition[]>;
  closePosition(symbol: string): Promise<ExchangeOrder>;

  // Konto
  fetchBalance(): Promise<Balance[]>;
  setLeverage(symbol: string, leverage: number): Promise<void>;

  // Informacje
  getExchangeName(): string;
  getSupportedSymbols(): Promise<string[]>;
  getSupportedTimeframes(): Timeframe[];
}
