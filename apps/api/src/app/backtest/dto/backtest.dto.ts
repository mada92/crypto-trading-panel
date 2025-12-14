export class RunBacktestDto {
  strategyId: string;
  startDate: string;
  endDate: string;
  symbol?: string;
  timeframe?: '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w';
  initialCapital?: number;
  currency?: string;
  commissionPercent?: number;
  slippagePercent?: number;
  fillModel?: 'optimistic' | 'pessimistic' | 'realistic';
}
