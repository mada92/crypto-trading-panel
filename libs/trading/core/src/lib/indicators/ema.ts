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
 * Exponential Moving Average (EMA)
 * Wykładnicza średnia krocząca
 */
export class EMAIndicator implements IIndicator {
  readonly name = 'EMA';
  readonly description = 'Exponential Moving Average - wykładnicza średnia krocząca';

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
      description: 'Źródło danych',
    },
  ];

  getRequiredPeriods(params: Record<string, number | string>): number {
    // EMA potrzebuje więcej danych dla stabilizacji
    return Math.ceil(Number(params['period']) * 2) || 40;
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

    const values = data.map((d) => getPrice(d, source));
    return calculateEMA(values, period);
  }
}

/**
 * Oblicz EMA dla tablicy liczb
 */
export function calculateEMA(values: number[], period: number): (number | null)[] {
  const results: (number | null)[] = [];
  const multiplier = 2 / (period + 1);

  // Pierwsza wartość to SMA
  let sum = 0;
  for (let i = 0; i < period && i < values.length; i++) {
    sum += values[i];
    results.push(null);
  }

  if (values.length < period) {
    return results;
  }

  // Ustaw pierwszą wartość EMA jako SMA
  let ema = sum / period;
  results[period - 1] = ema;

  // Oblicz resztę wartości EMA
  for (let i = period; i < values.length; i++) {
    ema = (values[i] - ema) * multiplier + ema;
    results.push(ema);
  }

  return results;
}
