/**
 * Cached Data Provider
 *
 * Wrapper który:
 * 1. Sprawdza cache MongoDB
 * 2. Pobiera brakujące dane z Bybit
 * 3. Zapisuje do cache
 * 4. Zwraca kompletne dane
 */

import { BybitClient } from '../exchange/bybit-client';
import { CandleCache, getCandleCache, isCacheAvailable } from './candle-cache';
import { OHLCV, Timeframe } from '../types/ohlcv';

/**
 * Callback do raportowania postępu
 */
export type DataProgressCallback = (message: string, loaded?: number, total?: number) => void;

/**
 * Opcje providera
 */
export interface CachedDataProviderOptions {
  /** Wymuś pobieranie z API (ignoruj cache) */
  forceRefresh?: boolean;
  /** Użyj testnet Bybit */
  testnet?: boolean;
  /** Custom MongoDB URI */
  mongoUri?: string;
}

/**
 * Statystyki pobierania
 */
export interface FetchStats {
  fromCache: number;
  fromApi: number;
  savedToCache: number;
  totalTime: number;
}

/**
 * Pobierz dane z cache lub API
 */
export async function fetchCachedCandles(
  symbol: string,
  timeframe: Timeframe,
  startDate: Date,
  endDate: Date,
  options: CachedDataProviderOptions = {},
  onProgress?: DataProgressCallback
): Promise<{ candles: OHLCV[]; stats: FetchStats }> {
  const startTime = Date.now();
  const stats: FetchStats = {
    fromCache: 0,
    fromApi: 0,
    savedToCache: 0,
    totalTime: 0,
  };

  // Sprawdź czy cache jest dostępny
  const cacheAvailable = !options.forceRefresh && (await isCacheAvailable());

  if (cacheAvailable) {
    onProgress?.('📦 Cache MongoDB dostępny, sprawdzam dane...');

    const cache = getCandleCache(
      options.mongoUri ? { mongoUri: options.mongoUri } : undefined
    );
    await cache.connect();

    // Sprawdź jakie dane są w cache
    const cachedCandles = await cache.getCandles(symbol, timeframe, startDate, endDate);
    stats.fromCache = cachedCandles.length;

    if (cachedCandles.length > 0) {
      onProgress?.(`📦 Znaleziono ${cachedCandles.length} świec w cache`);
    }

    // Znajdź brakujące zakresy
    const missingRanges = await cache.findMissingRanges(
      symbol,
      timeframe,
      startDate,
      endDate
    );

    if (missingRanges.length === 0) {
      // Wszystkie dane w cache!
      onProgress?.(`✅ Wszystkie dane z cache (${cachedCandles.length} świec)`);
      stats.totalTime = Date.now() - startTime;
      return { candles: cachedCandles, stats };
    }

    // Pobierz brakujące dane z API
    onProgress?.(
      `🔄 Brakuje ${missingRanges.length} zakresów, pobieram z Bybit...`
    );

    const client = new BybitClient({ testnet: options.testnet || false });
    await client.connect();

    const allNewCandles: OHLCV[] = [];

    for (let i = 0; i < missingRanges.length; i++) {
      const range = missingRanges[i];
      onProgress?.(
        `🔄 Pobieram zakres ${i + 1}/${missingRanges.length}: ${range.start.toISOString().slice(0, 10)} - ${range.end.toISOString().slice(0, 10)}`
      );

      const newCandles = await client.fetchHistoricalOHLCV(
        symbol,
        timeframe,
        range.start,
        range.end,
        (loaded, total) => {
          onProgress?.(`   Pobrano ${loaded}/${total} świec`, loaded, total);
        }
      );

      allNewCandles.push(...newCandles);
      stats.fromApi += newCandles.length;
    }

    // Zapisz nowe świece do cache
    if (allNewCandles.length > 0) {
      const saved = await cache.saveCandles(symbol, timeframe, allNewCandles, (msg) =>
        onProgress?.(msg)
      );
      stats.savedToCache = saved;
    }

    // Połącz dane z cache i API
    const allCandles = [...cachedCandles, ...allNewCandles].sort(
      (a, b) => a.timestamp - b.timestamp
    );

    // Usuń duplikaty
    const uniqueCandles = allCandles.filter(
      (candle, index, self) =>
        index === self.findIndex((c) => c.timestamp === candle.timestamp)
    );

    stats.totalTime = Date.now() - startTime;
    onProgress?.(
      `✅ Gotowe: ${stats.fromCache} z cache + ${stats.fromApi} z API (${(stats.totalTime / 1000).toFixed(1)}s)`
    );

    return { candles: uniqueCandles, stats };
  } else {
    // Cache niedostępny - pobierz bezpośrednio z API
    onProgress?.('⚠️ Cache niedostępny, pobieram bezpośrednio z Bybit...');

    const client = new BybitClient({ testnet: options.testnet || false });
    await client.connect();

    const candles = await client.fetchHistoricalOHLCV(
      symbol,
      timeframe,
      startDate,
      endDate,
      (loaded, total) => {
        onProgress?.(`Pobrano ${loaded}/${total} świec`, loaded, total);
      }
    );

    stats.fromApi = candles.length;
    stats.totalTime = Date.now() - startTime;

    onProgress?.(
      `✅ Pobrano ${candles.length} świec z API (${(stats.totalTime / 1000).toFixed(1)}s)`
    );

    return { candles, stats };
  }
}

/**
 * Wyczyść cache dla danego symbolu/timeframe
 */
export async function clearCandleCache(
  symbol?: string,
  timeframe?: Timeframe
): Promise<number> {
  const cache = getCandleCache();
  await cache.connect();
  return cache.clearCache(symbol, timeframe);
}

/**
 * Pobierz statystyki cache
 */
export async function getCacheStats(): Promise<{
  available: boolean;
  totalCandles: number;
  symbols: string[];
  timeframes: string[];
  oldestCandle: Date | null;
  newestCandle: Date | null;
}> {
  const available = await isCacheAvailable();

  if (!available) {
    return {
      available: false,
      totalCandles: 0,
      symbols: [],
      timeframes: [],
      oldestCandle: null,
      newestCandle: null,
    };
  }

  const cache = getCandleCache();
  await cache.connect();
  const stats = await cache.getStats();

  return {
    available: true,
    ...stats,
  };
}

