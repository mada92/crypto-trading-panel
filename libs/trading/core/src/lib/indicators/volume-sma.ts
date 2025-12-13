import { OHLCV } from '../types/ohlcv';
import {
  IIndicator,
  IndicatorResult,
  ParameterDefinition,
  ValidationResult,
} from '../types/indicator';

/**
 * Volume Simple Moving Average
 * Prosta średnia krocząca wolumenu
 */
export class VolumeSMAIndicator implements IIndicator {
  readonly name = 'VOLUME_SMA';
  readonly description = 'Volume Simple Moving Average - średnia wolumenu';

  readonly parameters: ParameterDefinition[] = [
    {
      name: 'period',
      type: 'number',
      default: 20,
      min: 1,
      max: 500,
      description: 'Okres średniej',
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

  calculate(
    data: OHLCV[],
    params: Record<string, number | string>
  ): IndicatorResult[] {
    const period = Number(params['period']) || 20;
    return calculateVolumeSMA(data, period);
  }
}

/**
 * Oblicz Volume SMA
 */
export function calculateVolumeSMA(
  data: OHLCV[],
  period: number
): (number | null)[] {
  const results: (number | null)[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      results.push(null);
      continue;
    }

    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += data[j].volume;
    }
    results.push(sum / period);
  }

  return results;
}
