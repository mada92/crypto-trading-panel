// MongoDB initialization script
// Tworzy kolekcje i indeksy dla cache'owania świec

db = db.getSiblingDB('trading');

// Kolekcja świec OHLCV
db.createCollection('candles');

// Indeksy dla szybkiego wyszukiwania
db.candles.createIndex(
  { symbol: 1, timeframe: 1, timestamp: 1 },
  { unique: true, name: 'idx_symbol_timeframe_timestamp' }
);

db.candles.createIndex(
  { symbol: 1, timeframe: 1, timestamp: -1 },
  { name: 'idx_symbol_timeframe_timestamp_desc' }
);

db.candles.createIndex(
  { symbol: 1, timeframe: 1 },
  { name: 'idx_symbol_timeframe' }
);

// TTL index - usuwa stare dane po 365 dniach (opcjonalnie)
// db.candles.createIndex(
//   { createdAt: 1 },
//   { expireAfterSeconds: 365 * 24 * 60 * 60, name: 'idx_ttl' }
// );

// Kolekcja metadanych (zakres dat dla każdego symbol/timeframe)
db.createCollection('candle_metadata');

db.candle_metadata.createIndex(
  { symbol: 1, timeframe: 1 },
  { unique: true, name: 'idx_symbol_timeframe_unique' }
);

// Kolekcja strategii
db.createCollection('strategies');

db.strategies.createIndex(
  { id: 1 },
  { unique: true, name: 'idx_strategy_id' }
);

// Kolekcja wyników backtestów
db.createCollection('backtest_results');

db.backtest_results.createIndex(
  { id: 1 },
  { unique: true, name: 'idx_backtest_id' }
);

db.backtest_results.createIndex(
  { strategyId: 1, createdAt: -1 },
  { name: 'idx_strategy_created' }
);

print('✅ MongoDB initialized with collections and indexes');

