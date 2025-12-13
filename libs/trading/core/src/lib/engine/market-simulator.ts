import { OHLCV } from '../types/ohlcv';
import { ExitReason, StopLossConfig, TakeProfitConfig, TrailingStopConfig } from '../types/strategy';
import { Order, OrderStatus, Position, Portfolio, Trade, Signal } from '../types/trading';
import { BacktestConfig } from '../types/backtest';
import { randomUUID } from 'crypto';

// Użyj natywnego crypto.randomUUID dla generowania UUID
const uuidv4 = (): string => randomUUID();

/**
 * Symulator rynku dla backtestingu
 * Symuluje wykonanie zleceń, zarządzanie pozycjami i portfelem
 */
export class MarketSimulator {
  private readonly config: BacktestConfig;
  private portfolio: Portfolio;
  private pendingOrders: Order[] = [];
  private trades: Trade[] = [];

  constructor(config: BacktestConfig) {
    this.config = config;
    this.portfolio = this.initializePortfolio();
  }

  /**
   * Inicjalizuj portfel
   */
  private initializePortfolio(): Portfolio {
    return {
      initialCapital: this.config.initialCapital,
      currentCapital: this.config.initialCapital,
      availableCapital: this.config.initialCapital,
      equity: this.config.initialCapital,
      openPositions: [],
      totalPnl: 0,
      totalPnlPercent: 0,
      totalCommission: 0,
    };
  }

  /**
   * Przetwórz świecę - sprawdź SL/TP, wypełnij zlecenia
   */
  processCandle(candle: OHLCV, symbol: string): Trade[] {
    const completedTrades: Trade[] = [];

    // Sprawdź stop loss i take profit dla otwartych pozycji
    for (const position of [...this.portfolio.openPositions]) {
      const trade = this.checkPositionExits(position, candle);
      if (trade) {
        completedTrades.push(trade);
        this.removePosition(position);
      } else {
        // Aktualizuj trailing stop
        this.updateTrailingStop(position, candle);
        // Aktualizuj niezrealizowany P&L
        this.updateUnrealizedPnl(position, candle);
      }
    }

    // Aktualizuj equity
    this.updateEquity(candle);

    return completedTrades;
  }

  /**
   * Otwórz pozycję na podstawie sygnału
   */
  openPosition(
    signal: Signal,
    candle: OHLCV,
    symbol: string,
    stopLossConfig?: StopLossConfig,
    takeProfitConfig?: TakeProfitConfig,
    trailingStopConfig?: TrailingStopConfig,
    riskPercent: number = 2,
    atrValue?: number
  ): Position | null {
    if (signal.type !== 'entry_long' && signal.type !== 'entry_short') {
      return null;
    }

    const side = signal.type === 'entry_long' ? 'long' : 'short';

    // Oblicz cenę wejścia z uwzględnieniem slippage
    const entryPrice = this.applySlippage(signal.price, side === 'long');

    // Oblicz stop loss
    const stopLoss = this.calculateStopLoss(
      entryPrice,
      side,
      stopLossConfig,
      atrValue
    );

    // Oblicz wielkość pozycji na podstawie ryzyka
    const riskAmount = this.portfolio.currentCapital * (riskPercent / 100);
    const riskPerUnit = stopLoss ? Math.abs(entryPrice - stopLoss) : entryPrice * 0.02;
    const size = riskAmount / riskPerUnit;

    // Sprawdź czy mamy wystarczający kapitał
    const positionValue = size * entryPrice;
    if (positionValue > this.portfolio.availableCapital) {
      return null;
    }

    // Oblicz take profit
    const takeProfit = this.calculateTakeProfit(
      entryPrice,
      side,
      takeProfitConfig,
      stopLoss,
      atrValue
    );

    // Oblicz prowizję
    const commission = this.calculateCommission(positionValue);
    this.portfolio.totalCommission += commission;

    // Utwórz pozycję
    const position: Position = {
      id: uuidv4(),
      symbol,
      side,
      entryPrice,
      size,
      entryTime: candle.timestamp,
      stopLoss,
      takeProfit,
      trailingStop: trailingStopConfig?.enabled
        ? {
            active: false,
            highestPrice: side === 'long' ? entryPrice : undefined,
            lowestPrice: side === 'short' ? entryPrice : undefined,
            // Zapisz konfigurację z strategii!
            activationPercent: trailingStopConfig.activationPercent ?? 2.0,
            trailPercent: trailingStopConfig.trailPercent ?? 1.0,
          }
        : undefined,
    };

    // Dodaj do portfela
    this.portfolio.openPositions.push(position);
    this.portfolio.availableCapital -= positionValue;

    return position;
  }

  /**
   * Zamknij pozycję
   */
  closePosition(
    position: Position,
    exitPrice: number,
    exitTime: number,
    exitReason: ExitReason
  ): Trade {
    // Zastosuj slippage
    const finalExitPrice = this.applySlippage(
      exitPrice,
      position.side === 'short' // Dla short kupujemy, więc slippage w górę
    );

    // Oblicz P&L
    const priceDiff =
      position.side === 'long'
        ? finalExitPrice - position.entryPrice
        : position.entryPrice - finalExitPrice;

    const pnl = priceDiff * position.size;
    const pnlPercent = (priceDiff / position.entryPrice) * 100;

    // Oblicz prowizję
    const positionValue = position.size * finalExitPrice;
    const commission = this.calculateCommission(positionValue);
    this.portfolio.totalCommission += commission;

    const netPnl = pnl - commission;

    // Utwórz trade
    const trade: Trade = {
      id: uuidv4(),
      symbol: position.symbol,
      side: position.side,
      entryPrice: position.entryPrice,
      exitPrice: finalExitPrice,
      size: position.size,
      entryTime: position.entryTime,
      exitTime,
      pnl,
      pnlPercent,
      commission,
      netPnl,
      exitReason,
      holdingTime: exitTime - position.entryTime,
    };

    // Aktualizuj portfel
    this.portfolio.currentCapital += netPnl;
    this.portfolio.availableCapital += positionValue;
    this.portfolio.totalPnl += netPnl;
    this.portfolio.totalPnlPercent =
      (this.portfolio.totalPnl / this.portfolio.initialCapital) * 100;

    // Zapisz trade
    this.trades.push(trade);

    return trade;
  }

  /**
   * Sprawdź czy pozycja powinna być zamknięta
   */
  private checkPositionExits(position: Position, candle: OHLCV): Trade | null {
    const isLong = position.side === 'long';

    // Sprawdź Stop Loss
    if (position.stopLoss) {
      const slHit = isLong
        ? candle.low <= position.stopLoss
        : candle.high >= position.stopLoss;

      if (slHit) {
        return this.closePosition(
          position,
          position.stopLoss,
          candle.timestamp,
          'stop_loss'
        );
      }
    }

    // Sprawdź Trailing Stop
    if (position.trailingStop?.active && position.trailingStop.currentStop) {
      const tsHit = isLong
        ? candle.low <= position.trailingStop.currentStop
        : candle.high >= position.trailingStop.currentStop;

      if (tsHit) {
        return this.closePosition(
          position,
          position.trailingStop.currentStop,
          candle.timestamp,
          'trailing_stop'
        );
      }
    }

    // Sprawdź Take Profit
    if (position.takeProfit) {
      const tpHit = isLong
        ? candle.high >= position.takeProfit
        : candle.low <= position.takeProfit;

      if (tpHit) {
        return this.closePosition(
          position,
          position.takeProfit,
          candle.timestamp,
          'take_profit'
        );
      }
    }

    return null;
  }

  /**
   * Aktualizuj trailing stop
   * Używa konfiguracji z pozycji (activationPercent, trailPercent)
   */
  private updateTrailingStop(position: Position, candle: OHLCV): void {
    if (!position.trailingStop) return;

    const isLong = position.side === 'long';
    // Użyj konfiguracji z pozycji (ustawionej ze strategii)
    const activationPct = position.trailingStop.activationPercent ?? 2.0;
    const trailPct = position.trailingStop.trailPercent ?? 1.0;

    if (isLong) {
      // Aktualizuj najwyższą cenę
      if (!position.trailingStop.highestPrice || candle.high > position.trailingStop.highestPrice) {
        position.trailingStop.highestPrice = candle.high;
      }

      // Sprawdź czy aktywować trailing stop
      if (!position.trailingStop.active) {
        const profitPercent =
          ((candle.high - position.entryPrice) / position.entryPrice) * 100;
        // Użyj konfiguracji activationPercent!
        if (profitPercent >= activationPct) {
          position.trailingStop.active = true;
        }
      }

      // Oblicz trailing stop level
      if (position.trailingStop.active && position.trailingStop.highestPrice) {
        // Użyj konfiguracji trailPercent!
        position.trailingStop.currentStop =
          position.trailingStop.highestPrice * (1 - trailPct / 100);

        // Nie pozwól aby trailing stop spadł poniżej wejścia (breakeven)
        if (position.trailingStop.currentStop < position.entryPrice) {
          position.trailingStop.currentStop = position.entryPrice;
        }
      }
    } else {
      // SHORT
      if (!position.trailingStop.lowestPrice || candle.low < position.trailingStop.lowestPrice) {
        position.trailingStop.lowestPrice = candle.low;
      }

      if (!position.trailingStop.active) {
        const profitPercent =
          ((position.entryPrice - candle.low) / position.entryPrice) * 100;
        // Użyj konfiguracji activationPercent!
        if (profitPercent >= activationPct) {
          position.trailingStop.active = true;
        }
      }

      if (position.trailingStop.active && position.trailingStop.lowestPrice) {
        // Użyj konfiguracji trailPercent!
        position.trailingStop.currentStop =
          position.trailingStop.lowestPrice * (1 + trailPct / 100);

        // Nie pozwól aby trailing stop wzrósł powyżej wejścia (breakeven)
        if (position.trailingStop.currentStop > position.entryPrice) {
          position.trailingStop.currentStop = position.entryPrice;
        }
      }
    }
  }

  /**
   * Oblicz stop loss
   */
  private calculateStopLoss(
    entryPrice: number,
    side: 'long' | 'short',
    config?: StopLossConfig,
    atrValue?: number
  ): number | undefined {
    if (!config) return undefined;

    let slDistance = 0;

    switch (config.type) {
      case 'fixed_percent':
        slDistance = entryPrice * (config.value / 100);
        break;
      case 'fixed_price':
        return config.value;
      case 'atr_multiple':
        if (atrValue) {
          slDistance = atrValue * config.value;
        }
        break;
      default:
        return undefined;
    }

    return side === 'long' ? entryPrice - slDistance : entryPrice + slDistance;
  }

  /**
   * Oblicz take profit
   */
  private calculateTakeProfit(
    entryPrice: number,
    side: 'long' | 'short',
    config?: TakeProfitConfig,
    stopLoss?: number,
    atrValue?: number
  ): number | undefined {
    if (!config) return undefined;

    let tpDistance = 0;

    switch (config.type) {
      case 'fixed_percent':
        tpDistance = entryPrice * (config.value / 100);
        break;
      case 'fixed_price':
        return config.value;
      case 'atr_multiple':
        if (atrValue) {
          tpDistance = atrValue * config.value;
        }
        break;
      case 'risk_reward':
        if (stopLoss) {
          const slDistance = Math.abs(entryPrice - stopLoss);
          tpDistance = slDistance * config.value;
        }
        break;
      default:
        return undefined;
    }

    return side === 'long' ? entryPrice + tpDistance : entryPrice - tpDistance;
  }

  /**
   * Zastosuj slippage do ceny
   */
  private applySlippage(price: number, isBuy: boolean): number {
    const slippage = price * this.config.slippagePercent;
    return isBuy ? price + slippage : price - slippage;
  }

  /**
   * Oblicz prowizję
   */
  private calculateCommission(value: number): number {
    return value * this.config.commissionPercent;
  }

  /**
   * Aktualizuj niezrealizowany P&L pozycji
   */
  private updateUnrealizedPnl(position: Position, candle: OHLCV): void {
    const currentPrice = candle.close;
    const priceDiff =
      position.side === 'long'
        ? currentPrice - position.entryPrice
        : position.entryPrice - currentPrice;

    position.unrealizedPnl = priceDiff * position.size;
    position.unrealizedPnlPercent = (priceDiff / position.entryPrice) * 100;
  }

  /**
   * Aktualizuj equity portfela
   */
  private updateEquity(candle: OHLCV): void {
    let unrealizedPnl = 0;

    for (const position of this.portfolio.openPositions) {
      unrealizedPnl += position.unrealizedPnl || 0;
    }

    this.portfolio.equity = this.portfolio.currentCapital + unrealizedPnl;
  }

  /**
   * Usuń pozycję z portfela
   */
  private removePosition(position: Position): void {
    const index = this.portfolio.openPositions.findIndex(
      (p) => p.id === position.id
    );
    if (index !== -1) {
      this.portfolio.openPositions.splice(index, 1);
    }
  }

  /**
   * Pobierz portfel
   */
  getPortfolio(): Portfolio {
    return { ...this.portfolio };
  }

  /**
   * Pobierz wszystkie trade'y
   */
  getTrades(): Trade[] {
    return [...this.trades];
  }

  /**
   * Pobierz otwarte pozycje
   */
  getOpenPositions(): Position[] {
    return [...this.portfolio.openPositions];
  }

  /**
   * Sprawdź czy jest otwarta pozycja dla symbolu
   */
  hasOpenPosition(symbol: string): boolean {
    return this.portfolio.openPositions.some((p) => p.symbol === symbol);
  }

  /**
   * Pobierz otwartą pozycję dla symbolu
   */
  getOpenPosition(symbol: string): Position | undefined {
    return this.portfolio.openPositions.find((p) => p.symbol === symbol);
  }

  /**
   * Reset symulatora
   */
  reset(): void {
    this.portfolio = this.initializePortfolio();
    this.pendingOrders = [];
    this.trades = [];
  }
}
