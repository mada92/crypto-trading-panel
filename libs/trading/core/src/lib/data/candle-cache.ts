/**
 * Candle Cache Service
 *
 * Cache'uje świece OHLCV w MongoDB dla szybkiego dostępu.
 * Pobiera tylko brakujące dane z API.
 */

import { MongoClient, Db, Collection, Document } from 'mongodb';
import { OHLCV, Timeframe, timeframeToMs } from '../types/ohlcv';

/**
 * Dokument świecy w MongoDB
 */
interface CandleDocument extends Document {
  symbol: string;
  timeframe: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  createdAt: Date;
}

/**
 * Metadane zakresu dat dla symbol/timeframe
 */
interface CandleMetadata extends Document {
  symbol: string;
  timeframe: string;
  firstTimestamp: number;
  lastTimestamp: number;
  candleCount: number;
  updatedAt: Date;
}

/**
 * Konfiguracja cache
 */
export interface CandleCacheConfig {
  mongoUri: string;
  dbName?: string;
}

/**
 * Callback do raportowania postępu
 */
export type CacheProgressCallback = (message: string, progress?: number) => void;

/**
 * Serwis cache'owania świec
 */
export class CandleCache {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private candlesCollection: Collection<CandleDocument> | null = null;
  private metadataCollection: Collection<CandleMetadata> | null = null;

  constructor(private config: CandleCacheConfig) {}

  /**
   * Połącz z MongoDB
   */
  async connect(): Promise<void> {
    if (this.client) return;

    this.client = new MongoClient(this.config.mongoUri);
    await this.client.connect();
    this.db = this.client.db(this.config.dbName || 'trading');
    this.candlesCollection = this.db.collection<CandleDocument>('candles');
    this.metadataCollection = this.db.collection<CandleMetadata>('candle_metadata');
  }

  /**
   * Rozłącz z MongoDB
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
      this.candlesCollection = null;
      this.metadataCollection = null;
    }
  }

  /**
   * Sprawdź czy cache jest połączony
   */
  isConnected(): boolean {
    return this.client !== null && this.candlesCollection !== null;
  }

  /**
   * Pobierz świece z cache
   */
  async getCandles(
    symbol: string,
    timeframe: Timeframe,
    startDate: Date,
    endDate: Date
  ): Promise<OHLCV[]> {
    if (!this.candlesCollection) {
      throw new Error('Cache not connected');
    }

    const startTs = startDate.getTime();
    const endTs = endDate.getTime();

    const docs = await this.candlesCollection
      .find({
        symbol,
        timeframe,
        timestamp: { $gte: startTs, $lte: endTs },
      })
      .sort({ timestamp: 1 })
      .toArray();

    return docs.map((doc) => ({
      timestamp: doc.timestamp,
      open: doc.open,
      high: doc.high,
      low: doc.low,
      close: doc.close,
      volume: doc.volume,
    }));
  }

  /**
   * Zapisz świece do cache
   */
  async saveCandles(
    symbol: string,
    timeframe: Timeframe,
    candles: OHLCV[],
    onProgress?: CacheProgressCallback
  ): Promise<number> {
    if (!this.candlesCollection || !this.metadataCollection) {
      throw new Error('Cache not connected');
    }

    if (candles.length === 0) return 0;

    onProgress?.(`Zapisuję ${candles.length} świec do cache...`);

    // Bulk upsert dla wydajności
    const bulkOps = candles.map((candle) => ({
      updateOne: {
        filter: {
          symbol,
          timeframe,
          timestamp: candle.timestamp,
        },
        update: {
          $set: {
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            volume: candle.volume,
            createdAt: new Date(),
          },
        },
        upsert: true,
      },
    }));

    // Wykonaj w batchach po 1000
    const batchSize = 1000;
    let savedCount = 0;

    for (let i = 0; i < bulkOps.length; i += batchSize) {
      const batch = bulkOps.slice(i, i + batchSize);
      const result = await this.candlesCollection.bulkWrite(batch);
      savedCount += result.upsertedCount + result.modifiedCount;

      const progress = Math.round(((i + batch.length) / bulkOps.length) * 100);
      onProgress?.(`Zapisano ${i + batch.length}/${bulkOps.length} świec`, progress);
    }

    // Aktualizuj metadane
    const timestamps = candles.map((c) => c.timestamp);
    const firstTs = Math.min(...timestamps);
    const lastTs = Math.max(...timestamps);

    await this.metadataCollection.updateOne(
      { symbol, timeframe },
      {
        $min: { firstTimestamp: firstTs },
        $max: { lastTimestamp: lastTs },
        $inc: { candleCount: candles.length },
        $set: { updatedAt: new Date() },
      },
      { upsert: true }
    );

    onProgress?.(`✅ Zapisano ${savedCount} świec do cache`);
    return savedCount;
  }

  /**
   * Pobierz metadane zakresu dat
   */
  async getMetadata(
    symbol: string,
    timeframe: Timeframe
  ): Promise<CandleMetadata | null> {
    if (!this.metadataCollection) {
      throw new Error('Cache not connected');
    }

    return this.metadataCollection.findOne({ symbol, timeframe });
  }

  /**
   * Znajdź brakujące zakresy dat
   *
   * Zwraca tablicę zakresów [startDate, endDate] które trzeba pobrać z API
   */
  async findMissingRanges(
    symbol: string,
    timeframe: Timeframe,
    startDate: Date,
    endDate: Date
  ): Promise<Array<{ start: Date; end: Date }>> {
    if (!this.candlesCollection) {
      throw new Error('Cache not connected');
    }

    const startTs = startDate.getTime();
    const endTs = endDate.getTime();
    const intervalMs = timeframeToMs(timeframe);

    // Pobierz istniejące timestampy
    const existingDocs = await this.candlesCollection
      .find(
        {
          symbol,
          timeframe,
          timestamp: { $gte: startTs, $lte: endTs },
        },
        { projection: { timestamp: 1 } }
      )
      .sort({ timestamp: 1 })
      .toArray();

    const existingTimestamps = new Set(existingDocs.map((d) => d.timestamp));

    // Znajdź brakujące zakresy
    const missingRanges: Array<{ start: Date; end: Date }> = [];
    let currentRangeStart: number | null = null;
    let lastTs: number | null = null;

    for (let ts = startTs; ts <= endTs; ts += intervalMs) {
      if (!existingTimestamps.has(ts)) {
        // Brakuje tej świecy
        if (currentRangeStart === null) {
          currentRangeStart = ts;
        }
        lastTs = ts;
      } else {
        // Świeca istnieje - zamknij bieżący zakres
        if (currentRangeStart !== null && lastTs !== null) {
          missingRanges.push({
            start: new Date(currentRangeStart),
            end: new Date(lastTs + intervalMs - 1),
          });
          currentRangeStart = null;
          lastTs = null;
        }
      }
    }

    // Zamknij ostatni zakres
    if (currentRangeStart !== null && lastTs !== null) {
      missingRanges.push({
        start: new Date(currentRangeStart),
        end: new Date(lastTs + intervalMs - 1),
      });
    }

    return missingRanges;
  }

  /**
   * Pobierz statystyki cache
   */
  async getStats(): Promise<{
    totalCandles: number;
    symbols: string[];
    timeframes: string[];
    oldestCandle: Date | null;
    newestCandle: Date | null;
  }> {
    if (!this.candlesCollection) {
      throw new Error('Cache not connected');
    }

    const [countResult, symbolsResult, timeframesResult, oldestResult, newestResult] =
      await Promise.all([
        this.candlesCollection.countDocuments(),
        this.candlesCollection.distinct('symbol'),
        this.candlesCollection.distinct('timeframe'),
        this.candlesCollection.findOne({}, { sort: { timestamp: 1 } }),
        this.candlesCollection.findOne({}, { sort: { timestamp: -1 } }),
      ]);

    return {
      totalCandles: countResult,
      symbols: symbolsResult,
      timeframes: timeframesResult,
      oldestCandle: oldestResult ? new Date(oldestResult.timestamp) : null,
      newestCandle: newestResult ? new Date(newestResult.timestamp) : null,
    };
  }

  /**
   * Wyczyść cache dla danego symbolu/timeframe
   */
  async clearCache(symbol?: string, timeframe?: Timeframe): Promise<number> {
    if (!this.candlesCollection || !this.metadataCollection) {
      throw new Error('Cache not connected');
    }

    const filter: Record<string, string> = {};
    if (symbol) filter['symbol'] = symbol;
    if (timeframe) filter['timeframe'] = timeframe;

    const [candleResult] = await Promise.all([
      this.candlesCollection.deleteMany(filter),
      this.metadataCollection.deleteMany(filter),
    ]);

    return candleResult.deletedCount;
  }
}

/**
 * Singleton instance
 */
let cacheInstance: CandleCache | null = null;

/**
 * Pobierz singleton cache (lazy initialization)
 */
export function getCandleCache(config?: CandleCacheConfig): CandleCache {
  if (!cacheInstance) {
    const mongoUri =
      config?.mongoUri ||
      process.env['MONGODB_URI'] ||
      'mongodb://trading:trading123@localhost:27017/trading?authSource=admin';

    cacheInstance = new CandleCache({ mongoUri, dbName: config?.dbName });
  }

  return cacheInstance;
}

/**
 * Sprawdź czy MongoDB jest dostępny
 */
export async function isCacheAvailable(): Promise<boolean> {
  try {
    const cache = getCandleCache();
    await cache.connect();
    return cache.isConnected();
  } catch {
    return false;
  }
}

