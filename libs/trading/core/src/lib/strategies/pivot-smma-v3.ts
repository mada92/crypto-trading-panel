/**
 * Pivot SMMA v3 Strategy - Single Source of Truth
 *
 * Filtr kierunku (na TF 1d):
 * - LONG: gdy cena > smma33_1d AND cena > smma144_1d (uptrend na daily)
 * - SHORT: gdy cena < smma33_1d AND cena < smma144_1d (downtrend na daily)
 *
 * Wejścia na pullback/odbicie (na głównym TF):
 * - LONG: cena < pivot.S1 (pullback do wsparcia)
 * - SHORT: cena > pivot.R1 (odbicie od oporu)
 *
 * Siatka zleceń z uśrednianiem (maxOpenPositions: 20)
 */

import { StrategySchema } from '../types/strategy';

/**
 * Pivot SMMA v3 - strategia z siatką zleceń na pivotach
 */
export const PIVOT_SMMA_V3_STRATEGY: StrategySchema = {
  id: 'pivot-smma-v3',
  version: '4.1.0',
  name: 'Pivot SMMA v4',
  description:
    'Filtr trendu na 1d (SMMA 33/144) + wejścia na pivot S1/R1',
  status: 'testing',
  dataRequirements: {
    primaryTimeframe: '4h',
    additionalTimeframes: ['1d'],
    lookbackPeriods: 200,
    symbols: ['BTCUSDT'],
  },
  indicators: [
    // ===== WSKAŹNIKI NA 1D - FILTR KIERUNKU =====
    { id: 'smma33_1d', type: 'SMMA', params: { period: 33, source: 'close' }, timeframe: '1d' },
    { id: 'smma144_1d', type: 'SMMA', params: { period: 144, source: 'close' }, timeframe: '1d' },
    
    // ===== WSKAŹNIKI NA GŁÓWNYM TF =====
    // RSI filter
    { id: 'rsi', type: 'RSI', params: { period: 14, source: 'close' } },
    // ATR dla SL/TP i volatility filter
    { id: 'atr', type: 'ATR', params: { period: 14 } },
    // Pivot Points - kluczowe dla strategii!
    { id: 'pivot', type: 'PIVOT', params: { method: 'traditional' } },
    // ADX filter - tylko gdy trend > 20
    { id: 'adx', type: 'ADX', params: { period: 14 } },
    // Volume SMA dla volume filter
    { id: 'volumeSma', type: 'VOLUME_SMA', params: { period: 20 } }
  ],
  // Computed variables
  computedVariables: [
    {
      id: 'atrPct',
      expression: 'atr / close',
      description: 'ATR jako procent ceny (volatility filter)',
    },
    {
      id: 'trendStrength',
      expression: '(smma33_1d - smma144_1d) / smma144_1d',
      description: 'Siła trendu na 1d - różnica między SMMA',
    },
  ],
  entrySignals: {
    long: {
      // LONG: cena NAD SMMA na 1d (uptrend) + pullback do pivot S1
      conditions: {
        operator: 'AND',
        conditions: [
          // FILTR KIERUNKU NA 1D: cena nad obiema średnimi (uptrend)
          { type: 'greater_than', left: 'close', right: 'smma33_1d' },
          { type: 'greater_than', left: 'close', right: 'smma144_1d' },
          // Wejście: pullback do wsparcia (cena < S1)
          { type: 'less_than', left: 'close', right: 'pivot.S1' },
          // RSI nie przekupiony
          { type: 'less_than', left: 'rsi', right: 70 },
          // RSI nie wyprzedany (momentum ok)
          { type: 'greater_than', left: 'rsi', right: 35 },
        ],
      },
      filters: {
        operator: 'AND',
        conditions: [
          // ATR volatility filter
          { type: 'greater_than', left: 'atrPct', right: 0.003 },
          { type: 'less_than', left: 'atrPct', right: 0.08 },
        ],
      },
    },
    // SHORT: cena POD SMMA na 1d (downtrend) + odbicie od pivot R1
    short: {
      conditions: {
        operator: 'AND',
        conditions: [
          // FILTR KIERUNKU NA 1D: cena pod obiema średnimi (downtrend)
          { type: 'less_than', left: 'close', right: 'smma33_1d' },
          { type: 'less_than', left: 'close', right: 'smma144_1d' },
          // Wejście: odbicie od oporu (cena > R1)
          { type: 'greater_than', left: 'close', right: 'pivot.R1' },
          // RSI nie wyprzedany
          { type: 'greater_than', left: 'rsi', right: 30 },
          // RSI nie przekupiony
          { type: 'less_than', left: 'rsi', right: 65 },
        ],
      },
      filters: {
        operator: 'AND',
        conditions: [
          { type: 'greater_than', left: 'atrPct', right: 0.003 },
          { type: 'less_than', left: 'atrPct', right: 0.08 },
        ],
      },
    },
  },
  exitSignals: {
    // Brak SL/TP - pozycje prowadzone między pivotami
    // Wyjście następuje gdy zmienia się kierunek trendu na 1d
    trailingStop: {
      enabled: false,
    },
  },
  riskManagement: {
    riskPerTrade: 0.5, // 0.5% risk per trade (mniejsze bo więcej pozycji)
    maxPositionSize: 2, // 2% max na pojedynczą pozycję
    maxOpenPositions: 20, // Siatka zleceń - do 20 pozycji
    maxDailyLoss: 10, // 10% max dzienna strata
    leverage: 5, // Leverage 5x
  },
  optimizationHints: {
    optimizableParams: [
      'indicators.smma33_1d.period',
      'indicators.smma144_1d.period',
      'riskManagement.riskPerTrade',
    ],
    objectives: ['sharpe', 'profit_factor'],
  },
};

/**
 * Prosta strategia testowa - SMA Crossover + RSI
 */
export const SMA_CROSSOVER_RSI_STRATEGY: StrategySchema = {
  id: 'sma-crossover-rsi',
  version: '1.0.0',
  name: 'SMA Crossover + RSI',
  description: 'Prosta strategia: wejście gdy SMA20 > SMA50 i RSI < 70',
  status: 'testing',
  dataRequirements: {
    primaryTimeframe: '4h',
    lookbackPeriods: 60,
    symbols: ['BTCUSDT'],
  },
  indicators: [
    { id: 'sma20', type: 'SMA', params: { period: 20, source: 'close' } },
    { id: 'sma50', type: 'SMA', params: { period: 50, source: 'close' } },
    { id: 'rsi', type: 'RSI', params: { period: 14, source: 'close' } },
    { id: 'atr', type: 'ATR', params: { period: 14 } },
  ],
  entrySignals: {
    long: {
      conditions: {
        operator: 'AND',
        conditions: [
          { type: 'greater_than', left: 'sma20', right: 'sma50' },
          { type: 'less_than', left: 'rsi', right: 70 },
          { type: 'greater_than', left: 'rsi', right: 30 },
        ],
      },
    },
    short: {
      conditions: {
        operator: 'AND',
        conditions: [
          { type: 'less_than', left: 'sma20', right: 'sma50' },
          { type: 'greater_than', left: 'rsi', right: 30 },
          { type: 'less_than', left: 'rsi', right: 70 },
        ],
      },
    },
  },
  exitSignals: {
    stopLoss: {
      type: 'atr_multiple',
      value: 2.0,
      atrPeriod: 14,
    },
    takeProfit: {
      type: 'risk_reward',
      value: 2.0,
    },
  },
  riskManagement: {
    riskPerTrade: 2,
    maxPositionSize: 10,
    maxOpenPositions: 1,
    maxDailyLoss: 5,
  },
};

/**
 * Wszystkie dostępne strategie
 */
export const BUILT_IN_STRATEGIES: StrategySchema[] = [
  PIVOT_SMMA_V3_STRATEGY,
  SMA_CROSSOVER_RSI_STRATEGY,
];

/**
 * Pobierz strategię po ID
 */
export function getBuiltInStrategy(id: string): StrategySchema | undefined {
  return BUILT_IN_STRATEGIES.find((s) => s.id === id);
}

