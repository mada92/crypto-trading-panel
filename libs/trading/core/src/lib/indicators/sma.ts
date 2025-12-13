import { OHLCV } from '../types/ohlcv';
import {
  IIndicator,
  IndicatorResult,
  ParameterDefinition,
  PriceSource,
  ValidationResult,
  getPrice,
} from '../types/indicator';

/**
 * Simple Moving Average (SMA)
 * Prosta średnia krocząca
 */
export class SMAIndicator implements IIndicator {
  readonly name = 'SMA';
  readonly description = 'Simple Moving Average - prosta średnia krocząca';

  readonly parameters: ParameterDefinition[] = [
    {
      name: 'period',
      type: 'number',
      default: 20,
      min: 1,
      max: 500,
      description: 'Okres średniej',
    },
    {
      name: 'source',
      type: 'string',
      default: 'close',
      description: 'Źródło danych (open, high, low, close, hl2, hlc3, ohlc4)',
    },
  ];

  getRequiredPeriods(params: Record<string, number | string>): number {
    return Number(params['period']) || 20;
  }

  validate(params: Record<string, number | string>): ValidationResult {
    const errors: string[] = [];
    const period = Number(params['period']);

    if (!period || period < 1) {
      errors.push('Period must be at least 1');
    }
    if (period > 500) {
      errors.push('Period must not exceed 500');
    }

    return { valid: errors.length === 0, errors };
  }

  calculate(data: OHLCV[], params: Record<string, number | string>): IndicatorResult[] {
    const period = Number(params['period']) || 20;
    const source = (params['source'] as PriceSource) || 'close';
    const results: IndicatorResult[] = [];

    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        results.push(null);
        continue;
      }

      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += getPrice(data[i - j], source);
      }
      results.push(sum / period);
    }

    return results;
  }
}

/**
 * Oblicz SMA dla tablicy liczb
 */
export function calculateSMA(values: number[], period: number): (number | null)[] {
  const results: (number | null)[] = [];

  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      results.push(null);
      continue;
    }

    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += values[i - j];
    }
    results.push(sum / period);
  }

  return results;
}
