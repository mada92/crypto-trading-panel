import { OHLCV, Timeframe, MultiTimeframeData, buildHigherTfIndex } from '../types/ohlcv';
import {
  IndicatorDefinition,
  StrategySchema,
  ComputedVariable,
  SignalDefinition,
} from '../types/strategy';
import { Signal, Position } from '../types/trading';
import { IndicatorResult, MultiLineIndicatorResult, PriceSource, getPrice } from '../types/indicator';
import { IndicatorRegistry } from '../indicators/registry';
import { EvaluationContext, getConditionEvaluator, ConditionEvaluator } from './condition-evaluator';

/**
 * Stan executora dla każdego symbolu
 */
export interface ExecutorState {
  symbol: string;
  currentPosition: Position | null;
  indicatorCache: Map<string, IndicatorResult[]>;
  lastEvaluationContext: EvaluationContext | null;
}

/**
 * Wynik wykonania strategii dla jednej świecy
 */
export interface ExecutionResult {
  signal: Signal;
  context: EvaluationContext;
  indicators: Record<string, IndicatorResult>;
}

/**
 * Strategy Executor
 * Główny silnik wykonujący strategię na danych OHLCV
 * SSOT - Single Source of Truth dla backtestu i live tradingu
 */
export class StrategyExecutor {
  private readonly strategy: StrategySchema;
  private readonly indicatorRegistry: IndicatorRegistry;
  private readonly conditionEvaluator: ConditionEvaluator;

  private state: Map<string, ExecutorState> = new Map();

  constructor(strategy: StrategySchema) {
    this.strategy = strategy;
    this.indicatorRegistry = IndicatorRegistry.getInstance();
    this.conditionEvaluator = getConditionEvaluator();
  }

  /**
   * Wykonaj strategię na danych historycznych
   * Zwraca tablicę sygnałów dla każdej świecy
   * @param data - dane głównego timeframe'u
   * @param symbol - symbol
   * @param multiTfData - opcjonalne dane dla innych timeframe'ów
   */
  execute(
    data: OHLCV[],
    symbol: string,
    multiTfData?: MultiTimeframeData
  ): ExecutionResult[] {
    const results: ExecutionResult[] = [];
    let signalCounts = { entry_long: 0, entry_short: 0, exit_long: 0, exit_short: 0, none: 0 };

    // Inicjalizuj stan dla symbolu
    this.initializeState(symbol);

    // Oblicz wszystkie wskaźniki (z obsługą multi-timeframe)
    const indicators = this.calculateAllIndicators(data, multiTfData);
    
    console.log(`[StrategyExecutor] Calculated ${indicators.size} indicators for ${data.length} candles`);
    
    // Log indicator names and sample values
    indicators.forEach((values, id) => {
      const validValues = values.filter(v => v !== null);
      console.log(`[StrategyExecutor] Indicator ${id}: ${validValues.length}/${values.length} valid values`);
    });

    // Iteruj po wszystkich świecach
    for (let i = 0; i < data.length; i++) {
      const candle = data[i];
      const prevCandle = i > 0 ? data[i - 1] : null;

      // Zbuduj kontekst ewaluacji
      const context = this.buildEvaluationContext(
        candle,
        prevCandle,
        indicators,
        i,
        symbol
      );

      // Generuj sygnał
      const signal = this.generateSignal(context, symbol);
      signalCounts[signal.type]++;

      results.push({
        signal,
        context,
        indicators: this.getCurrentIndicatorValues(indicators, i),
      });

      // Zapisz kontekst dla następnej iteracji
      const state = this.state.get(symbol)!;
      state.lastEvaluationContext = context;
    }
    
    console.log(`[StrategyExecutor] Signal counts:`, signalCounts);

    return results;
  }

  /**
   * Wykonaj strategię dla pojedynczej świecy (live trading)
   */
  executeOne(
    currentCandle: OHLCV,
    historicalData: OHLCV[],
    symbol: string
  ): ExecutionResult {
    // Upewnij się, że mamy wystarczająco danych
    const allData = [...historicalData, currentCandle];

    // Oblicz wskaźniki
    const indicators = this.calculateAllIndicators(allData);
    const lastIndex = allData.length - 1;

    // Pobierz poprzedni kontekst
    const state = this.getOrCreateState(symbol);
    const prevCandle = historicalData[historicalData.length - 1] || null;

    // Zbuduj kontekst
    const context = this.buildEvaluationContext(
      currentCandle,
      prevCandle,
      indicators,
      lastIndex,
      symbol
    );

    // Generuj sygnał
    const signal = this.generateSignal(context, symbol);

    // Zapisz kontekst
    state.lastEvaluationContext = context;

    return {
      signal,
      context,
      indicators: this.getCurrentIndicatorValues(indicators, lastIndex),
    };
  }

  /**
   * Oblicz wszystkie wskaźniki zdefiniowane w strategii
   * Obsługuje wskaźniki na różnych timeframe'ach
   */
  private calculateAllIndicators(
    data: OHLCV[],
    multiTfData?: MultiTimeframeData
  ): Map<string, IndicatorResult[]> {
    const results = new Map<string, IndicatorResult[]>();
    const primaryTf = this.strategy.dataRequirements.primaryTimeframe;

    // Cache dla indeksów wyższych TF
    const htfIndexCache = new Map<Timeframe, (OHLCV | null)[]>();

    for (const indicatorDef of this.strategy.indicators) {
      const indicator = this.indicatorRegistry.get(indicatorDef.type);

      if (!indicator) {
        console.warn(`Indicator ${indicatorDef.type} not found in registry`);
        continue;
      }

      // Waliduj parametry
      const validation = indicator.validate(indicatorDef.params);
      if (!validation.valid) {
        console.warn(
          `Invalid parameters for ${indicatorDef.id}: ${validation.errors.join(', ')}`
        );
        continue;
      }

      // Sprawdź czy wskaźnik jest na innym timeframe
      const indicatorTf = indicatorDef.timeframe || primaryTf;
      
      if (indicatorTf !== primaryTf && multiTfData) {
        // Wskaźnik na wyższym timeframe
        const htfData = multiTfData.get(indicatorTf);
        
        if (!htfData || htfData.length === 0) {
          console.warn(`No data for timeframe ${indicatorTf} for indicator ${indicatorDef.id}`);
          // Wypełnij nullami
          results.set(indicatorDef.id, data.map(() => null));
          continue;
        }

        // Oblicz wskaźnik na danych HTF
        const htfValues = indicator.calculate(htfData, indicatorDef.params);

        // Zbuduj indeks mapowania (cache)
        if (!htfIndexCache.has(indicatorTf)) {
          htfIndexCache.set(indicatorTf, buildHigherTfIndex(data, htfData, indicatorTf));
        }
        const htfIndex = htfIndexCache.get(indicatorTf)!;

        // Mapuj wartości HTF na główny timeframe
        const mappedValues: IndicatorResult[] = [];
        for (let i = 0; i < data.length; i++) {
          const htfCandle = htfIndex[i];
          if (htfCandle) {
            // Znajdź indeks tej świecy w htfData
            const htfCandleIndex = htfData.findIndex(c => c.timestamp === htfCandle.timestamp);
            if (htfCandleIndex >= 0 && htfCandleIndex < htfValues.length) {
              mappedValues.push(htfValues[htfCandleIndex]);
            } else {
              mappedValues.push(null);
            }
          } else {
            mappedValues.push(null);
          }
        }

        results.set(indicatorDef.id, mappedValues);
        console.log(`[StrategyExecutor] Indicator ${indicatorDef.id} calculated on ${indicatorTf} and mapped to ${primaryTf}`);
      } else {
        // Wskaźnik na głównym timeframe
        const values = indicator.calculate(data, indicatorDef.params);
        results.set(indicatorDef.id, values);
      }
    }

    return results;
  }

  /**
   * Zbuduj kontekst ewaluacji dla danej świecy
   */
  private buildEvaluationContext(
    candle: OHLCV,
    prevCandle: OHLCV | null,
    indicators: Map<string, IndicatorResult[]>,
    index: number,
    symbol: string
  ): EvaluationContext {
    const state = this.state.get(symbol);

    // Pobierz wartości wskaźników
    const indicatorValues: Record<
      string,
      number | Record<string, number | null> | null
    > = {};

    indicators.forEach((values, id) => {
      const value = values[index];
      if (value === null || value === undefined) {
        indicatorValues[id] = null;
      } else if (typeof value === 'number') {
        indicatorValues[id] = value;
      } else {
        // MultiLineIndicatorResult
        indicatorValues[id] = value as Record<string, number | null>;
      }
    });

    // Oblicz zmienne
    const variables = this.calculateVariables(indicatorValues, candle);

    // Kontekst
    const context: EvaluationContext = {
      indicators: indicatorValues,
      variables,
      price: {
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
      },
    };

    // Dodaj poprzedni kontekst jeśli dostępny
    if (state?.lastEvaluationContext) {
      context.previous = {
        indicators: state.lastEvaluationContext.indicators,
        variables: state.lastEvaluationContext.variables,
        price: state.lastEvaluationContext.price,
      };
    } else if (prevCandle && index > 0) {
      // Zbuduj poprzedni kontekst z poprzedniej świecy
      const prevIndicatorValues: Record<
        string,
        number | Record<string, number | null> | null
      > = {};

      indicators.forEach((values, id) => {
        const value = values[index - 1];
        if (value === null || value === undefined) {
          prevIndicatorValues[id] = null;
        } else if (typeof value === 'number') {
          prevIndicatorValues[id] = value;
        } else {
          prevIndicatorValues[id] = value as Record<string, number | null>;
        }
      });

      context.previous = {
        indicators: prevIndicatorValues,
        variables: this.calculateVariables(prevIndicatorValues, prevCandle),
        price: {
          open: prevCandle.open,
          high: prevCandle.high,
          low: prevCandle.low,
          close: prevCandle.close,
          volume: prevCandle.volume,
        },
      };
    }

    return context;
  }

  /**
   * Oblicz zmienne zdefiniowane w strategii
   */
  private calculateVariables(
    indicators: Record<string, number | Record<string, number | null> | null>,
    candle: OHLCV
  ): Record<string, number | null> {
    const variables: Record<string, number | null> = {};

    if (!this.strategy.computedVariables) {
      return variables;
    }

    for (const varDef of this.strategy.computedVariables) {
      try {
        // Prosta ewaluacja wyrażeń (w produkcji użylibyśmy parsera)
        const value = this.evaluateExpression(varDef.expression, indicators, candle);
        variables[varDef.id] = value;
      } catch (error) {
        console.warn(`Failed to evaluate variable ${varDef.id}: ${error}`);
        variables[varDef.id] = null;
      }
    }

    return variables;
  }

  /**
   * Prosta ewaluacja wyrażeń (uproszczona wersja)
   */
  private evaluateExpression(
    expression: string,
    indicators: Record<string, number | Record<string, number | null> | null>,
    candle: OHLCV
  ): number | null {
    // Zamień referencje na wartości
    let expr = expression;

    // Zamień ceny
    expr = expr.replace(/\bclose\b/g, candle.close.toString());
    expr = expr.replace(/\bopen\b/g, candle.open.toString());
    expr = expr.replace(/\bhigh\b/g, candle.high.toString());
    expr = expr.replace(/\blow\b/g, candle.low.toString());

    // Zamień wskaźniki
    for (const [id, value] of Object.entries(indicators)) {
      if (typeof value === 'number') {
        expr = expr.replace(new RegExp(`\\b${id}\\b`, 'g'), value.toString());
      } else if (value && typeof value === 'object') {
        for (const [prop, val] of Object.entries(value)) {
          if (val !== null) {
            expr = expr.replace(
              new RegExp(`\\b${id}\\.${prop}\\b`, 'g'),
              val.toString()
            );
          }
        }
      }
    }

    // Ewaluuj wyrażenie (w produkcji użylibyśmy bezpiecznego parsera)
    try {
      // eslint-disable-next-line no-eval
      const result = eval(expr);
      return typeof result === 'number' && !isNaN(result) ? result : null;
    } catch {
      return null;
    }
  }

  /**
   * Generuj sygnał na podstawie kontekstu
   */
  private generateSignal(context: EvaluationContext, symbol: string): Signal {
    const state = this.getOrCreateState(symbol);
    const hasPosition = state.currentPosition !== null;
    const positionSide = state.currentPosition?.side;

    // Sprawdź sygnały wyjścia jeśli mamy pozycję
    if (hasPosition) {
      // Sprawdź sygnał wyjścia
      if (this.strategy.exitSignals.signalExit) {
        const shouldExit = this.conditionEvaluator.evaluateGroup(
          this.strategy.exitSignals.signalExit.conditions,
          context
        );

        if (shouldExit) {
          return {
            type: positionSide === 'long' ? 'exit_long' : 'exit_short',
            price: context.price.close,
            timestamp: Date.now(),
            reason: 'signal',
          };
        }
      }
    }

    // Sprawdź sygnały wejścia LONG
    if (!hasPosition && this.strategy.entrySignals.long) {
      const shouldEnterLong = this.evaluateEntrySignal(
        this.strategy.entrySignals.long,
        context
      );

      if (shouldEnterLong) {
        return {
          type: 'entry_long',
          price: context.price.close,
          timestamp: Date.now(),
          reason: 'entry_signal',
        };
      }
    }

    // Sprawdź sygnały wejścia SHORT
    if (!hasPosition && this.strategy.entrySignals.short) {
      const shouldEnterShort = this.evaluateEntrySignal(
        this.strategy.entrySignals.short,
        context
      );

      if (shouldEnterShort) {
        return {
          type: 'entry_short',
          price: context.price.close,
          timestamp: Date.now(),
          reason: 'entry_signal',
        };
      }
    }

    return {
      type: 'none',
      price: context.price.close,
      timestamp: Date.now(),
    };
  }

  /**
   * Ewaluuj sygnał wejścia
   */
  private evaluateEntrySignal(
    signal: SignalDefinition,
    context: EvaluationContext
  ): boolean {
    // Sprawdź warunki główne
    const conditionsMet = this.conditionEvaluator.evaluateGroup(
      signal.conditions,
      context
    );

    if (!conditionsMet) {
      return false;
    }

    // Sprawdź filtry jeśli zdefiniowane
    if (signal.filters) {
      const filtersMet = this.conditionEvaluator.evaluateGroup(
        signal.filters,
        context
      );

      if (!filtersMet) {
        return false;
      }
    }

    return true;
  }

  /**
   * Pobierz bieżące wartości wskaźników
   */
  private getCurrentIndicatorValues(
    indicators: Map<string, IndicatorResult[]>,
    index: number
  ): Record<string, IndicatorResult> {
    const values: Record<string, IndicatorResult> = {};

    indicators.forEach((results, id) => {
      values[id] = results[index] ?? null;
    });

    return values;
  }

  /**
   * Inicjalizuj stan dla symbolu
   */
  private initializeState(symbol: string): void {
    this.state.set(symbol, {
      symbol,
      currentPosition: null,
      indicatorCache: new Map(),
      lastEvaluationContext: null,
    });
  }

  /**
   * Pobierz lub utwórz stan dla symbolu
   */
  private getOrCreateState(symbol: string): ExecutorState {
    if (!this.state.has(symbol)) {
      this.initializeState(symbol);
    }
    return this.state.get(symbol)!;
  }

  /**
   * Ustaw aktualną pozycję (dla synchronizacji stanu)
   */
  setPosition(symbol: string, position: Position | null): void {
    const state = this.getOrCreateState(symbol);
    state.currentPosition = position;
  }

  /**
   * Pobierz aktualną pozycję
   */
  getPosition(symbol: string): Position | null {
    return this.state.get(symbol)?.currentPosition ?? null;
  }

  /**
   * Pobierz wymaganą liczbę świec dla strategii
   */
  getRequiredPeriods(): number {
    let maxPeriod = this.strategy.dataRequirements.lookbackPeriods;

    for (const indicatorDef of this.strategy.indicators) {
      const indicator = this.indicatorRegistry.get(indicatorDef.type);
      if (indicator) {
        const required = indicator.getRequiredPeriods(indicatorDef.params);
        maxPeriod = Math.max(maxPeriod, required);
      }
    }

    return maxPeriod;
  }

  /**
   * Pobierz schemat strategii
   */
  getStrategy(): StrategySchema {
    return this.strategy;
  }
}
