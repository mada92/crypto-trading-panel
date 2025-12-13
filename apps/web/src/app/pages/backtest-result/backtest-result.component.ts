import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';

interface BacktestMetrics {
  totalReturn: number;
  totalReturnAbsolute: number;
  cagr: number;
  monthlyAvgReturn: number;
  maxDrawdown: number;
  maxDrawdownAbsolute: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  volatility: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  avgTrade: number;
  largestWin: number;
  largestLoss: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  longTrades: number;
  shortTrades: number;
  longWinRate: number;
  shortWinRate: number;
  avgHoldingTime: number;
  timeInMarket: number;
  initialCapital: number;
  finalCapital: number;
  peakCapital: number;
  totalCommission: number;
}

interface Trade {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  entryPrice: number;
  exitPrice: number;
  size: number;
  entryTime: number;
  exitTime: number;
  pnl: number;
  pnlPercent: number;
  netPnl: number;
  exitReason: string;
  holdingTime: number;
}

interface BacktestResult {
  id: string;
  strategyId: string;
  strategyVersion: string;
  status: string;
  metrics?: BacktestMetrics;
  trades: Trade[];
  equityCurve: { timestamp: number; equity: number; drawdownPercent: number }[];
  error?: string;
  duration?: number;
  totalCandles: number;
  processedCandles: number;
}

@Component({
  selector: 'app-backtest-result',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="backtest-result-page">
      <header class="page-header">
        <a routerLink="/backtests" class="back-link">← Wróć do listy</a>
        <h1>📊 Wyniki Backtestu</h1>
      </header>

      @if (loading()) {
      <div class="loading-container">
        <div class="spinner-large"></div>
        <p>Ładowanie wyników...</p>
      </div>
      } @else if (error()) {
      <div class="error-container">
        <h2>❌ Błąd</h2>
        <p>{{ error() }}</p>
      </div>
      } @else if (result()) {
      <div class="result-content">
        <!-- Status Header -->
        <section class="status-header">
          <div class="status-info">
            <span [class]="'status-badge status-' + result()?.status">
              {{ getStatusIcon(result()?.status) }} {{ result()?.status }}
            </span>
            <span class="strategy-info">
              {{ result()?.strategyId }} v{{ result()?.strategyVersion }}
            </span>
          </div>
          @if (result()?.duration) {
          <div class="execution-info">
            Czas wykonania: {{ formatDuration(result()?.duration) }} | Świece:
            {{ result()?.processedCandles }} / {{ result()?.totalCandles }}
          </div>
          }
        </section>

        @if (result()?.metrics) {
        <!-- Kluczowe metryki -->
        <section class="key-metrics">
          <div
            class="metric-card"
            [class.positive]="result()!.metrics!.totalReturn > 0"
            [class.negative]="result()!.metrics!.totalReturn < 0"
          >
            <span class="metric-label">Całkowity zwrot</span>
            <span class="metric-value">{{
              formatPercent(result()!.metrics!.totalReturn)
            }}</span>
            <span class="metric-sub">{{
              formatCurrency(result()!.metrics!.totalReturnAbsolute)
            }}</span>
          </div>

          <div class="metric-card">
            <span class="metric-label">Win Rate</span>
            <span class="metric-value">{{
              formatPercent(result()!.metrics!.winRate)
            }}</span>
            <span class="metric-sub"
              >{{ result()!.metrics!.winningTrades }} /
              {{ result()!.metrics!.totalTrades }}</span
            >
          </div>

          <div class="metric-card negative">
            <span class="metric-label">Max Drawdown</span>
            <span class="metric-value">{{
              formatPercent(-result()!.metrics!.maxDrawdown)
            }}</span>
            <span class="metric-sub">{{
              formatCurrency(-result()!.metrics!.maxDrawdownAbsolute)
            }}</span>
          </div>

          <div
            class="metric-card"
            [class.positive]="result()!.metrics!.sharpeRatio > 1"
          >
            <span class="metric-label">Sharpe Ratio</span>
            <span class="metric-value">{{
              result()!.metrics!.sharpeRatio.toFixed(2)
            }}</span>
            <span class="metric-sub">Risk-adjusted return</span>
          </div>

          <div class="metric-card">
            <span class="metric-label">Profit Factor</span>
            <span class="metric-value">{{
              formatProfitFactor(result()!.metrics!.profitFactor)
            }}</span>
            <span class="metric-sub">Gross profit / Gross loss</span>
          </div>

          <div class="metric-card">
            <span class="metric-label">Kapitał końcowy</span>
            <span class="metric-value">{{
              formatCurrency(result()!.metrics!.finalCapital)
            }}</span>
            <span class="metric-sub"
              >Start: {{ formatCurrency(result()!.metrics!.initialCapital) }}</span
            >
          </div>
        </section>

        <!-- Szczegółowe metryki -->
        <div class="metrics-grid">
          <section class="metrics-section">
            <h3>📈 Zwroty</h3>
            <div class="metrics-list">
              <div class="metric-row">
                <span>CAGR</span>
                <span>{{ formatPercent(result()!.metrics!.cagr) }}</span>
              </div>
              <div class="metric-row">
                <span>Średni miesięczny</span>
                <span>{{ formatPercent(result()!.metrics!.monthlyAvgReturn) }}</span>
              </div>
              <div class="metric-row">
                <span>Volatility</span>
                <span>{{ formatPercent(result()!.metrics!.volatility) }}</span>
              </div>
            </div>
          </section>

          <section class="metrics-section">
            <h3>⚠️ Ryzyko</h3>
            <div class="metrics-list">
              <div class="metric-row">
                <span>Sortino Ratio</span>
                <span>{{ result()!.metrics!.sortinoRatio.toFixed(2) }}</span>
              </div>
              <div class="metric-row">
                <span>Calmar Ratio</span>
                <span>{{ result()!.metrics!.calmarRatio.toFixed(2) }}</span>
              </div>
              <div class="metric-row">
                <span>Max Consecutive Losses</span>
                <span>{{ result()!.metrics!.maxConsecutiveLosses }}</span>
              </div>
            </div>
          </section>

          <section class="metrics-section">
            <h3>📊 Trading</h3>
            <div class="metrics-list">
              <div class="metric-row">
                <span>Średni zysk</span>
                <span class="positive">{{
                  formatPercent(result()!.metrics!.avgWin)
                }}</span>
              </div>
              <div class="metric-row">
                <span>Średnia strata</span>
                <span class="negative">{{
                  formatPercent(result()!.metrics!.avgLoss)
                }}</span>
              </div>
              <div class="metric-row">
                <span>Średnia transakcja</span>
                <span>{{ formatPercent(result()!.metrics!.avgTrade) }}</span>
              </div>
              <div class="metric-row">
                <span>Największy zysk</span>
                <span class="positive">{{
                  formatPercent(result()!.metrics!.largestWin)
                }}</span>
              </div>
              <div class="metric-row">
                <span>Największa strata</span>
                <span class="negative">{{
                  formatPercent(result()!.metrics!.largestLoss)
                }}</span>
              </div>
            </div>
          </section>

          <section class="metrics-section">
            <h3>🎯 Ekspozycja</h3>
            <div class="metrics-list">
              <div class="metric-row">
                <span>Long / Short</span>
                <span
                  >{{ result()!.metrics!.longTrades }} /
                  {{ result()!.metrics!.shortTrades }}</span
                >
              </div>
              <div class="metric-row">
                <span>Long Win Rate</span>
                <span>{{ formatPercent(result()!.metrics!.longWinRate) }}</span>
              </div>
              <div class="metric-row">
                <span>Short Win Rate</span>
                <span>{{ formatPercent(result()!.metrics!.shortWinRate) }}</span>
              </div>
              <div class="metric-row">
                <span>Średni czas pozycji</span>
                <span>{{ result()!.metrics!.avgHoldingTime.toFixed(0) }} min</span>
              </div>
              <div class="metric-row">
                <span>Czas w rynku</span>
                <span>{{ formatPercent(result()!.metrics!.timeInMarket) }}</span>
              </div>
            </div>
          </section>
        </div>
        }

        <!-- Lista transakcji -->
        @if (result()?.trades && result()!.trades.length > 0) {
        <section class="trades-section">
          <h3>📋 Transakcje ({{ result()!.trades.length }})</h3>
          <div class="trades-table">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Side</th>
                  <th>Wejście</th>
                  <th>Wyjście</th>
                  <th>Rozmiar</th>
                  <th>P&L</th>
                  <th>P&L %</th>
                  <th>Powód</th>
                  <th>Czas</th>
                </tr>
              </thead>
              <tbody>
                @for (trade of displayedTrades(); track trade.id; let i = $index)
                {
                <tr>
                  <td>{{ i + 1 }}</td>
                  <td>
                    <span [class]="'side-badge side-' + trade.side">
                      {{ trade.side === 'long' ? '🟢 L' : '🔴 S' }}
                    </span>
                  </td>
                  <td>{{ formatCurrency(trade.entryPrice) }}</td>
                  <td>{{ formatCurrency(trade.exitPrice) }}</td>
                  <td>{{ trade.size.toFixed(4) }}</td>
                  <td
                    [class.positive]="trade.netPnl > 0"
                    [class.negative]="trade.netPnl < 0"
                  >
                    {{ formatCurrency(trade.netPnl) }}
                  </td>
                  <td
                    [class.positive]="trade.pnlPercent > 0"
                    [class.negative]="trade.pnlPercent < 0"
                  >
                    {{ formatPercent(trade.pnlPercent) }}
                  </td>
                  <td>
                    <span class="exit-reason">{{ trade.exitReason }}</span>
                  </td>
                  <td>{{ formatHoldingTime(trade.holdingTime) }}</td>
                </tr>
                }
              </tbody>
            </table>
          </div>

          @if (result()!.trades.length > tradesLimit()) {
          <button class="btn btn-secondary" (click)="showMoreTrades()">
            Pokaż więcej ({{ result()!.trades.length - tradesLimit() }} pozostało)
          </button>
          }
        </section>
        }
      </div>
      }
    </div>
  `,
  styles: [
    `
      .backtest-result-page {
        padding: 2rem;
        max-width: 1400px;
        margin: 0 auto;
      }

      .page-header {
        margin-bottom: 2rem;
      }

      .back-link {
        color: #4f46e5;
        text-decoration: none;
        font-size: 0.875rem;
      }

      .back-link:hover {
        text-decoration: underline;
      }

      .page-header h1 {
        font-size: 2rem;
        margin: 0.5rem 0 0 0;
        color: #1a1a2e;
      }

      .loading-container,
      .error-container {
        text-align: center;
        padding: 4rem;
        background: white;
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
      }

      .spinner-large {
        width: 48px;
        height: 48px;
        border: 4px solid #e5e7eb;
        border-top-color: #4f46e5;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 1rem;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      .status-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: white;
        padding: 1rem 1.5rem;
        border-radius: 12px;
        margin-bottom: 1.5rem;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
      }

      .status-info {
        display: flex;
        align-items: center;
        gap: 1rem;
      }

      .strategy-info {
        font-weight: 500;
        color: #374151;
      }

      .execution-info {
        color: #6b7280;
        font-size: 0.875rem;
      }

      .status-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.5rem 1rem;
        border-radius: 20px;
        font-weight: 500;
      }

      .status-completed {
        background: #d1fae5;
        color: #065f46;
      }

      .status-failed {
        background: #fee2e2;
        color: #991b1b;
      }

      .key-metrics {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
        margin-bottom: 2rem;
      }

      .metric-card {
        background: white;
        padding: 1.5rem;
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .metric-card.positive {
        border-left: 4px solid #059669;
      }

      .metric-card.negative {
        border-left: 4px solid #dc2626;
      }

      .metric-label {
        font-size: 0.875rem;
        color: #6b7280;
      }

      .metric-value {
        font-size: 1.75rem;
        font-weight: 700;
        color: #1a1a2e;
      }

      .metric-sub {
        font-size: 0.875rem;
        color: #9ca3af;
      }

      .metrics-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 1.5rem;
        margin-bottom: 2rem;
      }

      .metrics-section {
        background: white;
        padding: 1.5rem;
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
      }

      .metrics-section h3 {
        font-size: 1rem;
        margin: 0 0 1rem 0;
        color: #374151;
      }

      .metrics-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .metric-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.5rem 0;
        border-bottom: 1px solid #f3f4f6;
      }

      .metric-row:last-child {
        border-bottom: none;
      }

      .metric-row span:first-child {
        color: #6b7280;
      }

      .metric-row span:last-child {
        font-weight: 500;
        color: #1a1a2e;
      }

      .positive {
        color: #059669 !important;
      }

      .negative {
        color: #dc2626 !important;
      }

      .trades-section {
        background: white;
        padding: 1.5rem;
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
      }

      .trades-section h3 {
        margin: 0 0 1rem 0;
      }

      .trades-table {
        overflow-x: auto;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.875rem;
      }

      th,
      td {
        padding: 0.75rem 0.5rem;
        text-align: left;
        border-bottom: 1px solid #f3f4f6;
      }

      th {
        background: #f8f9fa;
        font-weight: 600;
        color: #6b7280;
      }

      tbody tr:hover {
        background: #f8f9fa;
      }

      .side-badge {
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: 600;
      }

      .side-long {
        background: #d1fae5;
        color: #065f46;
      }

      .side-short {
        background: #fee2e2;
        color: #991b1b;
      }

      .exit-reason {
        font-size: 0.75rem;
        padding: 0.25rem 0.5rem;
        background: #f3f4f6;
        border-radius: 4px;
      }

      .btn {
        padding: 0.75rem 1.5rem;
        border: none;
        border-radius: 8px;
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        margin-top: 1rem;
      }

      .btn-secondary {
        background: #f3f4f6;
        color: #374151;
      }

      .btn-secondary:hover {
        background: #e5e7eb;
      }
    `,
  ],
})
export class BacktestResultComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);

  loading = signal(true);
  error = signal<string | null>(null);
  result = signal<BacktestResult | null>(null);
  tradesLimit = signal(20);

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadBacktest(id);
    } else {
      this.error.set('Brak ID backtestu');
      this.loading.set(false);
    }
  }

  async loadBacktest(id: string) {
    try {
      const result = await this.api.getBacktest(id);
      this.result.set(result);
    } catch (err) {
      this.error.set('Nie udało się załadować wyników backtestu');
    } finally {
      this.loading.set(false);
    }
  }

  displayedTrades() {
    const trades = this.result()?.trades || [];
    return trades.slice(0, this.tradesLimit());
  }

  showMoreTrades() {
    this.tradesLimit.update((l) => l + 20);
  }

  getStatusIcon(status?: string): string {
    switch (status) {
      case 'completed':
        return '✅';
      case 'running':
        return '🔄';
      case 'failed':
        return '❌';
      default:
        return '⏳';
    }
  }

  formatPercent(value: number): string {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  }

  formatCurrency(value: number): string {
    const sign = value >= 0 ? '' : '';
    return `${sign}$${Math.abs(value).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  formatDuration(ms?: number): string {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    return `${(ms / 60000).toFixed(2)}min`;
  }

  formatHoldingTime(ms: number): string {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  formatProfitFactor(value: number): string {
    if (!isFinite(value)) return '∞';
    return value.toFixed(2);
  }
}
