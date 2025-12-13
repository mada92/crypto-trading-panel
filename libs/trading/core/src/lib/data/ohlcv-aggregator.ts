/**
 * OHLCV Aggregator - Single Source of Truth
 *
 * Agreguje dane z niższego timeframe'u do wyższego.
 * Np. 1m → 5m, 15m, 1h, 4h, 1d
 */

import { OHLCV } from '../types/ohlcv';
import { Timeframe, timeframeToMs } from '../types/ohlcv';

/**
 * Agreguj dane OHLCV do wyższego timeframe'u
 *
 * @param data - Dane źródłowe (np. 1m)
 * @param sourceTimeframe - Timeframe źródłowy (np. '1m')
 * @param targetTimeframe - Timeframe docelowy (np. '4h')
 * @returns Zagregowane dane OHLCV
 */
export function aggregateOHLCV(
  data: OHLCV[],
  sourceTimeframe: Timeframe,
  targetTimeframe: Timeframe
): OHLCV[] {
  if (data.length === 0) return [];

  const sourceMs = timeframeToMs(sourceTimeframe);
  const targetMs = timeframeToMs(targetTimeframe);

  if (targetMs <= sourceMs) {
    console.warn(
      `Target timeframe (${targetTimeframe}) must be higher than source (${sourceTimeframe})`
    );
    return data;
  }

  const candlesPerPeriod = Math.round(targetMs / sourceMs);
  const result: OHLCV[] = [];

  // Grupuj świece po okresie docelowym
  let currentPeriodStart = Math.floor(data[0].timestamp / targetMs) * targetMs;
  let periodCandles: OHLCV[] = [];

  for (const candle of data) {
    const candlePeriodStart = Math.floor(candle.timestamp / targetMs) * targetMs;

    if (candlePeriodStart !== currentPeriodStart && periodCandles.length > 0) {
      // Zamknij poprzedni okres
      result.push(aggregatePeriod(periodCandles, currentPeriodStart));
      periodCandles = [];
      currentPeriodStart = candlePeriodStart;
    }

    periodCandles.push(candle);
  }

  // Ostatni okres
  if (periodCandles.length > 0) {
    result.push(aggregatePeriod(periodCandles, currentPeriodStart));
  }

  return result;
}

/**
 * Agreguj pojedynczy okres
 */
function aggregatePeriod(candles: OHLCV[], periodStart: number): OHLCV {
  const open = candles[0].open;
  const close = candles[candles.length - 1].close;
  const high = Math.max(...candles.map((c) => c.high));
  const low = Math.min(...candles.map((c) => c.low));
  const volume = candles.reduce((sum, c) => sum + c.volume, 0);

  return {
    timestamp: periodStart,
    open,
    high,
    low,
    close,
    volume,
  };
}

/**
 * Pobierz dane dla wielu timeframe'ów z danych bazowych
 */
export function getMultiTimeframeData(
  baseData: OHLCV[],
  baseTimeframe: Timeframe,
  targetTimeframes: Timeframe[]
): Map<Timeframe, OHLCV[]> {
  const result = new Map<Timeframe, OHLCV[]>();

  for (const tf of targetTimeframes) {
    if (tf === baseTimeframe) {
      result.set(tf, baseData);
    } else {
      result.set(tf, aggregateOHLCV(baseData, baseTimeframe, tf));
    }
  }

  return result;
}

/**
 * Synchronizuj dane między timeframe'ami
 * Zwraca indeksy świec niższego TF które odpowiadają świecom wyższego TF
 */
export function syncTimeframes(
  lowerTfData: OHLCV[],
  higherTfData: OHLCV[],
  lowerTf: Timeframe,
  higherTf: Timeframe
): Map<number, number> {
  const higherMs = timeframeToMs(higherTf);
  const syncMap = new Map<number, number>();

  for (let i = 0; i < lowerTfData.length; i++) {
    const lowerCandle = lowerTfData[i];
    const higherPeriodStart =
      Math.floor(lowerCandle.timestamp / higherMs) * higherMs;

    // Znajdź odpowiadającą świecę wyższego TF
    const higherIndex = higherTfData.findIndex(
      (c) => c.timestamp === higherPeriodStart
    );

    if (higherIndex !== -1) {
      syncMap.set(i, higherIndex);
    }
  }

  return syncMap;
}

/**
 * Pobierz wartość wskaźnika z wyższego TF dla danej świecy niższego TF
 */
export function getHigherTfValue<T>(
  lowerIndex: number,
  syncMap: Map<number, number>,
  higherTfValues: T[]
): T | null {
  const higherIndex = syncMap.get(lowerIndex);
  if (higherIndex === undefined || higherIndex >= higherTfValues.length) {
    return null;
  }
  return higherTfValues[higherIndex];
}

