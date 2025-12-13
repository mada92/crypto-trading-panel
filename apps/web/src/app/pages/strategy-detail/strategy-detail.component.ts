import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ApiService } from '../../services/api.service';

@Component({
  standalone: true,
  imports: [CommonModule, RouterModule],
  selector: 'app-strategy-detail',
  template: `
    <div class="strategy-detail">
      @if (loading) {
      <div class="loading">Ładowanie...</div>
      } @else if (!strategy) {
      <div class="not-found">Strategia nie znaleziona</div>
      } @else {
      <header class="page-header">
        <div>
          <a routerLink="/strategies" class="back-link">← Powrót do listy</a>
          <h1>{{ strategy.schema.name }}</h1>
          <p class="subtitle">{{ strategy.schema.description }}</p>
        </div>
        <div class="header-actions">
          <button class="btn btn-secondary">✏️ Edytuj</button>
          <button class="btn btn-primary" (click)="runBacktest()">
            🚀 Uruchom backtest
          </button>
        </div>
      </header>

      <div class="content-grid">
        <section class="card">
          <h2>Informacje podstawowe</h2>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Status</span>
              <span
                class="status-badge"
                [class.draft]="strategy.schema.status === 'draft'"
                [class.testing]="strategy.schema.status === 'testing'"
                [class.live]="strategy.schema.status === 'live'"
              >
                {{ strategy.schema.status }}
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">Wersja</span>
              <span class="info-value">v{{ strategy.schema.version }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Timeframe</span>
              <span class="info-value">{{
                strategy.schema.dataRequirements.primaryTimeframe
              }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Symbole</span>
              <span class="info-value">{{
                strategy.schema.dataRequirements.symbols.join(', ')
              }}</span>
            </div>
          </div>
        </section>

        <section class="card">
          <h2>Zarządzanie ryzykiem</h2>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Ryzyko na trade</span>
              <span class="info-value"
                >{{ strategy.schema.riskManagement.riskPerTrade }}%</span
              >
            </div>
            <div class="info-item">
              <span class="info-label">Max pozycja</span>
              <span class="info-value"
                >{{ strategy.schema.riskManagement.maxPositionSize }}%</span
              >
            </div>
            <div class="info-item">
              <span class="info-label">Max otwartych pozycji</span>
              <span class="info-value">{{
                strategy.schema.riskManagement.maxOpenPositions
              }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Dźwignia</span>
              <span class="info-value"
                >{{ strategy.schema.riskManagement.leverage || 1 }}x</span
              >
            </div>
          </div>
        </section>

        <section class="card full-width">
          <h2>Wskaźniki ({{ strategy.schema.indicators.length }})</h2>
          <div class="indicators-list">
            @for (indicator of strategy.schema.indicators; track indicator.id)
            {
            <div class="indicator-item">
              <div class="indicator-type">{{ indicator.type }}</div>
              <div class="indicator-id">{{ indicator.id }}</div>
              <div class="indicator-params">
                @for (param of getParams(indicator.params); track param.key) {
                <span class="param">{{ param.key }}: {{ param.value }}</span>
                }
              </div>
            </div>
            }
          </div>
        </section>

        <section class="card full-width">
          <h2>Definicja strategii (JSON)</h2>
          <pre class="code-block">{{ strategy.schema | json }}</pre>
        </section>
      </div>
      }
    </div>
  `,
  styles: [
    `
      .strategy-detail {
        max-width: 1200px;
      }

      .loading,
      .not-found {
        text-align: center;
        padding: 64px;
        color: #888;
      }

      .page-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 32px;
      }

      .back-link {
        color: #888;
        text-decoration: none;
        font-size: 14px;
        display: inline-block;
        margin-bottom: 12px;
      }

      .back-link:hover {
        color: #fff;
      }

      .page-header h1 {
        font-size: 32px;
        font-weight: 700;
        color: #fff;
        margin: 0 0 8px 0;
      }

      .subtitle {
        color: #888;
        margin: 0;
      }

      .header-actions {
        display: flex;
        gap: 12px;
      }

      .btn {
        padding: 10px 20px;
        border-radius: 8px;
        font-weight: 500;
        cursor: pointer;
        border: none;
        transition: all 0.2s;
      }

      .btn-primary {
        background: #2563eb;
        color: #fff;
      }

      .btn-primary:hover {
        background: #1d4ed8;
      }

      .btn-secondary {
        background: #333;
        color: #fff;
      }

      .btn-secondary:hover {
        background: #444;
      }

      .content-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 24px;
      }

      .card {
        background: #1a1a1a;
        border: 1px solid #2a2a2a;
        border-radius: 12px;
        padding: 24px;
      }

      .card.full-width {
        grid-column: 1 / -1;
      }

      .card h2 {
        font-size: 16px;
        font-weight: 600;
        color: #fff;
        margin: 0 0 20px 0;
      }

      .info-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
      }

      .info-item {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .info-label {
        font-size: 12px;
        color: #666;
        text-transform: uppercase;
      }

      .info-value {
        font-size: 16px;
        color: #fff;
        font-weight: 500;
      }

      .status-badge {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 13px;
        font-weight: 500;
        background: #333;
        color: #888;
      }

      .status-badge.draft {
        background: #666;
        color: #ddd;
      }

      .status-badge.testing {
        background: #2563eb22;
        color: #2563eb;
      }

      .status-badge.live {
        background: #22c55e22;
        color: #22c55e;
      }

      .indicators-list {
        display: grid;
        gap: 12px;
      }

      .indicator-item {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 12px 16px;
        background: #0f0f0f;
        border-radius: 8px;
      }

      .indicator-type {
        font-weight: 600;
        color: #2563eb;
        min-width: 80px;
      }

      .indicator-id {
        color: #888;
        min-width: 100px;
      }

      .indicator-params {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
      }

      .param {
        font-size: 13px;
        color: #666;
        background: #1a1a1a;
        padding: 4px 8px;
        border-radius: 4px;
      }

      .code-block {
        background: #0f0f0f;
        padding: 16px;
        border-radius: 8px;
        overflow-x: auto;
        font-size: 13px;
        color: #888;
        line-height: 1.5;
        max-height: 400px;
        overflow-y: auto;
      }
    `,
  ],
})
export class StrategyDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private apiService = inject(ApiService);

  strategy: any = null;
  loading = true;

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadStrategy(id);
    }
  }

  async loadStrategy(id: string) {
    try {
      this.strategy = await this.apiService.getStrategy(id);
    } catch (error) {
      console.error('Failed to load strategy:', error);
    } finally {
      this.loading = false;
    }
  }

  getParams(params: Record<string, any>): { key: string; value: any }[] {
    return Object.entries(params).map(([key, value]) => ({ key, value }));
  }

  async runBacktest() {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - 1);

      const result = await this.apiService.runBacktest({
        strategyId: this.strategy.id,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        initialCapital: 10000,
      });

      alert(`Backtest uruchomiony! ID: ${result.backtestId}`);
    } catch (error) {
      console.error('Failed to run backtest:', error);
    }
  }
}
