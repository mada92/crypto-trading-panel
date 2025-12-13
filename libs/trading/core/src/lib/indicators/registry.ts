import { IIndicator } from '../types/indicator';
import { SMAIndicator } from './sma';
import { EMAIndicator } from './ema';
import { SMMAIndicator } from './smma';
import { RSIIndicator } from './rsi';
import { ATRIndicator } from './atr';
import { MACDIndicator } from './macd';
import { BollingerBandsIndicator } from './bollinger';
import { PivotPointsIndicator } from './pivot-points';
import { ADXIndicator } from './adx';
import { StochasticIndicator } from './stochastic';
import { VolumeSMAIndicator } from './volume-sma';
import { OBVIndicator } from './obv';

/**
 * Rejestr wskaźników technicznych
 * Singleton pattern - jeden rejestr dla całej aplikacji
 */
export class IndicatorRegistry {
  private static instance: IndicatorRegistry;
  private indicators: Map<string, IIndicator> = new Map();

  private constructor() {
    // Zarejestruj wbudowane wskaźniki
    this.registerBuiltInIndicators();
  }

  /**
   * Pobierz instancję rejestru (Singleton)
   */
  static getInstance(): IndicatorRegistry {
    if (!IndicatorRegistry.instance) {
      IndicatorRegistry.instance = new IndicatorRegistry();
    }
    return IndicatorRegistry.instance;
  }

  /**
   * Zarejestruj wbudowane wskaźniki
   */
  private registerBuiltInIndicators(): void {
    this.register(new SMAIndicator());
    this.register(new EMAIndicator());
    this.register(new SMMAIndicator());
    this.register(new RSIIndicator());
    this.register(new ATRIndicator());
    this.register(new MACDIndicator());
    this.register(new BollingerBandsIndicator());
    this.register(new PivotPointsIndicator());
    this.register(new ADXIndicator());
    this.register(new StochasticIndicator());
    this.register(new VolumeSMAIndicator());
    this.register(new OBVIndicator());
  }

  /**
   * Zarejestruj nowy wskaźnik
   */
  register(indicator: IIndicator): void {
    this.indicators.set(indicator.name.toUpperCase(), indicator);
  }

  /**
   * Pobierz wskaźnik po nazwie
   */
  get(name: string): IIndicator | undefined {
    return this.indicators.get(name.toUpperCase());
  }

  /**
   * Sprawdź czy wskaźnik istnieje
   */
  has(name: string): boolean {
    return this.indicators.has(name.toUpperCase());
  }

  /**
   * Pobierz listę wszystkich zarejestrowanych wskaźników
   */
  getAll(): IIndicator[] {
    return Array.from(this.indicators.values());
  }

  /**
   * Pobierz nazwy wszystkich zarejestrowanych wskaźników
   */
  getNames(): string[] {
    return Array.from(this.indicators.keys());
  }

  /**
   * Wyrejestruj wskaźnik
   */
  unregister(name: string): boolean {
    return this.indicators.delete(name.toUpperCase());
  }

  /**
   * Wyczyść rejestr (przywróć do stanu początkowego)
   */
  reset(): void {
    this.indicators.clear();
    this.registerBuiltInIndicators();
  }
}

/**
 * Fabryka wskaźników - tworzy instancje wskaźników
 */
export function createIndicator(name: string): IIndicator | undefined {
  return IndicatorRegistry.getInstance().get(name);
}

/**
 * Sprawdź czy wskaźnik jest zarejestrowany
 */
export function isIndicatorRegistered(name: string): boolean {
  return IndicatorRegistry.getInstance().has(name);
}
