export class RunBacktestDto {
  strategyId: string;
  startDate: string;
  endDate: string;
  symbol?: string;
  initialCapital?: number;
  currency?: string;
  commissionPercent?: number;
  slippagePercent?: number;
  fillModel?: 'optimistic' | 'pessimistic' | 'realistic';
}
