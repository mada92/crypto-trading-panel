import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../services/api.service';

@Component({
  standalone: true,
  imports: [CommonModule, RouterModule],
  selector: 'app-dashboard',
  template: `
    <div class="dashboard">
      <header class="page-header">
        <h1>Dashboard</h1>
        <p class="subtitle">Przegląd systemu tradingowego</p>
      </header>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">📊</div>
          <div class="stat-content">
            <div class="stat-value">{{ strategies.length }}</div>
            <div class="stat-label">Strategie</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon">🔬</div>
          <div class="stat-content">
            <div class="stat-value">{{ backtests.length }}</div>
            <div class="stat-label">Backtesty</div>
          </div>
        </div>

        <div class="stat-card success">
          <div class="stat-icon">✅</div>
          <div class="stat-content">
            <div class="stat-value">{{ completedBacktests }}</div>
            <div class="stat-label">Ukończone</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon">🤖</div>
          <div class="stat-content">
            <div class="stat-value">0</div>
            <div class="stat-label">Live Boty</div>
          </div>
        </div>
      </div>

      <div class="content-grid">
        <section class="card recent-strategies">
          <div class="card-header">
            <h2>Ostatnie strategie</h2>
            <a routerLink="/strategies" class="view-all">Zobacz wszystkie →</a>
          </div>
          <div class="card-content">
            @if (strategies.length === 0) {
            <p class="empty-state">Brak strategii. Utwórz pierwszą!</p>
            } @else { @for (strategy of strategies.slice(0, 5); track
            strategy.id) {
            <div class="list-item">
              <div class="list-item-info">
                <div class="list-item-name">{{ strategy.schema.name }}</div>
                <div class="list-item-meta">
                  v{{ strategy.schema.version }} •
                  {{ strategy.schema.dataRequirements.primaryTimeframe }}
                </div>
              </div>
              <span
                class="status-badge"
                [class.testing]="strategy.schema.status === 'testing'"
                [class.live]="strategy.schema.status === 'live'"
              >
                {{ strategy.schema.status }}
              </span>
            </div>
            } }
          </div>
        </section>

        <section class="card recent-backtests">
          <div class="card-header">
            <h2>Ostatnie backtesty</h2>
            <a routerLink="/backtests" class="view-all">Zobacz wszystkie →</a>
          </div>
          <div class="card-content">
            @if (backtests.length === 0) {
            <p class="empty-state">Brak backtestów. Uruchom pierwszy test!</p>
            } @else { @for (backtest of backtests.slice(0, 5); track
            backtest.id) {
            <div class="list-item">
              <div class="list-item-info">
                <div class="list-item-name">{{ backtest.strategyId }}</div>
                <div class="list-item-meta">
                  {{ backtest.trades?.length || 0 }} transakcji
                </div>
              </div>
              <span
                class="status-badge"
                [class.completed]="backtest.status === 'completed'"
                [class.failed]="backtest.status === 'failed'"
                [class.running]="backtest.status === 'running'"
              >
                {{ backtest.status }}
              </span>
            </div>
            } }
          </div>
        </section>
      </div>

      <section class="quick-actions">
        <h2>Szybkie akcje</h2>
        <div class="actions-grid">
          <a routerLink="/strategies" class="action-card">
            <span class="action-icon">➕</span>
            <span class="action-label">Nowa strategia</span>
          </a>
          <a routerLink="/backtests" class="action-card">
            <span class="action-icon">🚀</span>
            <span class="action-label">Uruchom backtest</span>
          </a>
        </div>
      </section>
    </div>
  `,
  styles: [
    `
      .dashboard {
        max-width: 1400px;
      }

      .page-header {
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

      .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 16px;
        margin-bottom: 32px;
      }

      .stat-card {
        background: #1a1a1a;
        border: 1px solid #2a2a2a;
        border-radius: 12px;
        padding: 20px;
        display: flex;
        align-items: center;
        gap: 16px;
      }

      .stat-card.success {
        border-color: #22c55e33;
      }

      .stat-icon {
        font-size: 32px;
      }

      .stat-value {
        font-size: 28px;
        font-weight: 700;
        color: #fff;
      }

      .stat-label {
        color: #888;
        font-size: 14px;
      }

      .content-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
        gap: 24px;
        margin-bottom: 32px;
      }

      .card {
        background: #1a1a1a;
        border: 1px solid #2a2a2a;
        border-radius: 12px;
        overflow: hidden;
      }

      .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 1px solid #2a2a2a;
      }

      .card-header h2 {
        font-size: 16px;
        font-weight: 600;
        color: #fff;
        margin: 0;
      }

      .view-all {
        color: #2563eb;
        text-decoration: none;
        font-size: 14px;
      }

      .view-all:hover {
        text-decoration: underline;
      }

      .card-content {
        padding: 8px 0;
      }

      .list-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 20px;
        border-bottom: 1px solid #222;
      }

      .list-item:last-child {
        border-bottom: none;
      }

      .list-item-name {
        color: #fff;
        font-weight: 500;
      }

      .list-item-meta {
        color: #666;
        font-size: 13px;
        margin-top: 2px;
      }

      .status-badge {
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 500;
        background: #333;
        color: #888;
      }

      .status-badge.testing {
        background: #2563eb22;
        color: #2563eb;
      }

      .status-badge.live {
        background: #22c55e22;
        color: #22c55e;
      }

      .status-badge.completed {
        background: #22c55e22;
        color: #22c55e;
      }

      .status-badge.failed {
        background: #ef444422;
        color: #ef4444;
      }

      .status-badge.running {
        background: #f5920022;
        color: #f59200;
      }

      .empty-state {
        color: #666;
        text-align: center;
        padding: 32px;
      }

      .quick-actions h2 {
        font-size: 18px;
        font-weight: 600;
        color: #fff;
        margin: 0 0 16px 0;
      }

      .actions-grid {
        display: flex;
        gap: 16px;
      }

      .action-card {
        background: #1a1a1a;
        border: 1px solid #2a2a2a;
        border-radius: 12px;
        padding: 24px 32px;
        display: flex;
        align-items: center;
        gap: 12px;
        text-decoration: none;
        transition: all 0.2s;
      }

      .action-card:hover {
        border-color: #2563eb;
        background: #1f1f1f;
      }

      .action-icon {
        font-size: 24px;
      }

      .action-label {
        color: #fff;
        font-weight: 500;
      }
    `,
  ],
})
export class DashboardComponent implements OnInit {
  private apiService = inject(ApiService);

  strategies: any[] = [];
  backtests: any[] = [];

  get completedBacktests(): number {
    return this.backtests.filter((b) => b.status === 'completed').length;
  }

  ngOnInit() {
    this.loadData();
  }

  async loadData() {
    try {
      this.strategies = await this.apiService.getStrategies();
      this.backtests = await this.apiService.getBacktests();
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  }
}
