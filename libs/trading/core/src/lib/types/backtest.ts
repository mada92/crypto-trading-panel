import { EquityPoint, Trade } from './trading';

/**
 * Konfiguracja backtestu
 */
export interface BacktestConfig {
  // Zakres czasowy
  startDate: Date;
  endDate: Date;

  // Kapitał
  initialCapital: number;
  currency: string;

  // Koszty
  commissionPercent: number; // np. 0.0006 = 0.06%
  slippagePercent: number; // np. 0.0003 = 0.03%

  // Model wypełnienia zleceń
  fillModel: 'optimistic' | 'pessimistic' | 'realistic';

  // Źródło danych
  dataSource: 'local' | 'exchange';
}

/**
 * Status backtestu
 */
export type BacktestStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * Metryki backtestu
 */
export interface BacktestMetrics {
  // Zwroty
  totalReturn: number; // %
  totalReturnAbsolute: number; // $
  cagr: number; // Compound Annual Growth Rate
  monthlyAvgReturn: number;

  // Ryzyko
  maxDrawdown: number; // %
  maxDrawdownAbsolute: number; // $
  maxDrawdownDuration: number; // Czas trwania w dniach
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  volatility: number; // Annualized

  // Trading
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number; // %
  profitFactor: number;
  avgWin: number; // %
  avgLoss: number; // %
  avgTrade: number; // %
  largestWin: number;
  largestLoss: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;

  // Ekspozycja
  longTrades: number;
  shortTrades: number;
  longWinRate: number;
  shortWinRate: number;
  avgHoldingTime: number; // W minutach
  timeInMarket: number; // % czasu z otwartą pozycją

  // Kapitał
  initialCapital: number;
  finalCapital: number;
  peakCapital: number;
  totalCommission: number;
}

/**
 * Wynik backtestu
 */
export interface BacktestResult {
  id: string;
  strategyId: string;
  strategyVersion: string;
  config: BacktestConfig;
  status: BacktestStatus;

  // Wyniki
  metrics?: BacktestMetrics;
  trades: Trade[];
  equityCurve: EquityPoint[];

  // Metadata
  startedAt?: Date;
  completedAt?: Date;
  duration?: number; // ms
  error?: string;

  // Statystyki wykonania
  totalCandles: number;
  processedCandles: number;
}

/**
 * Progress backtestu (dla WebSocket)
 */
export interface BacktestProgress {
  backtestId: string;
  progress: number; // 0-100
  processedCandles: number;
  totalCandles: number;
  currentDate?: Date;
  eta?: number; // Estimated time remaining in ms
}

/**
 * Miesięczny zwrot
 */
export interface MonthlyReturn {
  year: number;
  month: number;
  return: number;
  trades: number;
}

/**
 * Statystyki rozkładu trade'ów
 */
export interface TradeDistribution {
  byHour: Record<number, { trades: number; winRate: number; avgPnl: number }>;
  byDayOfWeek: Record<number, { trades: number; winRate: number; avgPnl: number }>;
  byMonth: Record<number, { trades: number; winRate: number; avgPnl: number }>;
}
