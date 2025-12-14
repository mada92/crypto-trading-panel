export class DownloadCandlesDto {
  symbol: string;
  startDate: string;
  endDate: string;
}

export interface DownloadProgress {
  type: 'progress' | 'complete' | 'error';
  loaded?: number;
  total?: number;
  percent?: number;
  message?: string;
  candlesCount?: number;
  cached?: number;
  downloaded?: number;
}

