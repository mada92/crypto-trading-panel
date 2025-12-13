import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../services/api.service';

@Component({
  standalone: true,
  imports: [CommonModule, RouterModule],
  selector: 'app-strategies',
  template: `
    <div class="strategies-page">
      <header class="page-header">
        <div>
          <h1>Strategie</h1>
          <p class="subtitle">Zarządzaj strategiami tradingowymi</p>
        </div>
        <button class="btn btn-primary" (click)="showCreateModal = true">
          ➕ Nowa strategia
        </button>
      </header>

      @if (loading) {
      <div class="loading">Ładowanie...</div>
      } @else if (strategies.length === 0) {
      <div class="empty-state">
        <div class="empty-icon">📊</div>
        <h3>Brak strategii</h3>
        <p>Utwórz swoją pierwszą strategię tradingową</p>
        <button class="btn btn-primary" (click)="showCreateModal = true">
          Utwórz strategię
        </button>
      </div>
      } @else {
      <div class="strategies-grid">
        @for (strategy of strategies; track strategy.id) {
        <div class="strategy-card">
          <div class="strategy-header">
            <h3>{{ strategy.schema.name }}</h3>
            <span
              class="status-badge"
              [class.draft]="strategy.schema.status === 'draft'"
              [class.testing]="strategy.schema.status === 'testing'"
              [class.live]="strategy.schema.status === 'live'"
            >
              {{ strategy.schema.status }}
            </span>
          </div>

          <p class="strategy-description">
            {{ strategy.schema.description || 'Brak opisu' }}
          </p>

          <div class="strategy-meta">
            <div class="meta-item">
              <span class="meta-label">Timeframe</span>
              <span class="meta-value">{{
                strategy.schema.dataRequirements.primaryTimeframe
              }}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Symbole</span>
              <span class="meta-value">{{
                strategy.schema.dataRequirements.symbols.join(', ')
              }}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Wskaźniki</span>
              <span class="meta-value">{{
                strategy.schema.indicators.length
              }}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Wersja</span>
              <span class="meta-value">v{{ strategy.schema.version }}</span>
            </div>
          </div>

          <div class="strategy-actions">
            <a
              [routerLink]="['/strategies', strategy.id]"
              class="btn btn-secondary"
            >
              Szczegóły
            </a>
            <button
              class="btn btn-primary"
              (click)="runBacktest(strategy.id)"
            >
              🚀 Backtest
            </button>
          </div>
        </div>
        }
      </div>
      }
    </div>
  `,
  styles: [
    `
      .strategies-page {
        max-width: 1400px;
      }

      .page-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 32px;
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
        text-decoration: none;
      }

      .btn-secondary:hover {
        background: #444;
      }

      .loading {
        text-align: center;
        padding: 64px;
        color: #888;
      }

      .empty-state {
        text-align: center;
        padding: 80px 20px;
        background: #1a1a1a;
        border-radius: 12px;
        border: 1px dashed #333;
      }

      .empty-icon {
        font-size: 64px;
        margin-bottom: 16px;
      }

      .empty-state h3 {
        color: #fff;
        margin: 0 0 8px 0;
      }

      .empty-state p {
        color: #888;
        margin: 0 0 24px 0;
      }

      .strategies-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
        gap: 24px;
      }

      .strategy-card {
        background: #1a1a1a;
        border: 1px solid #2a2a2a;
        border-radius: 12px;
        padding: 24px;
        transition: all 0.2s;
      }

      .strategy-card:hover {
        border-color: #3a3a3a;
      }

      .strategy-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 12px;
      }

      .strategy-header h3 {
        font-size: 18px;
        font-weight: 600;
        color: #fff;
        margin: 0;
      }

      .status-badge {
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 12px;
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

      .strategy-description {
        color: #888;
        font-size: 14px;
        margin: 0 0 20px 0;
        line-height: 1.5;
      }

      .strategy-meta {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
        margin-bottom: 20px;
        padding: 16px;
        background: #0f0f0f;
        border-radius: 8px;
      }

      .meta-item {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .meta-label {
        font-size: 12px;
        color: #666;
        text-transform: uppercase;
      }

      .meta-value {
        font-size: 14px;
        color: #fff;
        font-weight: 500;
      }

      .strategy-actions {
        display: flex;
        gap: 12px;
      }

      .strategy-actions .btn {
        flex: 1;
        text-align: center;
      }
    `,
  ],
})
export class StrategiesComponent implements OnInit {
  private apiService = inject(ApiService);

  strategies: any[] = [];
  loading = true;
  showCreateModal = false;

  ngOnInit() {
    this.loadStrategies();
  }

  async loadStrategies() {
    try {
      this.strategies = await this.apiService.getStrategies();
    } catch (error) {
      console.error('Failed to load strategies:', error);
    } finally {
      this.loading = false;
    }
  }

  async runBacktest(strategyId: string) {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - 1);

      const result = await this.apiService.runBacktest({
        strategyId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        initialCapital: 10000,
      });

      alert(`Backtest uruchomiony! ID: ${result.backtestId}`);
    } catch (error) {
      console.error('Failed to run backtest:', error);
      alert('Błąd podczas uruchamiania backtestu');
    }
  }
}
