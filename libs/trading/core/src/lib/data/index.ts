/**
 * Data utilities - Single Source of Truth
 */

export {
  SeededRandom,
  generateSyntheticData,
  getDefaultPrice,
  getSupportedSymbols,
  type VolatilityRegime,
  type SyntheticDataConfig,
} from './synthetic-data-generator';

export {
  aggregateOHLCV,
  getMultiTimeframeData,
  syncTimeframes,
  getHigherTfValue,
} from './ohlcv-aggregator';

export {
  calculateDynamics,
  aggregateWithDynamics,
  filterByDynamics,
  type DynamicsMetrics,
  type AggregatedCandle,
  type DynamicsFilter,
} from './market-dynamics';

export {
  CandleCache,
  getCandleCache,
  isCacheAvailable,
  type CandleCacheConfig,
  type CacheProgressCallback,
} from './candle-cache';

export {
  fetchCachedCandles,
  clearCandleCache,
  getCacheStats,
  type CachedDataProviderOptions,
  type DataProgressCallback,
  type FetchStats,
} from './cached-data-provider';

