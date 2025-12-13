import { Trade, EquityPoint } from '../types/trading';
import { BacktestMetrics, MonthlyReturn, TradeDistribution } from '../types/backtest';

/**
 * Oblicz wszystkie metryki backtestu
 */
export function calculateBacktestMetrics(
  trades: Trade[],
  equityCurve: EquityPoint[],
  initialCapital: number,
  startTimestamp: number,
  endTimestamp: number
): BacktestMetrics {
  if (trades.length === 0) {
    return createEmptyMetrics(initialCapital);
  }

  const finalCapital = equityCurve.length > 0 
    ? equityCurve[equityCurve.length - 1].equity 
    : initialCapital;

  // Podstawowe metryki
  const totalReturn = ((finalCapital - initialCapital) / initialCapital) * 100;
  const totalReturnAbsolute = finalCapital - initialCapital;

  // Czas trwania w latach
  const durationMs = endTimestamp - startTimestamp;
  const durationYears = durationMs / (365.25 * 24 * 60 * 60 * 1000);

  // CAGR
  const cagr = durationYears > 0 
    ? (Math.pow(finalCapital / initialCapital, 1 / durationYears) - 1) * 100 
    : totalReturn;

  // Podział na winning/losing trades
  const winningTrades = trades.filter((t) => t.netPnl > 0);
  const losingTrades = trades.filter((t) => t.netPnl < 0);

  // Win Rate
  const winRate = (winningTrades.length / trades.length) * 100;

  // Średnie
  const avgWin = winningTrades.length > 0
    ? winningTrades.reduce((sum, t) => sum + t.pnlPercent, 0) / winningTrades.length
    : 0;

  const avgLoss = losingTrades.length > 0
    ? losingTrades.reduce((sum, t) => sum + t.pnlPercent, 0) / losingTrades.length
    : 0;

  const avgTrade = trades.reduce((sum, t) => sum + t.pnlPercent, 0) / trades.length;

  // Profit Factor
  const grossProfit = winningTrades.reduce((sum, t) => sum + t.netPnl, 0);
  const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.netPnl, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  // Largest Win/Loss
  const largestWin = winningTrades.length > 0
    ? Math.max(...winningTrades.map((t) => t.pnlPercent))
    : 0;

  const largestLoss = losingTrades.length > 0
    ? Math.min(...losingTrades.map((t) => t.pnlPercent))
    : 0;

  // Consecutive wins/losses
  const { maxConsecutiveWins, maxConsecutiveLosses } = calculateConsecutive(trades);

  // Drawdown
  const { maxDrawdown, maxDrawdownAbsolute, maxDrawdownDuration } = 
    calculateDrawdownMetrics(equityCurve);

  // Risk metrics
  const { sharpeRatio, sortinoRatio, volatility } = calculateRiskMetrics(
    equityCurve,
    initialCapital
  );

  const calmarRatio = maxDrawdown > 0 ? cagr / maxDrawdown : 0;

  // Long/Short breakdown
  const longTrades = trades.filter((t) => t.side === 'long');
  const shortTrades = trades.filter((t) => t.side === 'short');
  const longWins = longTrades.filter((t) => t.netPnl > 0);
  const shortWins = shortTrades.filter((t) => t.netPnl > 0);

  const longWinRate = longTrades.length > 0 
    ? (longWins.length / longTrades.length) * 100 
    : 0;
  const shortWinRate = shortTrades.length > 0 
    ? (shortWins.length / shortTrades.length) * 100 
    : 0;

  // Holding time
  const avgHoldingTime = trades.reduce((sum, t) => sum + t.holdingTime, 0) / trades.length;
  const avgHoldingTimeMinutes = avgHoldingTime / (60 * 1000);

  // Time in market
  const totalTimeInMarket = trades.reduce((sum, t) => sum + t.holdingTime, 0);
  const timeInMarket = (totalTimeInMarket / durationMs) * 100;

  // Total commission
  const totalCommission = trades.reduce((sum, t) => sum + t.commission, 0);

  // Monthly average return
  const monthlyAvgReturn = calculateMonthlyAvgReturn(equityCurve, initialCapital);

  // Peak capital
  const peakCapital = equityCurve.length > 0
    ? Math.max(...equityCurve.map((e) => e.equity))
    : initialCapital;

  return {
    // Returns
    totalReturn,
    totalReturnAbsolute,
    cagr,
    monthlyAvgReturn,

    // Risk
    maxDrawdown,
    maxDrawdownAbsolute,
    maxDrawdownDuration,
    sharpeRatio,
    sortinoRatio,
    calmarRatio,
    volatility,

    // Trading
    totalTrades: trades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    winRate,
    profitFactor,
    avgWin,
    avgLoss,
    avgTrade,
    largestWin,
    largestLoss,
    maxConsecutiveWins,
    maxConsecutiveLosses,

    // Exposure
    longTrades: longTrades.length,
    shortTrades: shortTrades.length,
    longWinRate,
    shortWinRate,
    avgHoldingTime: avgHoldingTimeMinutes,
    timeInMarket,

    // Capital
    initialCapital,
    finalCapital,
    peakCapital,
    totalCommission,
  };
}

/**
 * Oblicz metryki drawdown
 */
function calculateDrawdownMetrics(equityCurve: EquityPoint[]): {
  maxDrawdown: number;
  maxDrawdownAbsolute: number;
  maxDrawdownDuration: number;
} {
  if (equityCurve.length === 0) {
    return {
      maxDrawdown: 0,
      maxDrawdownAbsolute: 0,
      maxDrawdownDuration: 0,
    };
  }

  let maxDrawdown = 0;
  let maxDrawdownAbsolute = 0;
  let currentDrawdownStart: number | null = null;
  let maxDrawdownDuration = 0;

  for (const point of equityCurve) {
    if (point.drawdownPercent > maxDrawdown) {
      maxDrawdown = point.drawdownPercent;
      maxDrawdownAbsolute = point.drawdown;
    }

    // Track drawdown duration
    if (point.drawdownPercent > 0) {
      if (currentDrawdownStart === null) {
        currentDrawdownStart = point.timestamp;
      }
    } else {
      if (currentDrawdownStart !== null) {
        const duration = point.timestamp - currentDrawdownStart;
        const durationDays = duration / (24 * 60 * 60 * 1000);
        if (durationDays > maxDrawdownDuration) {
          maxDrawdownDuration = durationDays;
        }
        currentDrawdownStart = null;
      }
    }
  }

  return {
    maxDrawdown,
    maxDrawdownAbsolute,
    maxDrawdownDuration,
  };
}

/**
 * Oblicz metryki ryzyka (Sharpe, Sortino, Volatility)
 */
function calculateRiskMetrics(
  equityCurve: EquityPoint[],
  initialCapital: number
): {
  sharpeRatio: number;
  sortinoRatio: number;
  volatility: number;
} {
  if (equityCurve.length < 2) {
    return {
      sharpeRatio: 0,
      sortinoRatio: 0,
      volatility: 0,
    };
  }

  // Oblicz dzienne zwroty
  const returns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const dailyReturn =
      (equityCurve[i].equity - equityCurve[i - 1].equity) /
      equityCurve[i - 1].equity;
    returns.push(dailyReturn);
  }

  if (returns.length === 0) {
    return {
      sharpeRatio: 0,
      sortinoRatio: 0,
      volatility: 0,
    };
  }

  // Średni zwrot
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;

  // Odchylenie standardowe
  const variance =
    returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) /
    returns.length;
  const stdDev = Math.sqrt(variance);

  // Annualizacja (zakładamy ~365 dni w roku)
  const annualizedReturn = avgReturn * 365;
  const annualizedVolatility = stdDev * Math.sqrt(365);

  // Risk-free rate (zakładamy 0 dla krypto)
  const riskFreeRate = 0;

  // Sharpe Ratio
  const sharpeRatio =
    annualizedVolatility > 0
      ? (annualizedReturn - riskFreeRate) / annualizedVolatility
      : 0;

  // Sortino Ratio (używa tylko negatywnych odchyleń)
  const negativeReturns = returns.filter((r) => r < 0);
  const downsideVariance =
    negativeReturns.length > 0
      ? negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) /
        negativeReturns.length
      : 0;
  const downsideDeviation = Math.sqrt(downsideVariance) * Math.sqrt(365);

  const sortinoRatio =
    downsideDeviation > 0
      ? (annualizedReturn - riskFreeRate) / downsideDeviation
      : 0;

  return {
    sharpeRatio,
    sortinoRatio,
    volatility: annualizedVolatility * 100, // jako procent
  };
}

/**
 * Oblicz consecutive wins/losses
 */
function calculateConsecutive(trades: Trade[]): {
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
} {
  let maxConsecutiveWins = 0;
  let maxConsecutiveLosses = 0;
  let currentWins = 0;
  let currentLosses = 0;

  for (const trade of trades) {
    if (trade.netPnl > 0) {
      currentWins++;
      currentLosses = 0;
      maxConsecutiveWins = Math.max(maxConsecutiveWins, currentWins);
    } else {
      currentLosses++;
      currentWins = 0;
      maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentLosses);
    }
  }

  return { maxConsecutiveWins, maxConsecutiveLosses };
}

/**
 * Oblicz średni miesięczny zwrot
 */
function calculateMonthlyAvgReturn(
  equityCurve: EquityPoint[],
  initialCapital: number
): number {
  if (equityCurve.length < 2) return 0;

  const monthlyReturns = calculateMonthlyReturns(equityCurve, initialCapital);

  if (monthlyReturns.length === 0) return 0;

  return (
    monthlyReturns.reduce((sum, mr) => sum + mr.return, 0) / monthlyReturns.length
  );
}

/**
 * Oblicz miesięczne zwroty
 */
export function calculateMonthlyReturns(
  equityCurve: EquityPoint[],
  initialCapital: number
): MonthlyReturn[] {
  if (equityCurve.length < 2) return [];

  const monthlyReturns: MonthlyReturn[] = [];
  const monthlyData = new Map<string, { start: number; end: number; trades: number }>();

  // Grupuj equity po miesiącach
  for (const point of equityCurve) {
    const date = new Date(point.timestamp);
    const key = `${date.getFullYear()}-${date.getMonth()}`;

    const existing = monthlyData.get(key);
    if (!existing) {
      monthlyData.set(key, {
        start: point.equity,
        end: point.equity,
        trades: point.openPositions,
      });
    } else {
      existing.end = point.equity;
    }
  }

  // Oblicz zwroty
  let prevEquity = initialCapital;
  for (const [key, data] of monthlyData) {
    const [yearStr, monthStr] = key.split('-');
    const monthReturn = ((data.end - prevEquity) / prevEquity) * 100;

    monthlyReturns.push({
      year: parseInt(yearStr),
      month: parseInt(monthStr),
      return: monthReturn,
      trades: data.trades,
    });

    prevEquity = data.end;
  }

  return monthlyReturns;
}

/**
 * Utwórz puste metryki
 */
function createEmptyMetrics(initialCapital: number): BacktestMetrics {
  return {
    totalReturn: 0,
    totalReturnAbsolute: 0,
    cagr: 0,
    monthlyAvgReturn: 0,
    maxDrawdown: 0,
    maxDrawdownAbsolute: 0,
    maxDrawdownDuration: 0,
    sharpeRatio: 0,
    sortinoRatio: 0,
    calmarRatio: 0,
    volatility: 0,
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    winRate: 0,
    profitFactor: 0,
    avgWin: 0,
    avgLoss: 0,
    avgTrade: 0,
    largestWin: 0,
    largestLoss: 0,
    maxConsecutiveWins: 0,
    maxConsecutiveLosses: 0,
    longTrades: 0,
    shortTrades: 0,
    longWinRate: 0,
    shortWinRate: 0,
    avgHoldingTime: 0,
    timeInMarket: 0,
    initialCapital,
    finalCapital: initialCapital,
    peakCapital: initialCapital,
    totalCommission: 0,
  };
}

/**
 * Oblicz rozkład trade'ów
 */
export function calculateTradeDistribution(trades: Trade[]): TradeDistribution {
  const byHour: Record<number, { trades: number; winRate: number; avgPnl: number }> = {};
  const byDayOfWeek: Record<number, { trades: number; winRate: number; avgPnl: number }> = {};
  const byMonth: Record<number, { trades: number; winRate: number; avgPnl: number }> = {};

  // Grupuj trade'y
  for (const trade of trades) {
    const date = new Date(trade.entryTime);
    const hour = date.getHours();
    const dayOfWeek = date.getDay();
    const month = date.getMonth();

    // By hour
    if (!byHour[hour]) {
      byHour[hour] = { trades: 0, winRate: 0, avgPnl: 0 };
    }
    byHour[hour].trades++;
    byHour[hour].avgPnl += trade.pnlPercent;

    // By day of week
    if (!byDayOfWeek[dayOfWeek]) {
      byDayOfWeek[dayOfWeek] = { trades: 0, winRate: 0, avgPnl: 0 };
    }
    byDayOfWeek[dayOfWeek].trades++;
    byDayOfWeek[dayOfWeek].avgPnl += trade.pnlPercent;

    // By month
    if (!byMonth[month]) {
      byMonth[month] = { trades: 0, winRate: 0, avgPnl: 0 };
    }
    byMonth[month].trades++;
    byMonth[month].avgPnl += trade.pnlPercent;
  }

  // Oblicz średnie i win rate
  const calculateStats = (
    group: Record<number, { trades: number; winRate: number; avgPnl: number }>
  ) => {
    for (const key of Object.keys(group)) {
      const k = parseInt(key);
      const tradesInGroup = trades.filter((t) => {
        const date = new Date(t.entryTime);
        if (group === byHour) return date.getHours() === k;
        if (group === byDayOfWeek) return date.getDay() === k;
        return date.getMonth() === k;
      });

      const wins = tradesInGroup.filter((t) => t.netPnl > 0).length;
      group[k].winRate = tradesInGroup.length > 0 ? (wins / tradesInGroup.length) * 100 : 0;
      group[k].avgPnl = tradesInGroup.length > 0 ? group[k].avgPnl / tradesInGroup.length : 0;
    }
  };

  calculateStats(byHour);
  calculateStats(byDayOfWeek);
  calculateStats(byMonth);

  return { byHour, byDayOfWeek, byMonth };
}
