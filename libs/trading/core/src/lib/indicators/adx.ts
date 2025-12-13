import { OHLCV } from '../types/ohlcv';
import {
  IIndicator,
  IndicatorResult,
  MultiLineIndicatorResult,
  ParameterDefinition,
  ValidationResult,
} from '../types/indicator';

/**
 * Average Directional Index (ADX)
 * Wskaźnik kierunkowości trendu
 */
export class ADXIndicator implements IIndicator {
  readonly name = 'ADX';
  readonly description = 'Average Directional Index - wskaźnik siły trendu (0-100)';

  readonly parameters: ParameterDefinition[] = [
    {
      name: 'period',
      type: 'number',
      default: 14,
      min: 1,
      max: 100,
      description: 'Okres ADX',
    },
  ];

  getRequiredPeriods(params: Record<string, number | string>): number {
    return Number(params['period']) * 2 || 28;
  }

  validate(params: Record<string, number | string>): ValidationResult {
    const errors: string[] = [];
    const period = Number(params['period']);

    if (!period || period < 1) {
      errors.push('Period must be at least 1');
    }

    return { valid: errors.length === 0, errors };
  }

  calculate(data: OHLCV[], params: Record<string, number | string>): IndicatorResult[] {
    const period = Number(params['period']) || 14;
    return calculateADX(data, period);
  }
}

/**
 * Oblicz ADX, +DI, -DI
 */
export function calculateADX(data: OHLCV[], period: number): MultiLineIndicatorResult[] {
  const results: MultiLineIndicatorResult[] = [];

  if (data.length < period * 2) {
    return data.map(() => ({
      adx: null,
      plusDI: null,
      minusDI: null,
    }));
  }

  // Oblicz True Range, +DM, -DM
  const tr: number[] = [];
  const plusDM: number[] = [];
  const minusDM: number[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      tr.push(data[i].high - data[i].low);
      plusDM.push(0);
      minusDM.push(0);
      results.push({ adx: null, plusDI: null, minusDI: null });
      continue;
    }

    const current = data[i];
    const previous = data[i - 1];

    // True Range
    const highLow = current.high - current.low;
    const highPrevClose = Math.abs(current.high - previous.close);
    const lowPrevClose = Math.abs(current.low - previous.close);
    tr.push(Math.max(highLow, highPrevClose, lowPrevClose));

    // Directional Movement
    const upMove = current.high - previous.high;
    const downMove = previous.low - current.low;

    if (upMove > downMove && upMove > 0) {
      plusDM.push(upMove);
    } else {
      plusDM.push(0);
    }

    if (downMove > upMove && downMove > 0) {
      minusDM.push(downMove);
    } else {
      minusDM.push(0);
    }
  }

  // Wygładzanie Wildera
  let smoothedTR = 0;
  let smoothedPlusDM = 0;
  let smoothedMinusDM = 0;

  // Pierwsze wartości
  for (let i = 0; i < period; i++) {
    smoothedTR += tr[i];
    smoothedPlusDM += plusDM[i];
    smoothedMinusDM += minusDM[i];
  }

  // Oblicz +DI i -DI
  const plusDI: (number | null)[] = new Array(data.length).fill(null);
  const minusDI: (number | null)[] = new Array(data.length).fill(null);
  const dx: (number | null)[] = new Array(data.length).fill(null);

  if (smoothedTR !== 0) {
    plusDI[period - 1] = (smoothedPlusDM / smoothedTR) * 100;
    minusDI[period - 1] = (smoothedMinusDM / smoothedTR) * 100;
    const diSum = plusDI[period - 1]! + minusDI[period - 1]!;
    if (diSum !== 0) {
      dx[period - 1] = (Math.abs(plusDI[period - 1]! - minusDI[period - 1]!) / diSum) * 100;
    }
  }

  results[period - 1] = {
    adx: null,
    plusDI: plusDI[period - 1],
    minusDI: minusDI[period - 1],
  };

  // Kontynuuj wygładzanie
  for (let i = period; i < data.length; i++) {
    smoothedTR = smoothedTR - smoothedTR / period + tr[i];
    smoothedPlusDM = smoothedPlusDM - smoothedPlusDM / period + plusDM[i];
    smoothedMinusDM = smoothedMinusDM - smoothedMinusDM / period + minusDM[i];

    if (smoothedTR !== 0) {
      plusDI[i] = (smoothedPlusDM / smoothedTR) * 100;
      minusDI[i] = (smoothedMinusDM / smoothedTR) * 100;
      const diSum = plusDI[i]! + minusDI[i]!;
      if (diSum !== 0) {
        dx[i] = (Math.abs(plusDI[i]! - minusDI[i]!) / diSum) * 100;
      }
    }
  }

  // Oblicz ADX (wygładzony DX)
  let adxSum = 0;
  let adxCount = 0;

  for (let i = period - 1; i < period * 2 - 1 && i < data.length; i++) {
    if (dx[i] !== null) {
      adxSum += dx[i]!;
      adxCount++;
    }
  }

  let adx = adxCount > 0 ? adxSum / adxCount : null;

  for (let i = period * 2 - 1; i < data.length; i++) {
    if (adx !== null && dx[i] !== null) {
      adx = (adx * (period - 1) + dx[i]!) / period;
    }

    results[i] = {
      adx,
      plusDI: plusDI[i],
      minusDI: minusDI[i],
    };
  }

  // Uzupełnij brakujące wyniki
  for (let i = 0; i < results.length; i++) {
    if (!results[i]) {
      results[i] = { adx: null, plusDI: null, minusDI: null };
    }
  }

  return results;
}
