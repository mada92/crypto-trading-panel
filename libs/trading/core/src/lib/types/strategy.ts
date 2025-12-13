import { Timeframe } from './ohlcv';

/**
 * Status strategii
 */
export type StrategyStatus = 'draft' | 'testing' | 'live' | 'archived';

/**
 * Kierunek pozycji
 */
export type PositionSide = 'long' | 'short';

/**
 * Typ zlecenia
 */
export type OrderType = 'market' | 'limit' | 'stop_market' | 'take_profit';

/**
 * Powód zamknięcia pozycji
 */
export type ExitReason =
  | 'stop_loss'
  | 'take_profit'
  | 'trailing_stop'
  | 'signal'
  | 'manual'
  | 'timeout';

/**
 * Definicja wskaźnika w strategii
 */
export interface IndicatorDefinition {
  id: string; // Unikalny identyfikator w ramach strategii
  type: string; // Typ wskaźnika (np. 'SMA', 'EMA', 'RSI')
  params: Record<string, number | string>; // Parametry wskaźnika
  source?: string; // Źródło danych (domyślnie 'close')
  timeframe?: Timeframe; // Opcjonalny timeframe (domyślnie primary)
}

/**
 * Zmienna obliczeniowa
 */
export interface ComputedVariable {
  id: string;
  expression: string; // Wyrażenie do obliczenia
  description?: string;
}

/**
 * Typ warunku
 */
export type ConditionType =
  | 'greater_than'
  | 'less_than'
  | 'equals'
  | 'not_equals'
  | 'between'
  | 'crosses_above'
  | 'crosses_below'
  | 'is_rising'
  | 'is_falling';

/**
 * Pojedynczy warunek
 */
export interface Condition {
  type: ConditionType;
  left: string; // Referencja do wskaźnika/zmiennej/ceny
  right: string | number; // Wartość lub referencja
  params?: Record<string, number | string>; // Dodatkowe parametry
}

/**
 * Grupa warunków z operatorem logicznym
 */
export interface ConditionGroup {
  operator: 'AND' | 'OR';
  conditions: (Condition | ConditionGroup)[];
}

/**
 * Definicja sygnału wejścia
 */
export interface SignalDefinition {
  conditions: ConditionGroup;
  filters?: ConditionGroup; // Opcjonalne filtry (np. trend)
}

/**
 * Definicja sygnału wyjścia
 */
export interface ExitSignalDefinition {
  stopLoss?: StopLossConfig;
  takeProfit?: TakeProfitConfig;
  trailingStop?: TrailingStopConfig;
  signalExit?: SignalDefinition; // Wyjście na sygnał
  timeout?: number; // Maksymalny czas w pozycji (minuty)
}

/**
 * Konfiguracja Stop Loss
 */
export interface StopLossConfig {
  type: 'fixed_percent' | 'fixed_price' | 'atr_multiple' | 'pivot';
  value: number;
  atrPeriod?: number; // Dla typu atr_multiple
}

/**
 * Konfiguracja Take Profit
 */
export interface TakeProfitConfig {
  type: 'fixed_percent' | 'fixed_price' | 'atr_multiple' | 'risk_reward' | 'pivot';
  value: number;
  atrPeriod?: number;
}

/**
 * Konfiguracja Trailing Stop
 */
export interface TrailingStopConfig {
  enabled: boolean;
  activationPercent?: number; // Aktywacja po X% zysku
  trailPercent?: number; // Odległość trailing stop
  atrMultiple?: number;
}

/**
 * Konfiguracja zarządzania ryzykiem
 */
export interface RiskManagementConfig {
  riskPerTrade: number; // Ryzyko na transakcję (% kapitału)
  maxPositionSize: number; // Maksymalna wielkość pozycji (% kapitału)
  maxOpenPositions: number; // Maksymalna liczba otwartych pozycji
  maxDailyLoss?: number; // Maksymalna dzienna strata (%)
  maxDrawdown?: number; // Maksymalny drawdown (%)
  leverage?: number; // Dźwignia
}

/**
 * Wskazówki optymalizacyjne dla AI
 */
export interface OptimizationHints {
  optimizableParams?: string[]; // Lista parametrów do optymalizacji
  objectives?: ('sharpe' | 'profit_factor' | 'win_rate' | 'return')[];
  constraints?: Record<string, { min?: number; max?: number }>;
}

/**
 * Główny schemat strategii - Single Source of Truth
 */
export interface StrategySchema {
  // Metadata
  id: string;
  version: string;
  name: string;
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
  status: StrategyStatus;

  // Wymagania danych
  dataRequirements: {
    primaryTimeframe: Timeframe;
    additionalTimeframes?: Timeframe[];
    lookbackPeriods: number;
    symbols: string[];
  };

  // Wskaźniki
  indicators: IndicatorDefinition[];

  // Zmienne obliczeniowe
  computedVariables?: ComputedVariable[];

  // Sygnały wejścia
  entrySignals: {
    long?: SignalDefinition;
    short?: SignalDefinition;
  };

  // Sygnały wyjścia
  exitSignals: ExitSignalDefinition;

  // Zarządzanie ryzykiem
  riskManagement: RiskManagementConfig;

  // Wskazówki optymalizacyjne
  optimizationHints?: OptimizationHints;
}
