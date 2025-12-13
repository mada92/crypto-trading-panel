import { OHLCV } from '../types/ohlcv';
import { StrategySchema } from '../types/strategy';
import { Trade, EquityPoint, Signal, Position } from '../types/trading';
import {
  BacktestConfig,
  BacktestResult,
  BacktestProgress,
  BacktestMetrics,
} from '../types/backtest';
import { StrategyExecutor, ExecutionResult } from './strategy-executor';
import { MarketSimulator } from './market-simulator';
import { calculateBacktestMetrics } from './metrics-calculator';
import { calculateATR } from '../indicators/atr';
import { randomUUID } from 'crypto';

// Użyj natywnego crypto.randomUUID dla generowania UUID
const uuidv4 = (): string => randomUUID();

/**
 * Callback dla progressu backtestu
 */
export type ProgressCallback = (progress: BacktestProgress) => void;

/**
 * Backtest Engine
 * Silnik do przeprowadzania backtestów strategii
 */
export class BacktestEngine {
  private readonly strategy: StrategySchema;
  private readonly config: BacktestConfig;
  private readonly executor: StrategyExecutor;
  private simulator: MarketSimulator;

  private equityCurve: EquityPoint[] = [];
  private currentDrawdown = 0;
  private peakEquity = 0;

  constructor(strategy: StrategySchema, config: BacktestConfig) {
    this.strategy = strategy;
    this.config = config;
    this.executor = new StrategyExecutor(strategy);
    this.simulator = new MarketSimulator(config);
  }

  /**
   * Uruchom backtest
   */
  async run(
    data: OHLCV[],
    symbol: string,
    onProgress?: ProgressCallback
  ): Promise<BacktestResult> {
    const backtestId = uuidv4();
    const startTime = Date.now();

    // Filtruj dane według zakresu dat
    const filteredData = this.filterDataByDateRange(data);

    if (filteredData.length === 0) {
      return this.createErrorResult(
        backtestId,
        'No data available for the specified date range'
      );
    }

    // Sprawdź czy mamy wystarczająco danych
    const requiredPeriods = this.executor.getRequiredPeriods();
    if (filteredData.length < requiredPeriods) {
      return this.createErrorResult(
        backtestId,
        `Insufficient data. Required: ${requiredPeriods} candles, Available: ${filteredData.length}`
      );
    }

    // Reset stanu
    this.reset();
    this.peakEquity = this.config.initialCapital;

    // Oblicz ATR dla całego zestawu danych (potrzebne do SL/TP)
    const atrPeriod = this.strategy.exitSignals.stopLoss?.atrPeriod || 14;
    const atrValues = calculateATR(filteredData, atrPeriod);

    // Wykonaj strategię na wszystkich danych
    const executionResults = this.executor.execute(filteredData, symbol);

    // Iteruj po wynikach i symuluj trading
    const totalCandles = executionResults.length;

    for (let i = requiredPeriods; i < totalCandles; i++) {
      const result = executionResults[i];
      const candle = filteredData[i];
      const atrValue = atrValues[i] as number | null;

      // Przetwórz świecę (sprawdź SL/TP)
      const closedTrades = this.simulator.processCandle(candle, symbol);

      // Jeśli zamknięto pozycję, wyczyść stan executora
      if (closedTrades.length > 0) {
        this.executor.setPosition(symbol, null);
      }

      // Przetwórz sygnał
      await this.processSignal(
        result.signal,
        candle,
        symbol,
        atrValue ?? undefined
      );

      // Zapisz punkt equity curve
      this.recordEquityPoint(candle.timestamp);

      // Raportuj progress
      if (onProgress && i % 100 === 0) {
        onProgress({
          backtestId,
          progress: Math.round(((i - requiredPeriods) / (totalCandles - requiredPeriods)) * 100),
          processedCandles: i - requiredPeriods,
          totalCandles: totalCandles - requiredPeriods,
          currentDate: new Date(candle.timestamp),
          eta: this.estimateTimeRemaining(startTime, i - requiredPeriods, totalCandles - requiredPeriods),
        });
      }
    }

    // Zamknij pozostałe pozycje na ostatniej świecy
    const lastCandle = filteredData[filteredData.length - 1];
    for (const position of this.simulator.getOpenPositions()) {
      this.simulator.closePosition(
        position,
        lastCandle.close,
        lastCandle.timestamp,
        'manual'
      );
    }

    // Oblicz metryki
    const trades = this.simulator.getTrades();
    const metrics = calculateBacktestMetrics(
      trades,
      this.equityCurve,
      this.config.initialCapital,
      filteredData[0].timestamp,
      lastCandle.timestamp
    );

    // Zwróć wynik
    return {
      id: backtestId,
      strategyId: this.strategy.id,
      strategyVersion: this.strategy.version,
      config: this.config,
      status: 'completed',
      metrics,
      trades,
      equityCurve: this.equityCurve,
      startedAt: new Date(startTime),
      completedAt: new Date(),
      duration: Date.now() - startTime,
      totalCandles: totalCandles,
      processedCandles: totalCandles - requiredPeriods,
    };
  }

  /**
   * Przetwórz sygnał
   */
  private async processSignal(
    signal: Signal,
    candle: OHLCV,
    symbol: string,
    atrValue?: number
  ): Promise<void> {
    // Sprawdź czy już mamy otwartą pozycję
    const hasPosition = this.simulator.hasOpenPosition(symbol);

    // Obsłuż sygnały wyjścia
    if (hasPosition && (signal.type === 'exit_long' || signal.type === 'exit_short')) {
      const position = this.simulator.getOpenPosition(symbol);
      if (position) {
        this.simulator.closePosition(
          position,
          signal.price,
          candle.timestamp,
          'signal'
        );
        this.executor.setPosition(symbol, null);
      }
      return;
    }

    // Obsłuż sygnały wejścia
    if (!hasPosition && (signal.type === 'entry_long' || signal.type === 'entry_short')) {
      const position = this.simulator.openPosition(
        signal,
        candle,
        symbol,
        this.strategy.exitSignals.stopLoss,
        this.strategy.exitSignals.takeProfit,
        this.strategy.exitSignals.trailingStop,
        this.strategy.riskManagement.riskPerTrade,
        atrValue
      );

      if (position) {
        this.executor.setPosition(symbol, position);
      }
    }
  }

  /**
   * Zapisz punkt equity curve
   */
  private recordEquityPoint(timestamp: number): void {
    const portfolio = this.simulator.getPortfolio();
    const equity = portfolio.equity;

    // Aktualizuj peak equity
    if (equity > this.peakEquity) {
      this.peakEquity = equity;
    }

    // Oblicz drawdown
    const drawdown = this.peakEquity - equity;
    const drawdownPercent = (drawdown / this.peakEquity) * 100;
    this.currentDrawdown = drawdownPercent;

    this.equityCurve.push({
      timestamp,
      equity,
      drawdown,
      drawdownPercent,
      openPositions: portfolio.openPositions.length,
    });
  }

  /**
   * Filtruj dane według zakresu dat
   */
  private filterDataByDateRange(data: OHLCV[]): OHLCV[] {
    const startTime = this.config.startDate.getTime();
    const endTime = this.config.endDate.getTime();

    return data.filter(
      (candle) => candle.timestamp >= startTime && candle.timestamp <= endTime
    );
  }

  /**
   * Oszacuj pozostały czas
   */
  private estimateTimeRemaining(
    startTime: number,
    processed: number,
    total: number
  ): number {
    if (processed === 0) return 0;

    const elapsed = Date.now() - startTime;
    const rate = processed / elapsed;
    const remaining = total - processed;

    return remaining / rate;
  }

  /**
   * Utwórz wynik z błędem
   */
  private createErrorResult(id: string, error: string): BacktestResult {
    return {
      id,
      strategyId: this.strategy.id,
      strategyVersion: this.strategy.version,
      config: this.config,
      status: 'failed',
      trades: [],
      equityCurve: [],
      error,
      totalCandles: 0,
      processedCandles: 0,
    };
  }

  /**
   * Reset stanu
   */
  private reset(): void {
    this.equityCurve = [];
    this.currentDrawdown = 0;
    this.peakEquity = 0;
    this.simulator.reset();
  }

  /**
   * Pobierz strategię
   */
  getStrategy(): StrategySchema {
    return this.strategy;
  }

  /**
   * Pobierz konfigurację
   */
  getConfig(): BacktestConfig {
    return this.config;
  }
}

/**
 * Utwórz i uruchom backtest
 */
export async function runBacktest(
  strategy: StrategySchema,
  config: BacktestConfig,
  data: OHLCV[],
  symbol: string,
  onProgress?: ProgressCallback
): Promise<BacktestResult> {
  const engine = new BacktestEngine(strategy, config);
  return engine.run(data, symbol, onProgress);
}
