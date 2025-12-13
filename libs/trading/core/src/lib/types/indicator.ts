import { OHLCV } from './ohlcv';

/**
 * Wynik obliczeń wskaźnika
 */
export type IndicatorValue = number | null;

/**
 * Wynik wskaźnika dla wielu linii (np. MACD, Bollinger)
 */
export interface MultiLineIndicatorResult {
  [key: string]: IndicatorValue;
}

/**
 * Wynik wskaźnika - pojedyncza wartość lub wiele linii
 */
export type IndicatorResult = IndicatorValue | MultiLineIndicatorResult;

/**
 * Definicja parametru wskaźnika
 */
export interface ParameterDefinition {
  name: string;
  type: 'number' | 'string' | 'boolean';
  default: number | string | boolean;
  min?: number;
  max?: number;
  step?: number;
  description?: string;
}

/**
 * Wynik walidacji
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Typ źródła danych dla wskaźnika
 */
export type PriceSource = 'open' | 'high' | 'low' | 'close' | 'volume' | 'hl2' | 'hlc3' | 'ohlc4';

/**
 * Funkcja pobierająca cenę ze świecy
 */
export function getPrice(candle: OHLCV, source: PriceSource): number {
  switch (source) {
    case 'open':
      return candle.open;
    case 'high':
      return candle.high;
    case 'low':
      return candle.low;
    case 'close':
      return candle.close;
    case 'volume':
      return candle.volume;
    case 'hl2':
      return (candle.high + candle.low) / 2;
    case 'hlc3':
      return (candle.high + candle.low + candle.close) / 3;
    case 'ohlc4':
      return (candle.open + candle.high + candle.low + candle.close) / 4;
    default:
      return candle.close;
  }
}

/**
 * Interfejs wskaźnika technicznego
 */
export interface IIndicator {
  /** Nazwa wskaźnika */
  readonly name: string;

  /** Opis wskaźnika */
  readonly description: string;

  /** Definicje parametrów */
  readonly parameters: ParameterDefinition[];

  /** Minimalna liczba świec potrzebna do obliczeń */
  getRequiredPeriods(params: Record<string, number | string>): number;

  /** Oblicz wartość wskaźnika */
  calculate(data: OHLCV[], params: Record<string, number | string>): IndicatorResult[];

  /** Walidacja parametrów */
  validate(params: Record<string, number | string>): ValidationResult;
}

/**
 * Stan wskaźnika (dla obliczeń inkrementalnych)
 */
export interface IndicatorState {
  indicatorId: string;
  lastCalculatedIndex: number;
  cache: Record<string, number[]>;
}
