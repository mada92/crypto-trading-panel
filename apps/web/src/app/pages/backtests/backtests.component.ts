import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

interface BacktestSummary {
  id: string;
  strategyId: string;
  strategyVersion: string;
  status: string;
  startedAt?: string;
  completedAt?: string;
  metrics?: {
    totalReturn: number;
    winRate: number;
    totalTrades: number;
    maxDrawdown: number;
    sharpeRatio: number;
  };
}

@Component({
  selector: 'app-backtests',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="backtests-page">
      <header class="page-header">
        <h1>📊 Backtesty</h1>
        <p class="subtitle">Historia i wyniki testów strategii</p>
      </header>

      <!-- Uruchom nowy backtest -->
      <section class="new-backtest-section">
        <h2>🚀 Uruchom nowy backtest</h2>

        <div class="form-grid">
          <div class="form-group">
            <label for="strategy">Strategia</label>
            <select
              id="strategy"
              [(ngModel)]="newBacktest.strategyId"
              class="form-control"
            >
              <option value="">Wybierz strategię...</option>
              @for (strategy of strategies(); track strategy.id) {
              <option [value]="strategy.id">{{ strategy.schema.name }}</option>
              }
            </select>
          </div>

          <div class="form-group">
            <label for="symbol">Symbol</label>
            <select
              id="symbol"
              [(ngModel)]="newBacktest.symbol"
              class="form-control"
            >
              @for (symbol of symbols(); track symbol) {
              <option [value]="symbol">{{ symbol }}</option>
              }
            </select>
          </div>

          <div class="form-group">
            <label for="timeframe">Timeframe</label>
            <select
              id="timeframe"
              [(ngModel)]="newBacktest.timeframe"
              class="form-control"
            >
              <option value="1m">1m</option>
              <option value="5m">5m</option>
              <option value="15m">15m</option>
              <option value="30m">30m</option>
              <option value="1h">1h</option>
              <option value="4h">4h</option>
              <option value="1d">1d</option>
              <option value="1w">1w</option>
            </select>
          </div>

          <div class="form-group">
            <label for="startDate">Data początkowa</label>
            <input
              type="date"
              id="startDate"
              [(ngModel)]="newBacktest.startDate"
              class="form-control"
            />
          </div>

          <div class="form-group">
            <label for="endDate">Data końcowa</label>
            <input
              type="date"
              id="endDate"
              [(ngModel)]="newBacktest.endDate"
              class="form-control"
            />
          </div>

          <div class="form-group">
            <label for="capital">Kapitał początkowy ($)</label>
            <input
              type="number"
              id="capital"
              [(ngModel)]="newBacktest.initialCapital"
              class="form-control"
              min="100"
              step="100"
            />
          </div>
        </div>

        <button
          class="btn btn-primary"
          (click)="runBacktest()"
          [disabled]="running() || !newBacktest.strategyId"
        >
          @if (running()) {
          <span class="spinner"></span> Uruchamianie...
          } @else { ▶️ Uruchom backtest }
        </button>
      </section>

      <!-- Lista backtestów -->
      <section class="backtests-list-section">
        <h2>📋 Historia backtestów</h2>

        @if (loading()) {
        <div class="loading">Ładowanie...</div>
        } @else if (backtests().length === 0) {
        <div class="empty-state">
          <p>Brak wykonanych backtestów.</p>
          <p>Uruchom pierwszy backtest powyżej!</p>
        </div>
        } @else {
        <div class="backtests-table">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Strategia</th>
                <th>Status</th>
                <th>Zwrot</th>
                <th>Win Rate</th>
                <th>Max DD</th>
                <th>Sharpe</th>
                <th>Transakcje</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (backtest of backtests(); track backtest.id) {
              <tr [class.completed]="backtest.status === 'completed'">
                <td>{{ formatDate(backtest.startedAt) }}</td>
                <td>
                  <span class="strategy-name">{{ backtest.strategyId }}</span>
                  <span class="version">v{{ backtest.strategyVersion }}</span>
                </td>
                <td>
                  <span [class]="'status-badge status-' + backtest.status">
                    {{ getStatusIcon(backtest.status) }}
                    {{ backtest.status }}
                  </span>
                </td>
                <td
                  [class.positive]="
                    backtest.metrics && backtest.metrics.totalReturn > 0
                  "
                  [class.negative]="
                    backtest.metrics && backtest.metrics.totalReturn < 0
                  "
                >
                  {{
                    backtest.metrics
                      ? formatPercent(backtest.metrics.totalReturn)
                      : '-'
                  }}
                </td>
                <td>
                  {{
                    backtest.metrics
                      ? formatPercent(backtest.metrics.winRate)
                      : '-'
                  }}
                </td>
                <td class="negative">
                  {{
                    backtest.metrics
                      ? formatPercent(-backtest.metrics.maxDrawdown)
                      : '-'
                  }}
                </td>
                <td>
                  {{ backtest.metrics ? backtest.metrics.sharpeRatio.toFixed(2) : '-' }}
                </td>
                <td>
                  {{ backtest.metrics ? backtest.metrics.totalTrades : '-' }}
                </td>
                <td>
                  <a [routerLink]="['/backtests', backtest.id]" class="btn-link">
                    Szczegóły →
                  </a>
                </td>
              </tr>
              }
            </tbody>
          </table>
        </div>
        }
      </section>
    </div>
  `,
  styles: [
    `
      .backtests-page {
        padding: 2rem;
        max-width: 1400px;
        margin: 0 auto;
      }

      .page-header {
        margin-bottom: 2rem;
      }

      .page-header h1 {
        font-size: 2rem;
        margin: 0;
        color: #1a1a2e;
      }

      .subtitle {
        color: #666;
        margin-top: 0.5rem;
      }

      .new-backtest-section,
      .backtests-list-section {
        background: white;
        border-radius: 12px;
        padding: 1.5rem;
        margin-bottom: 2rem;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
      }

      h2 {
        font-size: 1.25rem;
        margin: 0 0 1rem 0;
        color: #1a1a2e;
      }

      .form-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
        margin-bottom: 1.5rem;
      }

      .form-group {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .form-group label {
        font-size: 0.875rem;
        font-weight: 500;
        color: #555;
      }

      .form-control {
        padding: 0.75rem;
        border: 1px solid #ddd;
        border-radius: 8px;
        font-size: 1rem;
        transition: border-color 0.2s;
      }

      .form-control:focus {
        outline: none;
        border-color: #4f46e5;
        box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
      }

      .btn {
        padding: 0.75rem 1.5rem;
        border: none;
        border-radius: 8px;
        font-size: 1rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
      }

      .btn-primary {
        background: #4f46e5;
        color: white;
      }

      .btn-primary:hover:not(:disabled) {
        background: #4338ca;
      }

      .btn-primary:disabled {
        background: #9ca3af;
        cursor: not-allowed;
      }

      .spinner {
        width: 16px;
        height: 16px;
        border: 2px solid transparent;
        border-top-color: white;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      .loading {
        text-align: center;
        padding: 2rem;
        color: #666;
      }

      .empty-state {
        text-align: center;
        padding: 3rem;
        color: #666;
      }

      .backtests-table {
        overflow-x: auto;
      }

      table {
        width: 100%;
        border-collapse: collapse;
      }

      th,
      td {
        padding: 0.75rem 1rem;
        text-align: left;
        border-bottom: 1px solid #eee;
      }

      th {
        background: #f8f9fa;
        font-weight: 600;
        font-size: 0.875rem;
        color: #555;
      }

      tbody tr:hover {
        background: #f8f9fa;
      }

      .strategy-name {
        font-weight: 500;
      }

      .version {
        color: #888;
        font-size: 0.875rem;
        margin-left: 0.5rem;
      }

      .status-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.25rem 0.75rem;
        border-radius: 20px;
        font-size: 0.875rem;
        font-weight: 500;
      }

      .status-completed {
        background: #d1fae5;
        color: #065f46;
      }

      .status-running {
        background: #dbeafe;
        color: #1e40af;
      }

      .status-failed {
        background: #fee2e2;
        color: #991b1b;
      }

      .status-pending {
        background: #f3f4f6;
        color: #374151;
      }

      .positive {
        color: #059669;
        font-weight: 500;
      }

      .negative {
        color: #dc2626;
        font-weight: 500;
      }

      .btn-link {
        color: #4f46e5;
        text-decoration: none;
        font-weight: 500;
      }

      .btn-link:hover {
        text-decoration: underline;
      }
    `,
  ],
})
export class BacktestsComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);

  loading = signal(true);
  running = signal(false);
  backtests = signal<BacktestSummary[]>([]);
  strategies = signal<any[]>([]);
  symbols = signal<string[]>([
    'BTCUSDT',
    'ETHUSDT',
    'SOLUSDT',
    'BNBUSDT',
    'XRPUSDT',
  ]);

  newBacktest = {
    strategyId: '',
    symbol: 'BTCUSDT',
    timeframe: '4h' as '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w',
    startDate: this.getDefaultStartDate(),
    endDate: this.getDefaultEndDate(),
    initialCapital: 10000,
  };

  ngOnInit() {
    this.loadData();
  }

  async loadData() {
    try {
      const [backtests, strategies] = await Promise.all([
        this.api.getBacktests(),
        this.api.getStrategies(),
      ]);
      this.backtests.set(backtests);
      this.strategies.set(strategies);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      this.loading.set(false);
    }
  }

  async runBacktest() {
    if (!this.newBacktest.strategyId) return;

    this.running.set(true);
    try {
      const result = await this.api.runBacktest({
        strategyId: this.newBacktest.strategyId,
        startDate: this.newBacktest.startDate,
        endDate: this.newBacktest.endDate,
        symbol: this.newBacktest.symbol,
        timeframe: this.newBacktest.timeframe,
        initialCapital: this.newBacktest.initialCapital,
      });

      // Poczekaj chwilę i przejdź do wyników
      setTimeout(() => {
        this.router.navigate(['/backtests', result.backtestId]);
      }, 1000);
    } catch (error) {
      console.error('Failed to run backtest:', error);
      this.running.set(false);
    }
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pl-PL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatPercent(value: number): string {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  }

  getStatusIcon(status: string): string {
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

  private getDefaultStartDate(): string {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 1);
    return date.toISOString().split('T')[0];
  }

  private getDefaultEndDate(): string {
    return new Date().toISOString().split('T')[0];
  }
}
