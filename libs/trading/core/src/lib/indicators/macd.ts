import { OHLCV } from '../types/ohlcv';
import {
  IIndicator,
  IndicatorResult,
  MultiLineIndicatorResult,
  ParameterDefinition,
  PriceSource,
  ValidationResult,
  getPrice,
} from '../types/indicator';
import { calculateEMA } from './ema';

/**
 * MACD - Moving Average Convergence Divergence
 */
export class MACDIndicator implements IIndicator {
  readonly name = 'MACD';
  readonly description = 'Moving Average Convergence Divergence';

  readonly parameters: ParameterDefinition[] = [
    {
      name: 'fastPeriod',
      type: 'number',
      default: 12,
      min: 1,
      max: 100,
      description: 'Okres szybkiej EMA',
    },
    {
      name: 'slowPeriod',
      type: 'number',
      default: 26,
      min: 1,
      max: 200,
      description: 'Okres wolnej EMA',
    },
    {
      name: 'signalPeriod',
      type: 'number',
      default: 9,
      min: 1,
      max: 50,
      description: 'Okres linii sygnału',
    },
    {
      name: 'source',
      type: 'string',
      default: 'close',
      description: 'Źródło danych',
    },
  ];

  getRequiredPeriods(params: Record<string, number | string>): number {
    const slowPeriod = Number(params['slowPeriod']) || 26;
    const signalPeriod = Number(params['signalPeriod']) || 9;
    return slowPeriod + signalPeriod;
  }

  validate(params: Record<string, number | string>): ValidationResult {
    const errors: string[] = [];
    const fastPeriod = Number(params['fastPeriod']);
    const slowPeriod = Number(params['slowPeriod']);
    const signalPeriod = Number(params['signalPeriod']);

    if (!fastPeriod || fastPeriod < 1) {
      errors.push('Fast period must be at least 1');
    }
    if (!slowPeriod || slowPeriod < 1) {
      errors.push('Slow period must be at least 1');
    }
    if (fastPeriod >= slowPeriod) {
      errors.push('Fast period must be less than slow period');
    }
    if (!signalPeriod || signalPeriod < 1) {
      errors.push('Signal period must be at least 1');
    }

    return { valid: errors.length === 0, errors };
  }

  calculate(data: OHLCV[], params: Record<string, number | string>): IndicatorResult[] {
    const fastPeriod = Number(params['fastPeriod']) || 12;
    const slowPeriod = Number(params['slowPeriod']) || 26;
    const signalPeriod = Number(params['signalPeriod']) || 9;
    const source = (params['source'] as PriceSource) || 'close';

    const values = data.map((d) => getPrice(d, source));
    return calculateMACD(values, fastPeriod, slowPeriod, signalPeriod);
  }
}

/**
 * Oblicz MACD
 */
export function calculateMACD(
  values: number[],
  fastPeriod: number,
  slowPeriod: number,
  signalPeriod: number
): MultiLineIndicatorResult[] {
  const fastEMA = calculateEMA(values, fastPeriod);
  const slowEMA = calculateEMA(values, slowPeriod);

  // Oblicz linię MACD
  const macdLine: (number | null)[] = [];
  for (let i = 0; i < values.length; i++) {
    if (fastEMA[i] === null || slowEMA[i] === null) {
      macdLine.push(null);
    } else {
      macdLine.push(fastEMA[i]! - slowEMA[i]!);
    }
  }

  // Oblicz linię sygnału (EMA z MACD)
  const nonNullMacd = macdLine.filter((v) => v !== null) as number[];
  const signalEMA = calculateEMA(
    nonNullMacd.map((v) => v),
    signalPeriod
  );

  // Uzupełnij signal line
  const signalLine: (number | null)[] = [];
  let signalIdx = 0;
  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] === null) {
      signalLine.push(null);
    } else {
      signalLine.push(signalEMA[signalIdx++] ?? null);
    }
  }

  // Oblicz histogram
  const results: MultiLineIndicatorResult[] = [];
  for (let i = 0; i < values.length; i++) {
    const macd = macdLine[i];
    const signal = signalLine[i];
    const histogram = macd !== null && signal !== null ? macd - signal : null;

    results.push({
      macd,
      signal,
      histogram,
    });
  }

  return results;
}
