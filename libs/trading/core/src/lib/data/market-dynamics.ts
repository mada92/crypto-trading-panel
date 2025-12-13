/**
 * Market Dynamics Analysis
 *
 * Analiza dynamiki rynku na podstawie danych 1m:
 * - Velocity (prędkość ruchu ceny)
 * - Volume Distribution (rozkład wolumenu w czasie)
 * - Momentum (siła ruchu)
 * - Volatility Clustering (grupowanie zmienności)
 */

import { OHLCV } from '../types/ohlcv';

/**
 * Metryki dynamiki dla pojedynczego okresu (np. 4h z danych 1m)
 */
export interface DynamicsMetrics {
  // Velocity - jak szybko cena się porusza
  priceVelocity: number;        // Zmiana ceny / czas ($ per minute)
  velocityAcceleration: number; // Zmiana velocity (przyspieszenie)
  
  // Volume Distribution - rozkład wolumenu
  volumeSpike: boolean;         // Czy był spike wolumenu (>2x średniej)
  volumeAtHigh: number;         // % wolumenu w górnej połowie range
  volumeAtLow: number;          // % wolumenu w dolnej połowie range
  volumeTrend: number;          // 1 = rosnący, -1 = malejący, 0 = flat
  
  // Momentum
  bodyToWickRatio: number;      // Stosunek body do wicks (siła kierunku)
  closePosition: number;        // Gdzie zamknęło się względem range (0-1)
  consecutiveDirection: number; // Ile kolejnych świec w tym samym kierunku
  
  // Volatility
  intrabarVolatility: number;   // Zmienność wewnątrz okresu
  volatilityClustering: number; // Czy zmienność się grupuje
  
  // Micro-structure
  numberOfReversals: number;    // Ile odwróceń kierunku wewnątrz okresu
  maxDrawdownIntra: number;     // Max DD wewnątrz okresu
  avgCandleSize: number;        // Średni rozmiar świecy 1m
}

/**
 * Oblicz metryki dynamiki dla grupy świec 1m
 */
export function calculateDynamics(candles1m: OHLCV[]): DynamicsMetrics {
  if (candles1m.length === 0) {
    return getEmptyMetrics();
  }

  const opens = candles1m.map(c => c.open);
  const highs = candles1m.map(c => c.high);
  const lows = candles1m.map(c => c.low);
  const closes = candles1m.map(c => c.close);
  const volumes = candles1m.map(c => c.volume);

  const periodHigh = Math.max(...highs);
  const periodLow = Math.min(...lows);
  const periodRange = periodHigh - periodLow;
  const periodOpen = candles1m[0].open;
  const periodClose = candles1m[candles1m.length - 1].close;

  // Velocity
  const priceChange = periodClose - periodOpen;
  const priceVelocity = priceChange / candles1m.length;
  
  // Velocity acceleration (zmiana prędkości)
  const midPoint = Math.floor(candles1m.length / 2);
  const firstHalfVelocity = (closes[midPoint] - opens[0]) / midPoint;
  const secondHalfVelocity = (closes[closes.length - 1] - closes[midPoint]) / (candles1m.length - midPoint);
  const velocityAcceleration = secondHalfVelocity - firstHalfVelocity;

  // Volume Distribution
  const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  const maxVolume = Math.max(...volumes);
  const volumeSpike = maxVolume > avgVolume * 2;
  
  // Volume at high vs low
  const midPrice = (periodHigh + periodLow) / 2;
  let volumeAboveMid = 0;
  let volumeBelowMid = 0;
  for (let i = 0; i < candles1m.length; i++) {
    if (closes[i] >= midPrice) {
      volumeAboveMid += volumes[i];
    } else {
      volumeBelowMid += volumes[i];
    }
  }
  const totalVolume = volumeAboveMid + volumeBelowMid;
  const volumeAtHigh = totalVolume > 0 ? volumeAboveMid / totalVolume : 0.5;
  const volumeAtLow = totalVolume > 0 ? volumeBelowMid / totalVolume : 0.5;

  // Volume trend
  const firstHalfVolume = volumes.slice(0, midPoint).reduce((a, b) => a + b, 0);
  const secondHalfVolume = volumes.slice(midPoint).reduce((a, b) => a + b, 0);
  const volumeTrend = secondHalfVolume > firstHalfVolume * 1.2 ? 1 :
                      secondHalfVolume < firstHalfVolume * 0.8 ? -1 : 0;

  // Body to wick ratio
  const body = Math.abs(periodClose - periodOpen);
  const upperWick = periodHigh - Math.max(periodOpen, periodClose);
  const lowerWick = Math.min(periodOpen, periodClose) - periodLow;
  const totalWicks = upperWick + lowerWick;
  const bodyToWickRatio = totalWicks > 0 ? body / totalWicks : body > 0 ? 10 : 0;

  // Close position in range
  const closePosition = periodRange > 0 ? (periodClose - periodLow) / periodRange : 0.5;

  // Consecutive direction
  let consecutiveUp = 0;
  let consecutiveDown = 0;
  for (let i = candles1m.length - 1; i >= 0; i--) {
    if (closes[i] > opens[i]) {
      if (consecutiveDown > 0) break;
      consecutiveUp++;
    } else if (closes[i] < opens[i]) {
      if (consecutiveUp > 0) break;
      consecutiveDown++;
    }
  }
  const consecutiveDirection = consecutiveUp > 0 ? consecutiveUp : -consecutiveDown;

  // Intrabar volatility
  const returns = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  const intrabarVolatility = Math.sqrt(variance);

  // Volatility clustering
  const recentVolatility = returns.slice(-10).map(r => Math.abs(r));
  const avgRecentVol = recentVolatility.reduce((a, b) => a + b, 0) / recentVolatility.length;
  const overallVolatility = returns.map(r => Math.abs(r)).reduce((a, b) => a + b, 0) / returns.length;
  const volatilityClustering = avgRecentVol / overallVolatility;

  // Number of reversals
  let reversals = 0;
  let lastDirection = 0;
  for (let i = 1; i < closes.length; i++) {
    const direction = closes[i] > closes[i - 1] ? 1 : closes[i] < closes[i - 1] ? -1 : 0;
    if (direction !== 0 && lastDirection !== 0 && direction !== lastDirection) {
      reversals++;
    }
    if (direction !== 0) lastDirection = direction;
  }

  // Max drawdown intra
  let peak = closes[0];
  let maxDD = 0;
  for (const close of closes) {
    if (close > peak) peak = close;
    const dd = (peak - close) / peak;
    if (dd > maxDD) maxDD = dd;
  }

  // Average candle size
  const candleSizes = candles1m.map(c => (c.high - c.low) / c.open);
  const avgCandleSize = candleSizes.reduce((a, b) => a + b, 0) / candleSizes.length;

  return {
    priceVelocity,
    velocityAcceleration,
    volumeSpike,
    volumeAtHigh,
    volumeAtLow,
    volumeTrend,
    bodyToWickRatio,
    closePosition,
    consecutiveDirection,
    intrabarVolatility,
    volatilityClustering,
    numberOfReversals: reversals,
    maxDrawdownIntra: maxDD,
    avgCandleSize,
  };
}

function getEmptyMetrics(): DynamicsMetrics {
  return {
    priceVelocity: 0,
    velocityAcceleration: 0,
    volumeSpike: false,
    volumeAtHigh: 0.5,
    volumeAtLow: 0.5,
    volumeTrend: 0,
    bodyToWickRatio: 0,
    closePosition: 0.5,
    consecutiveDirection: 0,
    intrabarVolatility: 0,
    volatilityClustering: 1,
    numberOfReversals: 0,
    maxDrawdownIntra: 0,
    avgCandleSize: 0,
  };
}

/**
 * Agreguj świece 1m do wyższego TF z metrykami dynamiki
 */
export interface AggregatedCandle extends OHLCV {
  dynamics: DynamicsMetrics;
}

export function aggregateWithDynamics(
  candles1m: OHLCV[],
  targetIntervalMs: number
): AggregatedCandle[] {
  if (candles1m.length === 0) return [];

  const result: AggregatedCandle[] = [];
  let currentGroup: OHLCV[] = [];
  let currentPeriodStart = Math.floor(candles1m[0].timestamp / targetIntervalMs) * targetIntervalMs;

  for (const candle of candles1m) {
    const candlePeriodStart = Math.floor(candle.timestamp / targetIntervalMs) * targetIntervalMs;

    if (candlePeriodStart !== currentPeriodStart && currentGroup.length > 0) {
      // Zamknij poprzedni okres
      result.push(createAggregatedCandle(currentGroup, currentPeriodStart));
      currentGroup = [];
      currentPeriodStart = candlePeriodStart;
    }

    currentGroup.push(candle);
  }

  // Ostatni okres
  if (currentGroup.length > 0) {
    result.push(createAggregatedCandle(currentGroup, currentPeriodStart));
  }

  return result;
}

function createAggregatedCandle(candles: OHLCV[], timestamp: number): AggregatedCandle {
  return {
    timestamp,
    open: candles[0].open,
    high: Math.max(...candles.map(c => c.high)),
    low: Math.min(...candles.map(c => c.low)),
    close: candles[candles.length - 1].close,
    volume: candles.reduce((sum, c) => sum + c.volume, 0),
    dynamics: calculateDynamics(candles),
  };
}

/**
 * Filtr sygnałów na podstawie dynamiki
 */
export interface DynamicsFilter {
  // Wymagaj silnego momentum
  minBodyToWickRatio?: number;  // np. > 1.5
  // Wymagaj rosnącego wolumenu
  requireRisingVolume?: boolean;
  // Wymagaj braku spike'a wolumenu (może być pułapka)
  avoidVolumeSpike?: boolean;
  // Wymagaj niskiej liczby odwróceń (silny ruch)
  maxReversals?: number;
  // Wymagaj close w górnej części range (dla long)
  minClosePosition?: number;
}

export function filterByDynamics(
  candle: AggregatedCandle,
  filter: DynamicsFilter,
  direction: 'long' | 'short'
): boolean {
  const d = candle.dynamics;

  if (filter.minBodyToWickRatio && d.bodyToWickRatio < filter.minBodyToWickRatio) {
    return false;
  }

  if (filter.requireRisingVolume && d.volumeTrend !== 1) {
    return false;
  }

  if (filter.avoidVolumeSpike && d.volumeSpike) {
    return false;
  }

  if (filter.maxReversals !== undefined && d.numberOfReversals > filter.maxReversals) {
    return false;
  }

  if (filter.minClosePosition !== undefined) {
    if (direction === 'long' && d.closePosition < filter.minClosePosition) {
      return false;
    }
    if (direction === 'short' && d.closePosition > (1 - filter.minClosePosition)) {
      return false;
    }
  }

  return true;
}

