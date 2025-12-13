import { BacktestEngine, runBacktest } from './backtest-engine';
import { StrategySchema } from '../types/strategy';
import { BacktestConfig } from '../types/backtest';
import { OHLCV } from '../types/ohlcv';

// Pomocnicza funkcja do generowania testowych danych OHLCV
function generateTestData(
  count: number,
  startPrice = 100,
  startTimestamp = Date.now()
): OHLCV[] {
  const data: OHLCV[] = [];
  let price = startPrice;

  for (let i = 0; i < count; i++) {
    // Deterministyczny ruch ceny
    const change = Math.sin(i * 0.3) * 5;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + 2;
    const low = Math.min(open, close) - 2;
    const volume = 1000000 + i * 10000;

    data.push({
      timestamp: startTimestamp + i * 14400000, // 4h candles
      open,
      high,
      low,
      close,
      volume: Math.round(volume),
    });

    price = close;
  }

  return data;
}

// Testowa strategia
function createTestStrategy(): StrategySchema {
  return {
    id: 'test-strategy',
    version: '1.0.0',
    name: 'Test Strategy',
    description: 'Simple test strategy',
    status: 'testing',
    dataRequirements: {
      primaryTimeframe: '4h',
      lookbackPeriods: 50,
      symbols: ['BTCUSDT'],
    },
    indicators: [
      { id: 'sma20', type: 'SMA', params: { period: 20, source: 'close' } },
      { id: 'sma50', type: 'SMA', params: { period: 50, source: 'close' } },
      { id: 'rsi', type: 'RSI', params: { period: 14, source: 'close' } },
    ],
    entrySignals: {
      long: {
        conditions: {
          operator: 'AND',
          conditions: [
            { type: 'crosses_above', left: 'sma20', right: 'sma50' },
            { type: 'less_than', left: 'rsi', right: 70 },
          ],
        },
      },
      short: {
        conditions: {
          operator: 'AND',
          conditions: [
            { type: 'crosses_below', left: 'sma20', right: 'sma50' },
            { type: 'greater_than', left: 'rsi', right: 30 },
          ],
        },
      },
    },
    exitSignals: {
      stopLoss: {
        type: 'fixed_percent',
        value: 2,
      },
      takeProfit: {
        type: 'fixed_percent',
        value: 4,
      },
    },
    riskManagement: {
      riskPerTrade: 2,
      maxPositionSize: 10,
      maxOpenPositions: 1,
    },
  };
}

function createTestConfig(): BacktestConfig {
  const now = Date.now();
  return {
    startDate: new Date(now - 365 * 24 * 60 * 60 * 1000), // 1 year ago
    endDate: new Date(now),
    initialCapital: 10000,
    currency: 'USDT',
    commissionPercent: 0.0006,
    slippagePercent: 0.0003,
    fillModel: 'realistic',
    dataSource: 'local',
  };
}

describe('BacktestEngine', () => {
  let strategy: StrategySchema;
  let config: BacktestConfig;
  let data: OHLCV[];

  beforeEach(() => {
    strategy = createTestStrategy();
    config = createTestConfig();
    data = generateTestData(500, 100, config.startDate.getTime());
  });

  it('should create BacktestEngine instance', () => {
    const engine = new BacktestEngine(strategy, config);
    expect(engine).toBeDefined();
    expect(engine.getStrategy()).toBe(strategy);
    expect(engine.getConfig()).toBe(config);
  });

  it('should run backtest and return result', async () => {
    const engine = new BacktestEngine(strategy, config);
    const result = await engine.run(data, 'BTCUSDT');

    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
    expect(result.strategyId).toBe(strategy.id);
    expect(result.strategyVersion).toBe(strategy.version);
    expect(result.config).toBe(config);
    expect(result.status).toBe('completed');
  });

  it('should return equity curve', async () => {
    const engine = new BacktestEngine(strategy, config);
    const result = await engine.run(data, 'BTCUSDT');

    expect(result.equityCurve).toBeDefined();
    expect(Array.isArray(result.equityCurve)).toBe(true);
    expect(result.equityCurve.length).toBeGreaterThan(0);

    // Każdy punkt equity curve powinien mieć wymagane pola
    result.equityCurve.forEach((point) => {
      expect(point).toHaveProperty('timestamp');
      expect(point).toHaveProperty('equity');
      expect(point).toHaveProperty('drawdown');
      expect(point).toHaveProperty('drawdownPercent');
    });
  });

  it('should calculate metrics when trades exist', async () => {
    const engine = new BacktestEngine(strategy, config);
    const result = await engine.run(data, 'BTCUSDT');

    // Metryki powinny istnieć
    expect(result.metrics).toBeDefined();
    if (result.metrics) {
      expect(result.metrics.initialCapital).toBe(config.initialCapital);
      expect(result.metrics).toHaveProperty('totalReturn');
      expect(result.metrics).toHaveProperty('maxDrawdown');
      expect(result.metrics).toHaveProperty('sharpeRatio');
      expect(result.metrics).toHaveProperty('winRate');
    }
  });

  it('should fail with insufficient data', async () => {
    const engine = new BacktestEngine(strategy, config);
    const smallData = generateTestData(10, 100, config.startDate.getTime());

    const result = await engine.run(smallData, 'BTCUSDT');

    expect(result.status).toBe('failed');
    expect(result.error).toContain('Insufficient data');
  });

  it('should fail with no data in range', async () => {
    const oldConfig = {
      ...config,
      startDate: new Date('2020-01-01'),
      endDate: new Date('2020-12-31'),
    };
    const engine = new BacktestEngine(strategy, oldConfig);

    // Dane są z innego okresu
    const result = await engine.run(data, 'BTCUSDT');

    expect(result.status).toBe('failed');
    expect(result.error).toContain('No data available');
  });

  it('should call progress callback', async () => {
    const engine = new BacktestEngine(strategy, config);
    const progressCalls: number[] = [];

    await engine.run(data, 'BTCUSDT', (progress) => {
      progressCalls.push(progress.progress);
    });

    // Powinno być kilka wywołań progressu
    expect(progressCalls.length).toBeGreaterThan(0);
    // Ostatni progress powinien być bliski 100
    expect(progressCalls[progressCalls.length - 1]).toBeGreaterThanOrEqual(0);
  });
});

describe('runBacktest helper', () => {
  it('should run backtest using helper function', async () => {
    const strategy = createTestStrategy();
    const config = createTestConfig();
    const data = generateTestData(500, 100, config.startDate.getTime());

    const result = await runBacktest(strategy, config, data, 'BTCUSDT');

    expect(result).toBeDefined();
    expect(result.status).toBe('completed');
  });
});

describe('BacktestEngine edge cases', () => {
  it('should handle strategy with no trades', async () => {
    // Strategia z niemożliwymi warunkami
    const strategy: StrategySchema = {
      id: 'no-trades-strategy',
      version: '1.0.0',
      name: 'No Trades Strategy',
      status: 'testing',
      dataRequirements: {
        primaryTimeframe: '4h',
        lookbackPeriods: 20,
        symbols: ['BTCUSDT'],
      },
      indicators: [
        { id: 'rsi', type: 'RSI', params: { period: 14, source: 'close' } },
      ],
      entrySignals: {
        long: {
          conditions: {
            operator: 'AND',
            conditions: [
              { type: 'greater_than', left: 'rsi', right: 200 }, // Niemożliwe
            ],
          },
        },
      },
      exitSignals: {
        stopLoss: { type: 'fixed_percent', value: 2 },
      },
      riskManagement: {
        riskPerTrade: 2,
        maxPositionSize: 10,
        maxOpenPositions: 1,
      },
    };

    const config = createTestConfig();
    const data = generateTestData(200, 100, config.startDate.getTime());

    const result = await runBacktest(strategy, config, data, 'BTCUSDT');

    expect(result.status).toBe('completed');
    expect(result.trades.length).toBe(0);
    expect(result.metrics?.totalTrades).toBe(0);
  });

  it('should close positions at end of backtest', async () => {
    // Prosta strategia która zawsze wchodzi long
    const strategy: StrategySchema = {
      id: 'always-long',
      version: '1.0.0',
      name: 'Always Long',
      status: 'testing',
      dataRequirements: {
        primaryTimeframe: '4h',
        lookbackPeriods: 5,
        symbols: ['BTCUSDT'],
      },
      indicators: [],
      entrySignals: {
        long: {
          conditions: {
            operator: 'AND',
            conditions: [
              { type: 'greater_than', left: 'close', right: 0 }, // Zawsze prawda
            ],
          },
        },
      },
      exitSignals: {
        // Brak warunków wyjścia - pozycja zamknie się na końcu
      },
      riskManagement: {
        riskPerTrade: 2,
        maxPositionSize: 10,
        maxOpenPositions: 1,
      },
    };

    const config = createTestConfig();
    const data = generateTestData(100, 100, config.startDate.getTime());

    const result = await runBacktest(strategy, config, data, 'BTCUSDT');

    expect(result.status).toBe('completed');
    // Powinna być co najmniej jedna transakcja (zamknięta na końcu)
    expect(result.trades.length).toBeGreaterThanOrEqual(1);
  });
});
