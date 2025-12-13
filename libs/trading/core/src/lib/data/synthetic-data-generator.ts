/**
 * Synthetic Data Generator - Single Source of Truth
 *
 * Realistyczny generator danych syntetycznych dla backtestingu.
 * Używany zarówno przez CLI jak i API.
 *
 * Cechy:
 * - Seeded random dla powtarzalności
 * - Reżimy volatility (low/normal/high)
 * - Siła trendu zmieniająca się w czasie
 * - Volume skorelowany z volatility
 */

import { OHLCV, Timeframe, timeframeToMs } from '../types/ohlcv';

/**
 * Seeded random number generator dla powtarzalności
 */
export class SeededRandom {
  private seed: number;

  constructor(seed: number = 42) {
    this.seed = seed;
  }

  /**
   * Następna wartość losowa [0, 1)
   */
  next(): number {
    // Linear congruential generator
    this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
    return this.seed / 4294967296;
  }

  /**
   * Rozkład normalny (Box-Muller transform)
   */
  gaussian(mean = 0, std = 1): number {
    const u1 = this.next();
    const u2 = this.next();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return z0 * std + mean;
  }

  /**
   * Reset seeda
   */
  reset(seed?: number): void {
    this.seed = seed ?? 42;
  }
}

/**
 * Typ reżimu volatility
 */
export type VolatilityRegime = 'low' | 'normal' | 'high';

/**
 * Konfiguracja generatora
 */
export interface SyntheticDataConfig {
  /** Seed dla random (domyślnie 42) */
  seed?: number;
  /** Cena początkowa (domyślnie zależna od symbolu) */
  initialPrice?: number;
  /** Bazowa volatility (domyślnie 0.02) */
  baseVolatility?: number;
  /** Bazowy volume (domyślnie 1000) */
  baseVolume?: number;
}

/**
 * Domyślne ceny początkowe dla symboli
 */
const DEFAULT_PRICES: Record<string, number> = {
  BTCUSDT: 20000,
  ETHUSDT: 1500,
  SOLUSDT: 30,
  BNBUSDT: 250,
  XRPUSDT: 0.5,
  DOGEUSDT: 0.08,
  ADAUSDT: 0.4,
  AVAXUSDT: 35,
  DOTUSDT: 7,
  MATICUSDT: 0.8,
};

/**
 * Generuj syntetyczne dane OHLCV
 *
 * @param symbol - Symbol (np. BTCUSDT)
 * @param timeframe - Timeframe (np. 4h)
 * @param startDate - Data początkowa
 * @param endDate - Data końcowa
 * @param config - Opcjonalna konfiguracja
 * @returns Tablica OHLCV
 */
export function generateSyntheticData(
  symbol: string,
  timeframe: Timeframe,
  startDate: Date,
  endDate: Date,
  config: SyntheticDataConfig = {}
): OHLCV[] {
  const data: OHLCV[] = [];
  const intervalMs = timeframeToMs(timeframe);
  const rng = new SeededRandom(config.seed ?? 42);

  let currentTimestamp = startDate.getTime();
  const endTimestamp = endDate.getTime();

  // Cena początkowa
  let price = config.initialPrice ?? DEFAULT_PRICES[symbol] ?? 100;

  // Reżim volatility i trend
  let volRegime: VolatilityRegime = 'normal';
  let trendStrength = 0;

  while (currentTimestamp < endTimestamp) {
    // Zmiana reżimu volatility (2% szansy)
    if (rng.next() < 0.02) {
      const r = rng.next();
      if (r < 0.3) volRegime = 'low';
      else if (r < 0.8) volRegime = 'normal';
      else volRegime = 'high';
    }

    // Zmiana trendu (1% szansy)
    if (rng.next() < 0.01) {
      trendStrength = rng.gaussian(0, 0.003);
    }

    // Volatility na podstawie reżimu
    let volatility: number;
    switch (volRegime) {
      case 'low':
        volatility = 0.005 + rng.next() * 0.01; // 0.5%-1.5%
        break;
      case 'high':
        volatility = 0.03 + rng.next() * 0.03; // 3%-6%
        break;
      default:
        volatility = 0.012 + rng.next() * 0.016; // 1.2%-2.8%
    }

    // Return z uwzględnieniem trendu
    const returns = trendStrength + rng.gaussian(0, volatility);

    const open = price;
    const close = price * (1 + returns);

    // High/Low z realistycznym spreadem
    const high =
      Math.max(open, close) * (1 + Math.abs(rng.gaussian(0, volatility * 0.5)));
    const low =
      Math.min(open, close) * (1 - Math.abs(rng.gaussian(0, volatility * 0.5)));

    // Volume wyższy przy większej volatility
    const baseVolume = config.baseVolume ?? 1000;
    const volume = baseVolume * (1 + volatility * 20) * (0.5 + rng.next() * 1.5);

    data.push({
      timestamp: currentTimestamp,
      open: roundPrice(open),
      high: roundPrice(high),
      low: roundPrice(low),
      close: roundPrice(close),
      volume: Math.round(volume),
    });

    price = close;
    currentTimestamp += intervalMs;
  }

  return data;
}

/**
 * Zaokrąglij cenę do odpowiedniej precyzji
 */
function roundPrice(price: number): number {
  if (price > 1000) {
    return Math.round(price * 100) / 100;
  } else if (price > 1) {
    return Math.round(price * 1000) / 1000;
  } else {
    return Math.round(price * 100000) / 100000;
  }
}

/**
 * Pobierz domyślną cenę dla symbolu
 */
export function getDefaultPrice(symbol: string): number {
  return DEFAULT_PRICES[symbol] ?? 100;
}

/**
 * Lista obsługiwanych symboli
 */
export function getSupportedSymbols(): string[] {
  return Object.keys(DEFAULT_PRICES);
}

