import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private http = inject(HttpClient);
  private baseUrl = 'http://localhost:3000/api';

  // Strategies
  async getStrategies(): Promise<any[]> {
    return firstValueFrom(this.http.get<any[]>(`${this.baseUrl}/strategies`));
  }

  async getStrategy(id: string): Promise<any> {
    return firstValueFrom(this.http.get<any>(`${this.baseUrl}/strategies/${id}`));
  }

  async createStrategy(schema: any): Promise<any> {
    return firstValueFrom(
      this.http.post<any>(`${this.baseUrl}/strategies`, { schema })
    );
  }

  async updateStrategy(id: string, schema: any): Promise<any> {
    return firstValueFrom(
      this.http.put<any>(`${this.baseUrl}/strategies/${id}`, { schema })
    );
  }

  async deleteStrategy(id: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${this.baseUrl}/strategies/${id}`)
    );
  }

  // Backtests
  async getBacktests(strategyId?: string): Promise<any[]> {
    const params = strategyId ? `?strategyId=${strategyId}` : '';
    return firstValueFrom(
      this.http.get<any[]>(`${this.baseUrl}/backtests${params}`)
    );
  }

  async getBacktest(id: string): Promise<any> {
    return firstValueFrom(this.http.get<any>(`${this.baseUrl}/backtests/${id}`));
  }

  async runBacktest(config: {
    strategyId: string;
    startDate: string;
    endDate: string;
    symbol?: string;
    initialCapital?: number;
  }): Promise<{ backtestId: string; status: string }> {
    return firstValueFrom(
      this.http.post<{ backtestId: string; status: string }>(
        `${this.baseUrl}/backtests`,
        config
      )
    );
  }

  async getBacktestTrades(
    id: string,
    page = 1,
    limit = 50
  ): Promise<{
    trades: any[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    return firstValueFrom(
      this.http.get<any>(
        `${this.baseUrl}/backtests/${id}/trades?page=${page}&limit=${limit}`
      )
    );
  }

  async getBacktestEquity(id: string): Promise<any[]> {
    return firstValueFrom(
      this.http.get<any[]>(`${this.baseUrl}/backtests/${id}/equity`)
    );
  }

  async getBacktestMetrics(id: string): Promise<any> {
    return firstValueFrom(
      this.http.get<any>(`${this.baseUrl}/backtests/${id}/metrics`)
    );
  }

  // Market Data
  async getSymbols(): Promise<string[]> {
    return firstValueFrom(
      this.http.get<string[]>(`${this.baseUrl}/market-data/symbols`)
    );
  }

  async getTimeframes(): Promise<string[]> {
    return firstValueFrom(
      this.http.get<string[]>(`${this.baseUrl}/market-data/timeframes`)
    );
  }
}
