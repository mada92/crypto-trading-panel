/**
 * Backtest CLI - Single Source of Truth
 *
 * Ten CLI używa tych samych definicji strategii co API.
 * Strategia jest importowana z @trading-system/core.
 */

import {
  BacktestEngine,
  BacktestConfig,
  BacktestResult,
  OHLCV,
  StrategySchema,
  Timeframe,
  // Single Source of Truth - strategie z core
  PIVOT_SMMA_V3_STRATEGY,
  // Single Source of Truth - generator danych z core (fallback)
  generateSyntheticData,
  // Bybit client do pobierania prawdziwych danych
  BybitClient,
  ExchangeConfig,
  // Agregacja danych MTF
  aggregateOHLCV,
  // Market dynamics - analiza świec 1m
  aggregateWithDynamics,
  AggregatedCandle,
  DynamicsMetrics,
  timeframeToMs,
  // Cache MongoDB
  fetchCachedCandles,
  getCacheStats,
} from '@trading-system/core';

// ============================================================================
// Pobieranie danych z Bybit - Single Source of Truth
// ============================================================================

interface MarketDataResult {
  raw1m: OHLCV[];                // Surowe dane 1m
  primary: AggregatedCandle[];   // Dane dla głównego TF z dynamiką
  daily: OHLCV[];                // Dane dzienne dla MTF
  dailyTrend: number[];          // Trend dzienny: 1 = up, -1 = down, 0 = neutral
  dailyTimestamps: number[];     // Timestamps świec dziennych
}

/**
 * Oblicz SMMA dla tablicy wartości
 */
function calculateSMMA(values: number[], period: number): number[] {
  const result: number[] = [];
  let smma = 0;

  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
      continue;
    }

    if (i === period - 1) {
      // Pierwsza wartość = SMA
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += values[i - j];
      }
      smma = sum / period;
    } else {
      // SMMA = (prevSMMA * (period - 1) + currentValue) / period
      smma = (smma * (period - 1) + values[i]) / period;
    }
    result.push(smma);
  }

  return result;
}

/**
 * Oblicz trend dzienny na podstawie SMMA
 */
function calculateDailyTrend(dailyData: OHLCV[]): number[] {
  const closes = dailyData.map((d) => d.close);
  const smmaFast = calculateSMMA(closes, 8);   // ~33 na 4h
  const smmaSlow = calculateSMMA(closes, 36);  // ~144 na 4h

  const trend: number[] = [];
  for (let i = 0; i < dailyData.length; i++) {
    if (isNaN(smmaFast[i]) || isNaN(smmaSlow[i])) {
      trend.push(0);
    } else if (smmaFast[i] > smmaSlow[i] * 1.003) { // 0.3% threshold
      trend.push(1); // Uptrend
    } else if (smmaFast[i] < smmaSlow[i] * 0.997) {
      trend.push(-1); // Downtrend
    } else {
      trend.push(0); // Neutral
    }
  }

  return trend;
}

/**
 * Pobierz trend dzienny dla danej świecy 4h
 */
function getDailyTrendForCandle(
  candleTimestamp: number,
  dailyTimestamps: number[],
  dailyTrend: number[]
): number {
  // Znajdź dzień odpowiadający tej świecy 4h
  const dayMs = 24 * 60 * 60 * 1000;
  const candleDay = Math.floor(candleTimestamp / dayMs) * dayMs;
  
  // Szukaj poprzedniego dnia (nie bieżącego - bo jeszcze się nie zakończył)
  const prevDay = candleDay - dayMs;
  
  for (let i = dailyTimestamps.length - 1; i >= 0; i--) {
    if (dailyTimestamps[i] <= prevDay) {
      return dailyTrend[i];
    }
  }
  
  return 0; // Brak danych
}

async function fetchMarketData(
  symbol: string,
  timeframe: Timeframe,
  startDate: Date,
  endDate: Date,
  use1mBase: boolean = true
): Promise<MarketDataResult> {
  try {
    let raw1m: OHLCV[] = [];
    let primaryData: AggregatedCandle[];

    if (use1mBase) {
      // Pobierz dane 1m jako bazę (z cache jeśli dostępny)
      console.log('     Pobieranie danych 1m (baza)...');
      
      const totalMinutes = Math.ceil((endDate.getTime() - startDate.getTime()) / (60 * 1000));
      console.log(`     (${totalMinutes.toLocaleString()} świec do pobrania)`);
      
      const result = await fetchCachedCandles(
        symbol,
        '1m',
        startDate,
        endDate,
        {},
        (msg, loaded, total) => {
          if (loaded !== undefined && total !== undefined) {
            process.stdout.write(`\r     ${msg}`);
          } else {
            console.log(`     ${msg}`);
          }
        }
      );
      raw1m = result.candles;
      
      if (result.stats.fromCache > 0) {
        console.log(`     📦 Cache hit: ${result.stats.fromCache} świec z MongoDB`);
      }
      if (result.stats.fromApi > 0) {
        console.log(`     🌐 Pobrano: ${result.stats.fromApi} świec z Bybit`);
      }
      console.log(`     ⏱️ Czas: ${(result.stats.totalTime / 1000).toFixed(1)}s`);

      // Agreguj do żądanego TF z metrykami dynamiki
      console.log(`     Agregacja 1m → ${timeframe} z metrykami dynamiki...`);
      const targetMs = timeframeToMs(timeframe);
      primaryData = aggregateWithDynamics(raw1m, targetMs);
      console.log(`     Utworzono ${primaryData.length} świec ${timeframe} z dynamiką`);
    } else {
      // Pobierz bezpośrednio żądany TF (z cache)
      console.log(`     Pobieranie danych ${timeframe}...`);
      
      const result = await fetchCachedCandles(
        symbol,
        timeframe,
        startDate,
        endDate,
        {},
        (msg) => console.log(`     ${msg}`)
      );
      
      // Konwertuj do AggregatedCandle (bez dynamiki)
      primaryData = result.candles.map(c => ({
        ...c,
        dynamics: getEmptyDynamics(),
      }));
      
      console.log(`     ⏱️ Czas: ${(result.stats.totalTime / 1000).toFixed(1)}s`);
    }

    // Pobierz dane dzienne dla MTF (z cache)
    console.log('     Pobieranie danych 1d dla MTF...');
    const dailyResult = await fetchCachedCandles(
      symbol,
      '1d',
      startDate,
      endDate,
      {},
      (msg) => process.stdout.write(`\r     ${msg}`)
    );
    const dailyData = dailyResult.candles;
    console.log('');

    // Oblicz trend dzienny
    const dailyTrend = calculateDailyTrend(dailyData);
    const dailyTimestamps = dailyData.map(d => d.timestamp);

    console.log(`     📊 MTF: ${dailyData.length} świec dziennych`);
    const upDays = dailyTrend.filter((t) => t === 1).length;
    const downDays = dailyTrend.filter((t) => t === -1).length;
    console.log(`     📈 Trend: ${upDays} dni UP, ${downDays} dni DOWN`);

    // Podsumowanie dynamiki
    if (use1mBase && primaryData.length > 0) {
      const avgVelocity = primaryData.reduce((sum, c) => sum + Math.abs(c.dynamics.priceVelocity), 0) / primaryData.length;
      const spikeCount = primaryData.filter(c => c.dynamics.volumeSpike).length;
      console.log(`     ⚡ Dynamika: avg velocity ${avgVelocity.toFixed(4)}/min, ${spikeCount} volume spikes`);
    }

    return {
      raw1m,
      primary: primaryData,
      daily: dailyData,
      dailyTrend,
      dailyTimestamps,
    };
  } catch (error) {
    console.warn(`     ⚠️ Błąd: ${(error as Error).message}`);
    console.log('     Używam danych syntetycznych jako fallback...');

    const syntheticData = generateSyntheticData(symbol, timeframe, startDate, endDate, {
      seed: 42,
    });
    const primaryData = syntheticData.map(c => ({
      ...c,
      dynamics: getEmptyDynamics(),
    }));
    const dailyData = aggregateOHLCV(syntheticData, timeframe, '1d');
    const dailyTrend = calculateDailyTrend(dailyData);
    const dailyTimestamps = dailyData.map(d => d.timestamp);

    return {
      raw1m: [],
      primary: primaryData,
      daily: dailyData,
      dailyTrend,
      dailyTimestamps,
    };
  }
}

function getEmptyDynamics(): DynamicsMetrics {
  return {
    priceVelocity: 0,
    velocityAcceleration: 0,
    volumeSpike: false,
    volumeAtHigh: 0.5,
    volumeAtLow: 0.5,
    volumeTrend: 0,
    bodyToWickRatio: 0,
    closePosition: 0.5,
    consecutiveDirection: 0,
    intrabarVolatility: 0,
    volatilityClustering: 1,
    numberOfReversals: 0,
    maxDrawdownIntra: 0,
    avgCandleSize: 0,
  };
}

// ============================================================================
// MTF Filter - filtruj świece na podstawie trendu dziennego
// ============================================================================

interface ExtendedCandle extends AggregatedCandle {
  dailyTrend?: number; // 1 = up, -1 = down, 0 = neutral
}

function addDailyTrendToCandles(
  candles: AggregatedCandle[],
  dailyTimestamps: number[],
  dailyTrend: number[]
): ExtendedCandle[] {
  return candles.map(candle => ({
    ...candle,
    dailyTrend: getDailyTrendForCandle(candle.timestamp, dailyTimestamps, dailyTrend),
  }));
}

// ============================================================================
// Strategia - Single Source of Truth z @trading-system/core
// ============================================================================

function createSampleStrategy(): StrategySchema {
  // Używamy strategii zdefiniowanej w core - Single Source of Truth!
  return PIVOT_SMMA_V3_STRATEGY;
}

// ============================================================================
// Formatowanie wyników
// ============================================================================

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}min`;
}

function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function formatCurrency(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function printHeader(): void {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║            AI Trading System - Backtest CLI                         ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log('');
}

function printResults(result: BacktestResult): void {
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('                         WYNIKI BACKTESTU                               ');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('');

  // Status
  const statusIcon = result.status === 'completed' ? '✅' : '❌';
  console.log(`  Status: ${statusIcon} ${result.status.toUpperCase()}`);
  console.log(`  ID: ${result.id}`);
  console.log(`  Strategia: ${result.strategyId} v${result.strategyVersion}`);

  const m = result.metrics;
  if (!m) {
    console.log('  Brak metryk.');
    return;
  }

  console.log('');
  console.log('┌─────────────────────────────────────────────────────────────────────┐');
  console.log('│  ZWROTY                                                             │');
  console.log('├─────────────────────────────────────────────────────────────────────┤');
  console.log(`│  Całkowity zwrot:        ${formatPercent(m.totalReturn).padStart(12)}                             │`);
  console.log(`│  Zwrot absolutny:        ${formatCurrency(m.totalReturnAbsolute).padStart(12)}                             │`);
  console.log(`│  CAGR:                   ${formatPercent(m.cagr).padStart(12)}                             │`);
  console.log(`│  Średni miesięczny:      ${formatPercent(m.monthlyAvgReturn).padStart(12)}                             │`);
  console.log('└─────────────────────────────────────────────────────────────────────┘');

  console.log('');
  console.log('┌─────────────────────────────────────────────────────────────────────┐');
  console.log('│  RYZYKO                                                             │');
  console.log('├─────────────────────────────────────────────────────────────────────┤');
  console.log(`│  Max Drawdown:           ${formatPercent(-m.maxDrawdown).padStart(12)}                             │`);
  console.log(`│  Sharpe Ratio:           ${m.sharpeRatio.toFixed(2).padStart(12)}                             │`);
  console.log(`│  Sortino Ratio:          ${m.sortinoRatio.toFixed(2).padStart(12)}                             │`);
  console.log(`│  Calmar Ratio:           ${m.calmarRatio.toFixed(2).padStart(12)}                             │`);
  console.log(`│  Volatility:             ${formatPercent(m.volatility).padStart(12)}                             │`);
  console.log('└─────────────────────────────────────────────────────────────────────┘');

  console.log('');
  console.log('┌─────────────────────────────────────────────────────────────────────┐');
  console.log('│  TRADING                                                            │');
  console.log('├─────────────────────────────────────────────────────────────────────┤');
  console.log(`│  Całkowita liczba transakcji:  ${m.totalTrades.toString().padStart(8)}                            │`);
  console.log(`│  Wygrane / Przegrane:     ${m.winningTrades.toString().padStart(4)} / ${m.losingTrades.toString().padEnd(4)}                             │`);
  console.log(`│  Win Rate:               ${formatPercent(m.winRate).padStart(12)}                             │`);
  console.log(`│  Profit Factor:          ${m.profitFactor === Infinity ? '∞'.padStart(12) : m.profitFactor.toFixed(2).padStart(12)}                             │`);
  console.log(`│  Średni zysk:            ${formatPercent(m.avgWin).padStart(12)}                             │`);
  console.log(`│  Średnia strata:         ${formatPercent(m.avgLoss).padStart(12)}                             │`);
  console.log(`│  Średnia transakcja:     ${formatPercent(m.avgTrade).padStart(12)}                             │`);
  console.log('└─────────────────────────────────────────────────────────────────────┘');

  console.log('');
  console.log('┌─────────────────────────────────────────────────────────────────────┐');
  console.log('│  EKSPOZYCJA                                                         │');
  console.log('├─────────────────────────────────────────────────────────────────────┤');
  console.log(`│  Long / Short:           ${m.longTrades.toString().padStart(4)} / ${m.shortTrades.toString().padEnd(4)}                             │`);
  console.log(`│  Long Win Rate:          ${formatPercent(m.longWinRate).padStart(12)}                             │`);
  console.log(`│  Short Win Rate:         ${formatPercent(m.shortWinRate).padStart(12)}                             │`);
  console.log(`│  Średni czas pozycji:    ${m.avgHoldingTime.toFixed(1).padStart(8)} min                          │`);
  console.log(`│  Czas w rynku:           ${formatPercent(m.timeInMarket).padStart(12)}                             │`);
  console.log('└─────────────────────────────────────────────────────────────────────┘');

  console.log('');
  console.log('┌─────────────────────────────────────────────────────────────────────┐');
  console.log('│  KAPITAŁ                                                            │');
  console.log('├─────────────────────────────────────────────────────────────────────┤');
  console.log(`│  Kapitał początkowy:     ${formatCurrency(m.initialCapital).padStart(12)}                             │`);
  console.log(`│  Kapitał końcowy:        ${formatCurrency(m.finalCapital).padStart(12)}                             │`);
  console.log(`│  Szczyt kapitału:        ${formatCurrency(m.peakCapital).padStart(12)}                             │`);
  console.log(`│  Suma prowizji:          ${formatCurrency(m.totalCommission).padStart(12)}                             │`);
  console.log('└─────────────────────────────────────────────────────────────────────┘');

  console.log('');
  console.log('───────────────────────────────────────────────────────────────────────');
  console.log(`  Czas wykonania: ${formatDuration(result.duration || 0)}`);
  console.log(`  Przetworzone świece: ${result.processedCandles} / ${result.totalCandles}`);
  console.log('───────────────────────────────────────────────────────────────────────');
  console.log('');
}

function printTrades(result: BacktestResult, candlesWithTrend: ExtendedCandle[], limit = 15): void {
  if (result.trades.length === 0) {
    console.log('  Brak transakcji do wyświetlenia.');
    return;
  }

  console.log(`\n  Ostatnie ${Math.min(limit, result.trades.length)} transakcji:`);
  console.log('  ─────────────────────────────────────────────────────────────────────────');
  console.log('  #   │ Side  │ Entry       │ Exit        │ P&L        │ Dur  │ D.Trend');
  console.log('  ─────────────────────────────────────────────────────────────────────────');

  const trades = result.trades.slice(-limit);
  trades.forEach((trade, index) => {
    const duration = Math.round(trade.holdingTime / (60 * 60 * 1000));
    const side = trade.side === 'long' ? '🟢 L' : '🔴 S';
    const pnl = trade.netPnl >= 0 ? `+${trade.netPnl.toFixed(2)}` : trade.netPnl.toFixed(2);
    
    // Znajdź trend dzienny dla tej transakcji
    const entryCandle = candlesWithTrend.find(c => Math.abs(c.timestamp - trade.entryTime) < 4 * 60 * 60 * 1000);
    const dailyTrendStr = entryCandle?.dailyTrend === 1 ? '📈 UP' : 
                          entryCandle?.dailyTrend === -1 ? '📉 DN' : '➖ --';

    console.log(
      `  ${(index + 1).toString().padStart(3)} │ ${side}   │ ${formatCurrency(trade.entryPrice).padStart(11)} │ ${formatCurrency(trade.exitPrice).padStart(11)} │ ${pnl.padStart(10)} │ ${duration.toString().padStart(4)}h │ ${dailyTrendStr}`
    );
  });

  console.log('  ─────────────────────────────────────────────────────────────────────────');
  
  // Podsumowanie MTF
  const allTrades = result.trades;
  const uptrendTrades = allTrades.filter((trade) => {
    const entryCandle = candlesWithTrend.find(c => Math.abs(c.timestamp - trade.entryTime) < 4 * 60 * 60 * 1000);
    return entryCandle?.dailyTrend === 1;
  });
  const downtrendTrades = allTrades.filter((trade) => {
    const entryCandle = candlesWithTrend.find(c => Math.abs(c.timestamp - trade.entryTime) < 4 * 60 * 60 * 1000);
    return entryCandle?.dailyTrend === -1;
  });
  const neutralTrades = allTrades.filter((trade) => {
    const entryCandle = candlesWithTrend.find(c => Math.abs(c.timestamp - trade.entryTime) < 4 * 60 * 60 * 1000);
    return entryCandle?.dailyTrend === 0 || !entryCandle;
  });
  
  const uptrendPnl = uptrendTrades.reduce((sum, t) => sum + t.netPnl, 0);
  const downtrendPnl = downtrendTrades.reduce((sum, t) => sum + t.netPnl, 0);
  const neutralPnl = neutralTrades.reduce((sum, t) => sum + t.netPnl, 0);
  
  const uptrendWins = uptrendTrades.filter(t => t.netPnl > 0).length;
  const downtrendWins = downtrendTrades.filter(t => t.netPnl > 0).length;
  
  console.log(`\n  📊 MTF Analysis:`);
  console.log(`     Transakcje w UP trend:      ${uptrendTrades.length.toString().padStart(2)} (Win: ${uptrendWins}/${uptrendTrades.length}, P&L: ${formatCurrency(uptrendPnl)})`);
  console.log(`     Transakcje w DOWN trend:    ${downtrendTrades.length.toString().padStart(2)} (Win: ${downtrendWins}/${downtrendTrades.length}, P&L: ${formatCurrency(downtrendPnl)})`);
  console.log(`     Transakcje w NEUTRAL trend: ${neutralTrades.length.toString().padStart(2)} (P&L: ${formatCurrency(neutralPnl)})`);
  
  if (downtrendPnl < 0 && uptrendPnl > 0) {
    console.log(`\n     💡 Tip: Filtruj tylko transakcje w UP trend - zyskalibyś ${formatCurrency(uptrendPnl)} zamiast ${formatCurrency(uptrendPnl + downtrendPnl + neutralPnl)}`);
  }
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  printHeader();

  // Parsowanie argumentów
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose') || args.includes('-v');
  const fastMode = args.includes('--fast') || args.includes('-f'); // Bez pobierania 1m
  const showCacheStats = args.includes('--cache-stats');

  // Pokaż statystyki cache jeśli żądane
  if (showCacheStats) {
    console.log('  📦 Statystyki cache MongoDB:');
    try {
      const stats = await getCacheStats();
      if (stats.available) {
        console.log(`     Status:        Połączony ✅`);
        console.log(`     Świece:        ${stats.totalCandles.toLocaleString()}`);
        console.log(`     Symbole:       ${stats.symbols.join(', ') || 'brak'}`);
        console.log(`     Timeframes:    ${stats.timeframes.join(', ') || 'brak'}`);
        if (stats.oldestCandle) {
          console.log(`     Najstarsza:    ${stats.oldestCandle.toISOString().slice(0, 10)}`);
        }
        if (stats.newestCandle) {
          console.log(`     Najnowsza:     ${stats.newestCandle.toISOString().slice(0, 10)}`);
        }
      } else {
        console.log(`     Status:        Niedostępny ❌`);
        console.log(`     Uruchom:       docker-compose up -d mongodb`);
      }
    } catch (e) {
      console.log(`     Status:        Błąd - ${(e as Error).message}`);
    }
    console.log('');
    return;
  }

  // Konfiguracja
  const symbol = 'BTCUSDT';
  const timeframe: Timeframe = '4h';
  // Dla trybu 1m używamy 2 miesiące (potrzeba 200 świec 4h = ~33 dni lookback)
  const use1mMode = !fastMode;
  // Bieżąca data - 2 miesiące dla 1m mode, 1 rok dla fast mode
  const now = new Date();
  const startDate = use1mMode 
    ? new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)  // 2 miesiące wstecz
    : new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); // 1 rok wstecz
  const endDate = now;
  const initialCapital = 10000;
  const commissionPercent = 0.0006; // 0.06%
  const slippagePercent = 0.0003;   // 0.03%
  
  // Konfiguracja backtestu (zgodna z BacktestConfig)
  const backtestConfig: BacktestConfig = {
    startDate,
    endDate,
    initialCapital,
    currency: 'USD',
    commissionPercent,
    slippagePercent,
    fillModel: 'realistic',
    dataSource: 'exchange',
  };

  console.log('  📊 Konfiguracja backtestu:');
  console.log(`     Symbol:         ${symbol}`);
  console.log(`     Timeframe:      ${timeframe}`);
  console.log(`     Okres:          ${startDate.toISOString().slice(0, 10)} - ${endDate.toISOString().slice(0, 10)}`);
  console.log(`     Kapitał:        ${formatCurrency(initialCapital)}`);
  console.log(`     Prowizja:       ${(commissionPercent * 100).toFixed(3)}%`);
  console.log(`     Slippage:       ${(slippagePercent * 100).toFixed(3)}%`);
  console.log('');

  // Pobierz strategię z core (Single Source of Truth)
  console.log('  📋 Ładowanie strategii...');
  const strategy = createSampleStrategy();
  console.log(`     Strategia: ${strategy.name} v${strategy.version}`);
  console.log('');

  // Pobierz dane z Bybit (z MTF)
  const use1mBase = !fastMode;
  console.log(`  📈 Pobieranie danych rynkowych z Bybit (MTF${use1mBase ? ', baza 1m' : ''})...`);
  if (use1mBase) {
    console.log('     (użyj --fast żeby pominąć pobieranie 1m)');
  }
  const marketData = await fetchMarketData(
    symbol,
    timeframe,
    startDate,
    endDate,
    use1mBase
  );
  const data = marketData.primary;
  
  // Dodaj trend dzienny do świec
  const candlesWithTrend = addDailyTrendToCandles(
    data,
    marketData.dailyTimestamps,
    marketData.dailyTrend
  );
  
  console.log(`     Załadowano ${data.length} świec ${timeframe}`);
  if (data.length > 0) {
    const firstPrice = data[0].close;
    const lastPrice = data[data.length - 1].close;
    console.log(`     Zakres cen: $${firstPrice.toLocaleString()} - $${lastPrice.toLocaleString()}`);
  }
  console.log('');

  // Uruchom backtest
  console.log('  🚀 Uruchamianie backtestu...');
  const engine = new BacktestEngine(strategy, backtestConfig);

  const result = await engine.run(data, symbol, (progress) => {
    process.stdout.write(`\r     Postęp: ${progress}%`);
  });
  console.log('     Postęp: 100% ✓                    ');

  // Wyświetl wyniki
  printResults(result);

  // Wyświetl transakcje z informacją o trendzie dziennym
  if (verbose || result.trades.length <= 20) {
    printTrades(result, candlesWithTrend);
  }

  console.log('  ✅ Backtest zakończony pomyślnie.');
  console.log('');
}

main().catch((error) => {
  console.error('❌ Błąd:', error);
  process.exit(1);
});
