/**
 * OHLCV - Open, High, Low, Close, Volume
 * Podstawowa struktura danych świecowych
 */
export interface OHLCV {
  timestamp: number; // Unix timestamp w ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Rozszerzone dane OHLCV z dodatkowymi metadanymi
 */
export interface OHLCVWithMetadata extends OHLCV {
  symbol: string;
  timeframe: Timeframe;
}

/**
 * Dostępne timeframes
 */
export type Timeframe =
  | '1m'
  | '3m'
  | '5m'
  | '15m'
  | '30m'
  | '1h'
  | '2h'
  | '4h'
  | '6h'
  | '12h'
  | '1d'
  | '1w'
  | '1M';

/**
 * Mapowanie timeframe na minuty
 */
export const TIMEFRAME_TO_MINUTES: Record<Timeframe, number> = {
  '1m': 1,
  '3m': 3,
  '5m': 5,
  '15m': 15,
  '30m': 30,
  '1h': 60,
  '2h': 120,
  '4h': 240,
  '6h': 360,
  '12h': 720,
  '1d': 1440,
  '1w': 10080,
  '1M': 43200,
};

/**
 * Konwersja timeframe na milisekundy
 */
export function timeframeToMs(timeframe: Timeframe): number {
  return TIMEFRAME_TO_MINUTES[timeframe] * 60 * 1000;
}
