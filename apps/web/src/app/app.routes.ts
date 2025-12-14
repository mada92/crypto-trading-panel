import { Routes } from '@angular/router';

export const appRoutes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./pages/dashboard/dashboard.component').then(
        (m) => m.DashboardComponent
      ),
  },
  {
    path: 'strategies',
    loadComponent: () =>
      import('./pages/strategies/strategies.component').then(
        (m) => m.StrategiesComponent
      ),
  },
  {
    path: 'strategies/:id',
    loadComponent: () =>
      import('./pages/strategy-detail/strategy-detail.component').then(
        (m) => m.StrategyDetailComponent
      ),
  },
  {
    path: 'backtests',
    loadComponent: () =>
      import('./pages/backtests/backtests.component').then(
        (m) => m.BacktestsComponent
      ),
  },
  {
    path: 'backtests/:id',
    loadComponent: () =>
      import('./pages/backtest-result/backtest-result.component').then(
        (m) => m.BacktestResultComponent
      ),
  },
  {
    path: 'data-download',
    loadComponent: () =>
      import('./pages/data-download/data-download.component').then(
        (m) => m.DataDownloadComponent
      ),
  },
];
