import { OHLCV } from '../types/ohlcv';
import { IIndicator, IndicatorResult, ParameterDefinition, ValidationResult } from '../types/indicator';

/**
 * Average True Range (ATR)
 * Średni prawdziwy zakres - miara zmienności
 */
export class ATRIndicator implements IIndicator {
  readonly name = 'ATR';
  readonly description = 'Average True Range - średni prawdziwy zakres (zmienność)';

  readonly parameters: ParameterDefinition[] = [
    {
      name: 'period',
      type: 'number',
      default: 14,
      min: 1,
      max: 100,
      description: 'Okres ATR',
    },
  ];

  getRequiredPeriods(params: Record<string, number | string>): number {
    return Number(params['period']) + 1 || 15;
  }

  validate(params: Record<string, number | string>): ValidationResult {
    const errors: string[] = [];
    const period = Number(params['period']);

    if (!period || period < 1) {
      errors.push('Period must be at least 1');
    }
    if (period > 100) {
      errors.push('Period must not exceed 100');
    }

    return { valid: errors.length === 0, errors };
  }

  calculate(data: OHLCV[], params: Record<string, number | string>): IndicatorResult[] {
    const period = Number(params['period']) || 14;
    return calculateATR(data, period);
  }
}

/**
 * Oblicz True Range dla pojedynczej świecy
 */
export function calculateTrueRange(current: OHLCV, previous: OHLCV | null): number {
  if (!previous) {
    return current.high - current.low;
  }

  const highLow = current.high - current.low;
  const highClose = Math.abs(current.high - previous.close);
  const lowClose = Math.abs(current.low - previous.close);

  return Math.max(highLow, highClose, lowClose);
}

/**
 * Oblicz ATR dla tablicy świec
 */
export function calculateATR(data: OHLCV[], period: number): (number | null)[] {
  const results: (number | null)[] = [];

  if (data.length < period + 1) {
    return data.map(() => null);
  }

  // Oblicz True Range dla wszystkich świec
  const trueRanges: number[] = [];
  for (let i = 0; i < data.length; i++) {
    const previous = i > 0 ? data[i - 1] : null;
    trueRanges.push(calculateTrueRange(data[i], previous));
  }

  // Pierwsza wartość ATR to średnia arytmetyczna True Range
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += trueRanges[i];
    results.push(null);
  }

  let atr = sum / period;
  results[period - 1] = atr;

  // Oblicz resztę wartości ATR (Wilder's smoothing)
  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
    results.push(atr);
  }

  return results;
}

/**
 * Oblicz ATR jako procent ceny
 */
export function calculateATRPercent(data: OHLCV[], period: number): (number | null)[] {
  const atrValues = calculateATR(data, period);

  return atrValues.map((atr, i) => {
    if (atr === null) return null;
    return (atr / data[i].close) * 100;
  });
}
