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
 * Relative Strength Index (RSI)
 * Wskaźnik siły względnej
 */
export class RSIIndicator implements IIndicator {
  readonly name = 'RSI';
  readonly description = 'Relative Strength Index - wskaźnik siły względnej (0-100)';

  readonly parameters: ParameterDefinition[] = [
    {
      name: 'period',
      type: 'number',
      default: 14,
      min: 2,
      max: 100,
      description: 'Okres RSI',
    },
    {
      name: 'source',
      type: 'string',
      default: 'close',
      description: 'Źródło danych',
    },
  ];

  getRequiredPeriods(params: Record<string, number | string>): number {
    return Number(params['period']) + 1 || 15;
  }

  validate(params: Record<string, number | string>): ValidationResult {
    const errors: string[] = [];
    const period = Number(params['period']);

    if (!period || period < 2) {
      errors.push('Period must be at least 2');
    }
    if (period > 100) {
      errors.push('Period must not exceed 100');
    }

    return { valid: errors.length === 0, errors };
  }

  calculate(data: OHLCV[], params: Record<string, number | string>): IndicatorResult[] {
    const period = Number(params['period']) || 14;
    const source = (params['source'] as PriceSource) || 'close';

    const values = data.map((d) => getPrice(d, source));
    return calculateRSI(values, period);
  }
}

/**
 * Oblicz RSI dla tablicy liczb
 */
export function calculateRSI(values: number[], period: number): (number | null)[] {
  const results: (number | null)[] = [];

  if (values.length < period + 1) {
    return values.map(() => null);
  }

  // Oblicz zmiany cen
  const changes: number[] = [];
  for (let i = 1; i < values.length; i++) {
    changes.push(values[i] - values[i - 1]);
  }

  // Pierwsza wartość to null
  results.push(null);

  // Oblicz pierwsze średnie zysków i strat
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) {
      avgGain += changes[i];
    } else {
      avgLoss += Math.abs(changes[i]);
    }
    results.push(null);
  }

  avgGain /= period;
  avgLoss /= period;

  // Pierwsza wartość RSI
  if (avgLoss === 0) {
    results[period] = 100;
  } else {
    const rs = avgGain / avgLoss;
    results[period] = 100 - 100 / (1 + rs);
  }

  // Oblicz resztę wartości RSI (Wilder's smoothing)
  for (let i = period; i < changes.length; i++) {
    const change = changes[i];

    if (change > 0) {
      avgGain = (avgGain * (period - 1) + change) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;
    }

    if (avgLoss === 0) {
      results.push(100);
    } else {
      const rs = avgGain / avgLoss;
      results.push(100 - 100 / (1 + rs));
    }
  }

  return results;
}
