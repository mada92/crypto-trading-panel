import { OHLCV } from '../types/ohlcv';
import {
  IIndicator,
  IndicatorResult,
  ParameterDefinition,
  ValidationResult,
  MultiLineIndicatorResult,
} from '../types/indicator';

/**
 * Stochastic Oscillator
 * Wskaźnik stochastyczny - porównuje cenę zamknięcia z zakresem cen
 */
export class StochasticIndicator implements IIndicator {
  readonly name = 'STOCHASTIC';
  readonly description = 'Stochastic Oscillator - wskaźnik momentum (0-100)';

  readonly parameters: ParameterDefinition[] = [
    {
      name: 'kPeriod',
      type: 'number',
      default: 14,
      min: 1,
      max: 100,
      description: 'Okres %K (główna linia)',
    },
    {
      name: 'dPeriod',
      type: 'number',
      default: 3,
      min: 1,
      max: 50,
      description: 'Okres %D (linia sygnałowa)',
    },
    {
      name: 'smooth',
      type: 'number',
      default: 3,
      min: 1,
      max: 50,
      description: 'Wygładzenie %K',
    },
  ];

  getRequiredPeriods(params: Record<string, number | string>): number {
    const kPeriod = Number(params['kPeriod']) || 14;
    const dPeriod = Number(params['dPeriod']) || 3;
    const smooth = Number(params['smooth']) || 3;
    return kPeriod + dPeriod + smooth;
  }

  validate(params: Record<string, number | string>): ValidationResult {
    const errors: string[] = [];
    const kPeriod = Number(params['kPeriod']);
    const dPeriod = Number(params['dPeriod']);
    const smooth = Number(params['smooth']);

    if (!kPeriod || kPeriod < 1) {
      errors.push('K Period must be at least 1');
    }
    if (!dPeriod || dPeriod < 1) {
      errors.push('D Period must be at least 1');
    }
    if (!smooth || smooth < 1) {
      errors.push('Smooth must be at least 1');
    }

    return { valid: errors.length === 0, errors };
  }

  calculate(
    data: OHLCV[],
    params: Record<string, number | string>
  ): IndicatorResult[] {
    const kPeriod = Number(params['kPeriod']) || 14;
    const dPeriod = Number(params['dPeriod']) || 3;
    const smooth = Number(params['smooth']) || 3;

    return calculateStochastic(data, kPeriod, dPeriod, smooth);
  }
}

/**
 * Oblicz Stochastic dla danych OHLCV
 */
export function calculateStochastic(
  data: OHLCV[],
  kPeriod: number,
  dPeriod: number,
  smooth: number
): MultiLineIndicatorResult[] {
  const results: MultiLineIndicatorResult[] = [];
  const rawK: (number | null)[] = [];

  // Oblicz surowe %K
  for (let i = 0; i < data.length; i++) {
    if (i < kPeriod - 1) {
      rawK.push(null);
      results.push({ k: null, d: null });
      continue;
    }

    // Znajdź najwyższe high i najniższe low w okresie
    let highestHigh = -Infinity;
    let lowestLow = Infinity;

    for (let j = i - kPeriod + 1; j <= i; j++) {
      highestHigh = Math.max(highestHigh, data[j].high);
      lowestLow = Math.min(lowestLow, data[j].low);
    }

    const range = highestHigh - lowestLow;
    if (range === 0) {
      rawK.push(50); // Brak ruchu = środek zakresu
    } else {
      rawK.push(((data[i].close - lowestLow) / range) * 100);
    }
  }

  // Wygładź %K (SMA)
  const smoothedK: (number | null)[] = [];
  for (let i = 0; i < rawK.length; i++) {
    if (i < kPeriod - 1 + smooth - 1 || rawK[i] === null) {
      smoothedK.push(null);
      continue;
    }

    let sum = 0;
    let count = 0;
    for (let j = i - smooth + 1; j <= i; j++) {
      if (rawK[j] !== null) {
        sum += rawK[j]!;
        count++;
      }
    }
    smoothedK.push(count > 0 ? sum / count : null);
  }

  // Oblicz %D (SMA z wygładzonego %K)
  const d: (number | null)[] = [];
  for (let i = 0; i < smoothedK.length; i++) {
    if (i < kPeriod - 1 + smooth - 1 + dPeriod - 1 || smoothedK[i] === null) {
      d.push(null);
      continue;
    }

    let sum = 0;
    let count = 0;
    for (let j = i - dPeriod + 1; j <= i; j++) {
      if (smoothedK[j] !== null) {
        sum += smoothedK[j]!;
        count++;
      }
    }
    d.push(count > 0 ? sum / count : null);
  }

  // Zbuduj wyniki
  for (let i = 0; i < data.length; i++) {
    results[i] = {
      k: smoothedK[i] !== undefined ? smoothedK[i] : null,
      d: d[i] !== undefined ? d[i] : null,
    };
  }

  return results;
}
