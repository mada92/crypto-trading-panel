/**
 * Pivot SMMA v3 Strategy - Single Source of Truth
 *
 * Strategia oparta na:
 * - Odbiciach od poziomów Pivot Points
 * - Filtr trendu SMMA (33/144)
 * - ADX filter (> 20)
 * - Volume filter (> SMA20)
 * - ATR volatility filter (0.8% - 4.5%)
 * - Trend threshold (0.3%)
 *
 * Ta definicja jest używana zarówno przez CLI jak i API.
 */

import { StrategySchema } from '../types/strategy';

/**
 * Pivot SMMA v3 - pełna strategia z wszystkimi filtrami
 */
export const PIVOT_SMMA_V3_STRATEGY: StrategySchema = {
  id: 'pivot-smma-v3',
  version: '3.0.0',
  name: 'Pivot SMMA v3',
  description:
    'Strategia oparta na odbiciach od poziomów Pivot Points z filtrem trendu SMMA - v3.0 z ADX, Volume, ATR filters',
  status: 'testing',
  dataRequirements: {
    primaryTimeframe: '4h',
    additionalTimeframes: ['1d'],
    lookbackPeriods: 200,
    symbols: ['BTCUSDT'],
  },
  indicators: [
    // Trend SMMA (33 i 144 jak w analizie)
    { id: 'smma33', type: 'SMMA', params: { period: 33, source: 'close' } },
    { id: 'smma144', type: 'SMMA', params: { period: 144, source: 'close' } },
    // RSI filter
    { id: 'rsi', type: 'RSI', params: { period: 14, source: 'close' } },
    // ATR dla SL/TP i volatility filter
    { id: 'atr', type: 'ATR', params: { period: 14 } },
    // Pivot Points - kluczowe dla strategii!
    { id: 'pivot', type: 'PIVOT', params: { method: 'traditional' } },
    // ADX filter - tylko gdy trend > 20
    { id: 'adx', type: 'ADX', params: { period: 14 } },
    // Volume SMA dla volume filter
    { id: 'volumeSma', type: 'VOLUME_SMA', params: { period: 20 } },
    // SMA200 - filtr długoterminowego trendu (nie shortuj w uptrend!)
    { id: 'sma200', type: 'SMA', params: { period: 200, source: 'close' } },
  ],
  // Computed variables dla trend threshold (0.3%)
  computedVariables: [
    {
      id: 'trendDiff',
      expression: '(smma33 - smma144) / smma144',
      description: 'Różnica procentowa między SMMA fast i slow',
    },
    {
      id: 'atrPct',
      expression: 'atr / close',
      description: 'ATR jako procent ceny (volatility filter)',
    },
  ],
  entrySignals: {
    long: {
      // Warunki wejścia LONG - podstawowe (najlepsza wersja)
      conditions: {
        operator: 'AND',
        conditions: [
          // Trend: SMMA33 > SMMA144 (uptrend)
          { type: 'greater_than', left: 'smma33', right: 'smma144' },
          // RSI nie przekupiony
          { type: 'less_than', left: 'rsi', right: 75 },
          // RSI nie w oversold
          { type: 'greater_than', left: 'rsi', right: 35 },
        ],
      },
      filters: {
        operator: 'AND',
        conditions: [
          // ATR volatility filter
          { type: 'greater_than', left: 'atrPct', right: 0.005 },
          { type: 'less_than', left: 'atrPct', right: 0.06 },
        ],
      },
    },
    // SHORT WYŁĄCZONY w wersji long-only dla bull marketu
    // Usuń komentarz poniżej żeby włączyć shorty w bear markecie
    /*
    short: {
      conditions: {
        operator: 'AND',
        conditions: [
          { type: 'less_than', left: 'trendDiff', right: -0.003 },
          { type: 'greater_than', left: 'rsi', right: 30 },
          { type: 'less_than', left: 'rsi', right: 70 },
          { type: 'greater_than', left: 'adx.adx', right: 20 },
          { type: 'less_than', left: 'close', right: 'sma200' },
        ],
      },
      filters: {
        operator: 'AND',
        conditions: [
          { type: 'greater_than', left: 'volume', right: 'volumeSma' },
          { type: 'greater_than', left: 'atrPct', right: 0.008 },
          { type: 'less_than', left: 'atrPct', right: 0.045 },
          { type: 'is_falling', left: 'smma33', right: 0 },
        ],
      },
    },
    */
  },
  exitSignals: {
    stopLoss: {
      type: 'atr_multiple',
      value: 1.5, // 1.5x ATR
      atrPeriod: 14,
    },
    takeProfit: {
      type: 'risk_reward',
      value: 2.0, // 2R - osiągalne target
    },
    trailingStop: {
      enabled: false, // Wyłączony - idziemy do pełnego TP
    },
  },
  riskManagement: {
    riskPerTrade: 2, // 2% risk per trade
    maxPositionSize: 5, // 5% max position
    maxOpenPositions: 1,
    maxDailyLoss: 5,
    leverage: 5, // Leverage 5x
  },
  optimizationHints: {
    optimizableParams: [
      'indicators.smma33.period',
      'indicators.smma144.period',
      'exitSignals.stopLoss.value',
      'exitSignals.takeProfit.value',
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

