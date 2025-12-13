import { OHLCV } from '../types/ohlcv';
import {
  IIndicator,
  IndicatorResult,
  ParameterDefinition,
  ValidationResult,
} from '../types/indicator';

/**
 * On Balance Volume (OBV)
 * Wskaźnik bilansu wolumenu
 */
export class OBVIndicator implements IIndicator {
  readonly name = 'OBV';
  readonly description =
    'On Balance Volume - kumulatywny wskaźnik wolumenu śledzący przepływ pieniędzy';

  readonly parameters: ParameterDefinition[] = [
    // OBV nie wymaga parametrów, ale dodajemy opcjonalne SMA
    {
      name: 'signalPeriod',
      type: 'number',
      default: 0,
      min: 0,
      max: 100,
      description: 'Okres linii sygnałowej (0 = brak)',
    },
  ];

  getRequiredPeriods(params: Record<string, number | string>): number {
    const signalPeriod = Number(params['signalPeriod']) || 0;
    return Math.max(2, signalPeriod);
  }

  validate(params: Record<string, number | string>): ValidationResult {
    const errors: string[] = [];
    const signalPeriod = Number(params['signalPeriod']);

    if (signalPeriod < 0) {
      errors.push('Signal period must be at least 0');
    }
    if (signalPeriod > 100) {
      errors.push('Signal period must not exceed 100');
    }

    return { valid: errors.length === 0, errors };
  }

  calculate(
    data: OHLCV[],
    params: Record<string, number | string>
  ): IndicatorResult[] {
    const signalPeriod = Number(params['signalPeriod']) || 0;
    return calculateOBV(data, signalPeriod);
  }
}

/**
 * Oblicz OBV
 */
export function calculateOBV(
  data: OHLCV[],
  signalPeriod: number = 0
): IndicatorResult[] {
  if (data.length === 0) {
    return [];
  }

  const obvValues: number[] = [];

  // Pierwsza wartość OBV = wolumen pierwszej świecy
  obvValues.push(data[0].volume);

  // Oblicz OBV
  for (let i = 1; i < data.length; i++) {
    const currentClose = data[i].close;
    const prevClose = data[i - 1].close;
    const volume = data[i].volume;
    const prevOBV = obvValues[i - 1];

    if (currentClose > prevClose) {
      // Cena wzrosła - dodaj wolumen
      obvValues.push(prevOBV + volume);
    } else if (currentClose < prevClose) {
      // Cena spadła - odejmij wolumen
      obvValues.push(prevOBV - volume);
    } else {
      // Cena bez zmian - OBV bez zmian
      obvValues.push(prevOBV);
    }
  }

  // Jeśli nie ma linii sygnałowej, zwróć same wartości OBV
  if (signalPeriod === 0) {
    return obvValues;
  }

  // Oblicz linię sygnałową (SMA z OBV)
  const results: IndicatorResult[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < signalPeriod - 1) {
      results.push({
        obv: obvValues[i],
        signal: null,
      });
      continue;
    }

    let sum = 0;
    for (let j = i - signalPeriod + 1; j <= i; j++) {
      sum += obvValues[j];
    }

    results.push({
      obv: obvValues[i],
      signal: sum / signalPeriod,
    });
  }

  return results;
}
