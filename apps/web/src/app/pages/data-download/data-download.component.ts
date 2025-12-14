import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

interface DownloadProgress {
  type: 'progress' | 'complete' | 'error';
  loaded?: number;
  total?: number;
  percent?: number;
  message?: string;
  candlesCount?: number;
  cached?: number;
  downloaded?: number;
}

@Component({
  selector: 'app-data-download',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="data-download-page">
      <header class="page-header">
        <h1>📥 Pobieranie danych rynkowych</h1>
        <p>Pobierz świeczki 1-minutowe z Bybit i zapisz w cache MongoDB</p>
      </header>

      <div class="download-card">
        <h2>Konfiguracja pobierania</h2>
        
        <form (ngSubmit)="startDownload()" class="download-form">
          <div class="form-group">
            <label for="symbol">Symbol</label>
            <select id="symbol" [(ngModel)]="symbol" name="symbol" [disabled]="isDownloading()">
              @for (s of symbols(); track s) {
                <option [value]="s">{{ s }}</option>
              }
            </select>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="startDate">Data początkowa</label>
              <input 
                type="date" 
                id="startDate" 
                [(ngModel)]="startDate" 
                name="startDate"
                [disabled]="isDownloading()"
              />
            </div>

            <div class="form-group">
              <label for="endDate">Data końcowa</label>
              <input 
                type="date" 
                id="endDate" 
                [(ngModel)]="endDate" 
                name="endDate"
                [disabled]="isDownloading()"
              />
            </div>
          </div>

          <div class="estimated-info">
            <span class="info-icon">ℹ️</span>
            <span>Szacowana liczba świec: <strong>{{ estimatedCandles() | number }}</strong></span>
            <span class="separator">|</span>
            <span>Czas: ~{{ estimatedTime() }}</span>
          </div>

          <button 
            type="submit" 
            class="download-btn" 
            [disabled]="isDownloading() || !canDownload()"
          >
            @if (isDownloading()) {
              <span class="spinner"></span> Pobieranie...
            } @else {
              📥 Rozpocznij pobieranie
            }
          </button>
        </form>
      </div>

      @if (isDownloading() || lastProgress()) {
        <div class="progress-card" [class.complete]="lastProgress()?.type === 'complete'" [class.error]="lastProgress()?.type === 'error'">
          <h2>
            @if (lastProgress()?.type === 'complete') {
              ✅ Pobieranie zakończone
            } @else if (lastProgress()?.type === 'error') {
              ❌ Błąd pobierania
            } @else {
              ⏳ Postęp pobierania
            }
          </h2>

          <div class="progress-container">
            <div class="progress-bar">
              <div 
                class="progress-fill" 
                [style.width.%]="lastProgress()?.percent || 0"
                [class.complete]="lastProgress()?.type === 'complete'"
                [class.error]="lastProgress()?.type === 'error'"
              ></div>
            </div>
            <span class="progress-percent">{{ lastProgress()?.percent || 0 }}%</span>
          </div>

          <div class="progress-details">
            <p class="progress-message">{{ lastProgress()?.message }}</p>
            
            @if (lastProgress()?.loaded && lastProgress()?.total) {
              <div class="stats-row">
                <div class="stat">
                  <span class="stat-label">Pobrane</span>
                  <span class="stat-value">{{ lastProgress()?.loaded | number }}</span>
                </div>
                <div class="stat">
                  <span class="stat-label">Łącznie</span>
                  <span class="stat-value">{{ lastProgress()?.total | number }}</span>
                </div>
                @if (lastProgress()?.type === 'complete') {
                  <div class="stat">
                    <span class="stat-label">Świece 1m</span>
                    <span class="stat-value highlight">{{ lastProgress()?.candlesCount | number }}</span>
                  </div>
                }
              </div>
            }
          </div>
        </div>
      }

      <div class="info-section">
        <h3>💡 Jak to działa?</h3>
        <ul>
          <li><strong>Cache MongoDB</strong> - Świeczki są zapisywane w bazie, więc kolejne pobieranie jest natychmiastowe</li>
          <li><strong>Tylko 1m</strong> - Pobieramy świeczki 1-minutowe, z których można agregować dowolny timeframe</li>
          <li><strong>Bybit API</strong> - Dane są pobierane z giełdy Bybit (do 1000 świec na request)</li>
          <li><strong>Inteligentne pobieranie</strong> - System pobiera tylko brakujące dane</li>
        </ul>
      </div>
    </div>
  `,
  styles: [`
    .data-download-page {
      padding: 2rem;
      max-width: 900px;
      margin: 0 auto;
    }

    .page-header {
      margin-bottom: 2rem;
      
      h1 {
        font-size: 2rem;
        color: #e2e8f0;
        margin-bottom: 0.5rem;
      }
      
      p {
        color: #94a3b8;
        font-size: 1.1rem;
      }
    }

    .download-card, .progress-card, .info-section {
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      
      h2 {
        color: #e2e8f0;
        font-size: 1.25rem;
        margin-bottom: 1.5rem;
        padding-bottom: 0.75rem;
        border-bottom: 1px solid #334155;
      }
    }

    .progress-card.complete {
      border-color: #22c55e;
      background: linear-gradient(135deg, #14532d 0%, #0f172a 100%);
    }

    .progress-card.error {
      border-color: #ef4444;
      background: linear-gradient(135deg, #7f1d1d 0%, #0f172a 100%);
    }

    .download-form {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      
      label {
        color: #94a3b8;
        font-size: 0.875rem;
        font-weight: 500;
      }
      
      select, input {
        padding: 0.75rem 1rem;
        background: #0f172a;
        border: 1px solid #334155;
        border-radius: 8px;
        color: #e2e8f0;
        font-size: 1rem;
        transition: border-color 0.2s;
        
        &:focus {
          outline: none;
          border-color: #3b82f6;
        }
        
        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      }
    }

    .estimated-info {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem;
      background: #0f172a;
      border-radius: 8px;
      color: #94a3b8;
      font-size: 0.9rem;
      
      .info-icon {
        font-size: 1.25rem;
      }
      
      strong {
        color: #3b82f6;
      }
      
      .separator {
        color: #475569;
      }
    }

    .download-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 1rem 2rem;
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
      border: none;
      border-radius: 8px;
      color: white;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      
      &:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
      }
      
      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
      }
    }

    .spinner {
      width: 18px;
      height: 18px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .progress-container {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .progress-bar {
      flex: 1;
      height: 24px;
      background: #0f172a;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #334155;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #3b82f6 0%, #8b5cf6 100%);
      border-radius: 12px;
      transition: width 0.3s ease-out;
      position: relative;
      
      &::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(
          90deg,
          transparent 0%,
          rgba(255, 255, 255, 0.2) 50%,
          transparent 100%
        );
        animation: shimmer 1.5s infinite;
      }
      
      &.complete {
        background: linear-gradient(90deg, #22c55e 0%, #16a34a 100%);
      }
      
      &.error {
        background: linear-gradient(90deg, #ef4444 0%, #dc2626 100%);
      }
    }

    @keyframes shimmer {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(100%); }
    }

    .progress-percent {
      min-width: 50px;
      font-size: 1.25rem;
      font-weight: 700;
      color: #3b82f6;
    }

    .progress-details {
      .progress-message {
        color: #e2e8f0;
        font-size: 1rem;
        margin-bottom: 1rem;
      }
    }

    .stats-row {
      display: flex;
      gap: 2rem;
      
      .stat {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        
        .stat-label {
          color: #64748b;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        
        .stat-value {
          color: #e2e8f0;
          font-size: 1.5rem;
          font-weight: 700;
          
          &.highlight {
            color: #22c55e;
          }
        }
      }
    }

    .info-section {
      h3 {
        color: #e2e8f0;
        font-size: 1.1rem;
        margin-bottom: 1rem;
      }
      
      ul {
        list-style: none;
        padding: 0;
        margin: 0;
        
        li {
          padding: 0.75rem 0;
          color: #94a3b8;
          border-bottom: 1px solid #1e293b;
          
          &:last-child {
            border-bottom: none;
          }
          
          strong {
            color: #e2e8f0;
          }
        }
      }
    }

    @media (max-width: 640px) {
      .form-row {
        grid-template-columns: 1fr;
      }
      
      .estimated-info {
        flex-wrap: wrap;
      }
      
      .stats-row {
        flex-wrap: wrap;
        gap: 1rem;
      }
    }
  `]
})
export class DataDownloadComponent {
  private api = inject(ApiService);

  symbols = signal<string[]>(['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT']);
  symbol = 'BTCUSDT';
  startDate = this.getDefaultStartDate();
  endDate = this.getDefaultEndDate();

  isDownloading = signal(false);
  lastProgress = signal<DownloadProgress | null>(null);

  private eventSource: EventSource | null = null;

  canDownload = computed(() => {
    return this.symbol && this.startDate && this.endDate && 
           new Date(this.startDate) < new Date(this.endDate);
  });

  estimatedCandles = computed(() => {
    if (!this.startDate || !this.endDate) return 0;
    const start = new Date(this.startDate);
    const end = new Date(this.endDate);
    const diffMs = end.getTime() - start.getTime();
    return Math.floor(diffMs / 60000); // 1 min = 60000ms
  });

  estimatedTime = computed(() => {
    const candles = this.estimatedCandles();
    if (candles === 0) return '0s';
    // ~1000 świec na request, ~1s na request
    const seconds = Math.ceil(candles / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.ceil(seconds / 60);
    return `${minutes} min`;
  });

  private getDefaultStartDate(): string {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().split('T')[0];
  }

  private getDefaultEndDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  async ngOnInit() {
    try {
      const symbols = await this.api.getSymbols();
      if (symbols.length > 0) {
        this.symbols.set(symbols);
      }
    } catch (e) {
      console.error('Failed to load symbols', e);
    }

    // Sprawdź czy jest aktywne pobieranie dla tego symbolu
    await this.checkActiveDownload();
  }

  /**
   * Sprawdź czy jest aktywne pobieranie i wznów progressbar
   */
  private async checkActiveDownload() {
    try {
      const status = await this.api.getDownloadStatus(this.symbol);
      
      if (status && status.status === 'running') {
        // Jest aktywne pobieranie - wznów wyświetlanie progressu
        this.isDownloading.set(true);
        this.lastProgress.set({
          type: 'progress',
          loaded: status.loaded,
          total: status.total,
          percent: status.progress,
          message: status.message,
        });

        // Polling co 500ms żeby aktualizować progress
        this.startPolling();
      }
    } catch (e) {
      console.error('Failed to check download status', e);
    }
  }

  private pollingInterval: ReturnType<typeof setInterval> | null = null;

  private startPolling() {
    // Zatrzymaj poprzedni polling
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    this.pollingInterval = setInterval(async () => {
      try {
        const status = await this.api.getDownloadStatus(this.symbol);
        
        if (!status || status.status === 'none') {
          this.stopPolling();
          return;
        }

        this.lastProgress.set({
          type: status.status === 'completed' ? 'complete' : 
                status.status === 'failed' ? 'error' : 'progress',
          loaded: status.loaded,
          total: status.total,
          percent: status.progress,
          message: status.message,
          candlesCount: status.loaded,
        });

        if (status.status === 'completed' || status.status === 'failed') {
          this.isDownloading.set(false);
          this.stopPolling();
        }
      } catch (e) {
        console.error('Polling error', e);
        this.stopPolling();
      }
    }, 500);
  }

  private stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  startDownload() {
    if (this.isDownloading() || !this.canDownload()) return;

    this.isDownloading.set(true);
    this.lastProgress.set(null);

    // Zamknij poprzednie połączenie SSE
    if (this.eventSource) {
      this.eventSource.close();
    }

    const url = `/api/market-data/download-candles?symbol=${this.symbol}&startDate=${this.startDate}&endDate=${this.endDate}`;
    
    this.eventSource = new EventSource(url);

    this.eventSource.onmessage = (event) => {
      try {
        const data: DownloadProgress = JSON.parse(event.data);
        this.lastProgress.set(data);

        if (data.type === 'complete' || data.type === 'error') {
          this.isDownloading.set(false);
          this.eventSource?.close();
          this.eventSource = null;
        }
      } catch (e) {
        console.error('Failed to parse SSE data', e);
      }
    };

    this.eventSource.onerror = () => {
      this.lastProgress.set({
        type: 'error',
        message: 'Utracono połączenie z serwerem',
      });
      this.isDownloading.set(false);
      this.eventSource?.close();
      this.eventSource = null;
    };
  }

  ngOnDestroy() {
    if (this.eventSource) {
      this.eventSource.close();
    }
    this.stopPolling();
  }
}

