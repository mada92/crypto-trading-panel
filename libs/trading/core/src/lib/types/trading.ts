import { ExitReason, OrderType, PositionSide } from './strategy';

/**
 * Pojedyncze zlecenie
 */
export interface Order {
  id: string;
  symbol: string;
  side: PositionSide;
  type: OrderType;
  price: number;
  size: number;
  status: OrderStatus;
  createdAt: number; // Unix timestamp
  filledAt?: number;
  filledPrice?: number;
  commission?: number;
}

export type OrderStatus = 'pending' | 'filled' | 'cancelled' | 'rejected';

/**
 * Otwarta pozycja
 */
export interface Position {
  id: string;
  symbol: string;
  side: PositionSide;
  entryPrice: number;
  size: number;
  entryTime: number;
  stopLoss?: number;
  takeProfit?: number;
  trailingStop?: {
    active: boolean;
    highestPrice?: number;
    lowestPrice?: number;
    currentStop?: number;
    // Konfiguracja z strategii
    activationPercent?: number; // Aktywacja po X% zysku
    trailPercent?: number; // Trail distance jako %
  };
  unrealizedPnl?: number;
  unrealizedPnlPercent?: number;
}

/**
 * Zamknięta transakcja (trade)
 */
export interface Trade {
  id: string;
  symbol: string;
  side: PositionSide;
  entryPrice: number;
  exitPrice: number;
  size: number;
  entryTime: number;
  exitTime: number;
  pnl: number; // Profit & Loss w jednostkach waluty
  pnlPercent: number; // P&L w procentach
  commission: number;
  netPnl: number; // P&L po prowizjach
  exitReason: ExitReason;
  holdingTime: number; // Czas trwania pozycji w ms
}

/**
 * Stan portfela
 */
export interface Portfolio {
  initialCapital: number;
  currentCapital: number;
  availableCapital: number;
  equity: number; // Kapitał + niezrealizowane P&L
  openPositions: Position[];
  totalPnl: number;
  totalPnlPercent: number;
  totalCommission: number;
}

/**
 * Sygnał tradingowy wygenerowany przez strategię
 */
export interface Signal {
  type: 'entry_long' | 'entry_short' | 'exit_long' | 'exit_short' | 'none';
  price: number;
  timestamp: number;
  reason?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Punkt na krzywej equity
 */
export interface EquityPoint {
  timestamp: number;
  equity: number;
  drawdown: number;
  drawdownPercent: number;
  openPositions: number;
}
