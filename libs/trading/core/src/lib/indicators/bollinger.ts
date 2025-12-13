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
import { calculateSMA } from './sma';

/**
 * Bollinger Bands
 * Wstęgi Bollingera
 */
export class BollingerBandsIndicator implements IIndicator {
  readonly name = 'BOLLINGER';
  readonly description = 'Bollinger Bands - wstęgi Bollingera';

  readonly parameters: ParameterDefinition[] = [
    {
      name: 'period',
      type: 'number',
      default: 20,
      min: 2,
      max: 200,
      description: 'Okres średniej',
    },
    {
      name: 'stdDev',
      type: 'number',
      default: 2,
      min: 0.1,
      max: 5,
      step: 0.1,
      description: 'Mnożnik odchylenia standardowego',
    },
    {
      name: 'source',
      type: 'string',
      default: 'close',
      description: 'Źródło danych',
    },
  ];

  getRequiredPeriods(params: Record<string, number | string>): number {
    return Number(params['period']) || 20;
  }

  validate(params: Record<string, number | string>): ValidationResult {
    const errors: string[] = [];
    const period = Number(params['period']);
    const stdDev = Number(params['stdDev']);

    if (!period || period < 2) {
      errors.push('Period must be at least 2');
    }
    if (!stdDev || stdDev <= 0) {
      errors.push('Standard deviation multiplier must be positive');
    }

    return { valid: errors.length === 0, errors };
  }

  calculate(data: OHLCV[], params: Record<string, number | string>): IndicatorResult[] {
    const period = Number(params['period']) || 20;
    const stdDevMultiplier = Number(params['stdDev']) || 2;
    const source = (params['source'] as PriceSource) || 'close';

    const values = data.map((d) => getPrice(d, source));
    return calculateBollingerBands(values, period, stdDevMultiplier);
  }
}

/**
 * Oblicz odchylenie standardowe
 */
function calculateStdDev(values: number[], period: number, index: number): number | null {
  if (index < period - 1) return null;

  let sum = 0;
  let sumSquares = 0;

  for (let i = 0; i < period; i++) {
    const value = values[index - i];
    sum += value;
    sumSquares += value * value;
  }

  const mean = sum / period;
  const variance = sumSquares / period - mean * mean;

  return Math.sqrt(variance);
}

/**
 * Oblicz Bollinger Bands
 */
export function calculateBollingerBands(
  values: number[],
  period: number,
  stdDevMultiplier: number
): MultiLineIndicatorResult[] {
  const sma = calculateSMA(values, period);
  const results: MultiLineIndicatorResult[] = [];

  for (let i = 0; i < values.length; i++) {
    const middle = sma[i];

    if (middle === null) {
      results.push({
        upper: null,
        middle: null,
        lower: null,
        bandwidth: null,
        percentB: null,
      });
      continue;
    }

    const stdDev = calculateStdDev(values, period, i);

    if (stdDev === null) {
      results.push({
        upper: null,
        middle,
        lower: null,
        bandwidth: null,
        percentB: null,
      });
      continue;
    }

    const upper = middle + stdDevMultiplier * stdDev;
    const lower = middle - stdDevMultiplier * stdDev;
    const bandwidth = ((upper - lower) / middle) * 100;
    const percentB = (values[i] - lower) / (upper - lower);

    results.push({
      upper,
      middle,
      lower,
      bandwidth,
      percentB,
    });
  }

  return results;
}
