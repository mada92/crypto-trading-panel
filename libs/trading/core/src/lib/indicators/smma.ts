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
 * Smoothed Moving Average (SMMA)
 * Wygładzona średnia krocząca (używana w strategii Pivot SMMA)
 */
export class SMMAIndicator implements IIndicator {
  readonly name = 'SMMA';
  readonly description = 'Smoothed Moving Average - wygładzona średnia krocząca';

  readonly parameters: ParameterDefinition[] = [
    {
      name: 'period',
      type: 'number',
      default: 33,
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
    return Math.ceil(Number(params['period']) * 2) || 66;
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
    const period = Number(params['period']) || 33;
    const source = (params['source'] as PriceSource) || 'close';

    const values = data.map((d) => getPrice(d, source));
    return calculateSMMA(values, period);
  }
}

/**
 * Oblicz SMMA dla tablicy liczb
 * SMMA = (SUM1 - SMMA1 + CLOSE) / N
 * gdzie:
 * SUM1 - suma cen zamknięcia dla N okresów
 * SMMA1 - poprzednia wartość SMMA
 * CLOSE - aktualna cena zamknięcia
 * N - okres wygładzania
 */
export function calculateSMMA(values: number[], period: number): (number | null)[] {
  const results: (number | null)[] = [];

  if (values.length < period) {
    return values.map(() => null);
  }

  // Pierwsza wartość to SMA
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += values[i];
    results.push(null);
  }

  let smma = sum / period;
  results[period - 1] = smma;

  // Oblicz resztę wartości SMMA
  for (let i = period; i < values.length; i++) {
    smma = (smma * (period - 1) + values[i]) / period;
    results.push(smma);
  }

  return results;
}
