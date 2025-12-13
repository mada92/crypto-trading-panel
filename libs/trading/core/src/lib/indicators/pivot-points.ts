import { OHLCV } from '../types/ohlcv';
import {
  IIndicator,
  IndicatorResult,
  MultiLineIndicatorResult,
  ParameterDefinition,
  ValidationResult,
} from '../types/indicator';

/**
 * Metoda obliczania Pivot Points
 */
export type PivotMethod = 'traditional' | 'fibonacci' | 'camarilla' | 'woodie' | 'demark';

/**
 * Pivot Points
 * Poziomy wsparcia i oporu
 */
export class PivotPointsIndicator implements IIndicator {
  readonly name = 'PIVOT';
  readonly description = 'Pivot Points - poziomy wsparcia i oporu';

  readonly parameters: ParameterDefinition[] = [
    {
      name: 'method',
      type: 'string',
      default: 'traditional',
      description: 'Metoda obliczania (traditional, fibonacci, camarilla, woodie, demark)',
    },
  ];

  getRequiredPeriods(): number {
    return 1; // Potrzebuje tylko poprzedniej świecy
  }

  validate(params: Record<string, number | string>): ValidationResult {
    const errors: string[] = [];
    const method = params['method'] as PivotMethod;

    const validMethods: PivotMethod[] = ['traditional', 'fibonacci', 'camarilla', 'woodie', 'demark'];
    if (method && !validMethods.includes(method)) {
      errors.push(`Invalid method. Valid options: ${validMethods.join(', ')}`);
    }

    return { valid: errors.length === 0, errors };
  }

  calculate(data: OHLCV[], params: Record<string, number | string>): IndicatorResult[] {
    const method = (params['method'] as PivotMethod) || 'traditional';
    return calculatePivotPoints(data, method);
  }
}

/**
 * Wynik Pivot Points
 */
export interface PivotPointsResult extends MultiLineIndicatorResult {
  PP: number | null;
  R1: number | null;
  R2: number | null;
  R3: number | null;
  S1: number | null;
  S2: number | null;
  S3: number | null;
}

/**
 * Oblicz Pivot Points
 */
export function calculatePivotPoints(data: OHLCV[], method: PivotMethod): PivotPointsResult[] {
  const results: PivotPointsResult[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      results.push({
        PP: null,
        R1: null,
        R2: null,
        R3: null,
        S1: null,
        S2: null,
        S3: null,
      });
      continue;
    }

    // Używamy poprzedniej świecy do obliczenia pivotów
    const prev = data[i - 1];
    const pivots = calculatePivotLevels(prev.high, prev.low, prev.close, prev.open, method);
    results.push(pivots);
  }

  return results;
}

/**
 * Oblicz poziomy Pivot dla pojedynczej świecy
 */
export function calculatePivotLevels(
  high: number,
  low: number,
  close: number,
  open: number,
  method: PivotMethod
): PivotPointsResult {
  switch (method) {
    case 'traditional':
      return calculateTraditionalPivots(high, low, close);
    case 'fibonacci':
      return calculateFibonacciPivots(high, low, close);
    case 'camarilla':
      return calculateCamarillaPivots(high, low, close);
    case 'woodie':
      return calculateWoodiePivots(high, low, close);
    case 'demark':
      return calculateDemarkPivots(high, low, close, open);
    default:
      return calculateTraditionalPivots(high, low, close);
  }
}

/**
 * Traditional Pivot Points
 */
function calculateTraditionalPivots(high: number, low: number, close: number): PivotPointsResult {
  const PP = (high + low + close) / 3;
  const R1 = 2 * PP - low;
  const S1 = 2 * PP - high;
  const R2 = PP + (high - low);
  const S2 = PP - (high - low);
  const R3 = high + 2 * (PP - low);
  const S3 = low - 2 * (high - PP);

  return { PP, R1, R2, R3, S1, S2, S3 };
}

/**
 * Fibonacci Pivot Points
 */
function calculateFibonacciPivots(high: number, low: number, close: number): PivotPointsResult {
  const PP = (high + low + close) / 3;
  const range = high - low;

  const R1 = PP + 0.382 * range;
  const R2 = PP + 0.618 * range;
  const R3 = PP + 1.0 * range;
  const S1 = PP - 0.382 * range;
  const S2 = PP - 0.618 * range;
  const S3 = PP - 1.0 * range;

  return { PP, R1, R2, R3, S1, S2, S3 };
}

/**
 * Camarilla Pivot Points
 */
function calculateCamarillaPivots(high: number, low: number, close: number): PivotPointsResult {
  const PP = (high + low + close) / 3;
  const range = high - low;

  const R1 = close + (range * 1.1) / 12;
  const R2 = close + (range * 1.1) / 6;
  const R3 = close + (range * 1.1) / 4;
  const S1 = close - (range * 1.1) / 12;
  const S2 = close - (range * 1.1) / 6;
  const S3 = close - (range * 1.1) / 4;

  return { PP, R1, R2, R3, S1, S2, S3 };
}

/**
 * Woodie Pivot Points
 */
function calculateWoodiePivots(high: number, low: number, close: number): PivotPointsResult {
  const PP = (high + low + 2 * close) / 4;

  const R1 = 2 * PP - low;
  const R2 = PP + (high - low);
  const R3 = R1 + (high - low);
  const S1 = 2 * PP - high;
  const S2 = PP - (high - low);
  const S3 = S1 - (high - low);

  return { PP, R1, R2, R3, S1, S2, S3 };
}

/**
 * DeMark Pivot Points
 */
function calculateDemarkPivots(
  high: number,
  low: number,
  close: number,
  open: number
): PivotPointsResult {
  let x: number;

  if (close < open) {
    x = high + 2 * low + close;
  } else if (close > open) {
    x = 2 * high + low + close;
  } else {
    x = high + low + 2 * close;
  }

  const PP = x / 4;
  const R1 = x / 2 - low;
  const S1 = x / 2 - high;

  return {
    PP,
    R1,
    R2: null, // DeMark nie definiuje R2/R3/S2/S3
    R3: null,
    S1,
    S2: null,
    S3: null,
  };
}
