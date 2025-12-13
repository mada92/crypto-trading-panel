# 🚀 Crypto Trading Panel

System do backtestingu i automatycznego tradingu kryptowalut zbudowany w architekturze monorepo z wykorzystaniem **Nx**, **NestJS**, **Angular** oraz **TypeScript**.

## 📋 Spis treści

- [Funkcjonalności](#-funkcjonalności)
- [Architektura](#-architektura)
- [Wymagania](#-wymagania)
- [Instalacja](#-instalacja)
- [Uruchomienie](#-uruchomienie)
- [Struktura projektu](#-struktura-projektu)
- [API Endpoints](#-api-endpoints)
- [Strategie](#-strategie)
- [Wskaźniki techniczne](#-wskaźniki-techniczne)
- [Konfiguracja](#-konfiguracja)
- [Testy](#-testy)
- [Rozwój](#-rozwój)

## ✨ Funkcjonalności

### Backtesting
- 📊 Symulacja strategii na danych historycznych
- 📈 Obliczanie metryk wydajności (Sharpe Ratio, Max Drawdown, Win Rate, Profit Factor)
- 🔄 Wsparcie dla wielu timeframe'ów (1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w)
- 💹 Realistyczna symulacja z prowizjami i slippage

### Wskaźniki techniczne
- SMA, EMA, SMMA (średnie kroczące)
- RSI (Relative Strength Index)
- MACD (Moving Average Convergence Divergence)
- Bollinger Bands
- ATR (Average True Range)
- ADX (Average Directional Index)
- Stochastic Oscillator
- Pivot Points (Traditional, Fibonacci, Camarilla)
- OBV (On-Balance Volume)
- Volume SMA

### Integracja giełd
- 🔗 Bybit API (dane historyczne, tickery, pozycje)
- 📉 Automatyczne pobieranie danych OHLCV
- 🔐 Obsługa testnet i mainnet

## 🏗 Architektura

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
│                    (Angular - apps/web)                      │
├─────────────────────────────────────────────────────────────┤
│                         REST API                             │
│                    (NestJS - apps/api)                       │
├─────────────────────────────────────────────────────────────┤
│                      Core Library                            │
│              (@trading/core - libs/trading/core)             │
│  ┌─────────────┬─────────────┬─────────────┬──────────────┐ │
│  │  Indicators │   Engine    │  Exchange   │    Types     │ │
│  │   (12+)     │  Backtest   │   Bybit     │   Strategy   │ │
│  └─────────────┴─────────────┴─────────────┴──────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 📦 Wymagania

- **Node.js** >= 20.19.0 (zalecane 22.x)
- **npm** >= 8.0.0
- **Git**

## 🔧 Instalacja

```bash
# Klonowanie repozytorium
git clone <repo-url>
cd crypto-trading-panel

# Instalacja zależności
npm install
```

## 🚀 Uruchomienie

### Wszystkie aplikacje (zalecane)

```bash
# Terminal 1 - Backend API
npx nx run api:serve

# Terminal 2 - Frontend Web
npx nx run web:serve
```

### Backend API

```bash
# Budowanie
npx nx run api:build

# Uruchomienie (development)
npx nx run api:serve

# Lub bezpośrednio
node dist/apps/api/main.js
```

API dostępne pod: **http://localhost:3000/api**

### Frontend Web

```bash
# Development server
npx nx run web:serve
```

Frontend dostępny pod: **http://localhost:4200**

### CLI do backtestingu

```bash
# Budowanie
npx nx run backtest-cli:build

# Uruchomienie
node dist/apps/backtest-cli/main.js

# Z parametrami
node dist/apps/backtest-cli/main.js --symbol BTCUSDT --timeframe 4h --start 2024-01-01 --end 2024-12-01
```

### Budowanie wszystkich projektów

```bash
# Buduj wszystko
npx nx run-many -t build

# Buduj tylko core library
npx nx run core:build
```

## 📁 Struktura projektu

```
crypto-trading-panel/
├── apps/
│   ├── api/                    # Backend NestJS
│   │   └── src/
│   │       ├── app/
│   │       │   ├── backtest/   # Moduł backtestingu
│   │       │   ├── strategies/ # Zarządzanie strategiami
│   │       │   └── market-data/# Dane rynkowe
│   │       └── main.ts
│   ├── web/                    # Frontend Angular
│   │   └── src/
│   │       ├── app/
│   │       │   ├── pages/      # Strony aplikacji
│   │       │   ├── components/ # Komponenty UI
│   │       │   └── services/   # Serwisy API
│   │       └── main.ts
│   └── backtest-cli/           # CLI do backtestów
│       └── src/main.ts
├── libs/
│   ├── trading/
│   │   └── core/               # Główna biblioteka tradingowa
│   │       └── src/lib/
│   │           ├── engine/     # Silnik backtestingu
│   │           ├── indicators/ # Wskaźniki techniczne
│   │           ├── exchange/   # Integracja giełd
│   │           └── types/      # Typy TypeScript
│   └── shared/                 # Współdzielone utilities
├── nx.json                     # Konfiguracja Nx
├── package.json
└── tsconfig.base.json
```

## 🔌 API Endpoints

### Health Check
```
GET /api/health
```

### Strategie
```
GET    /api/strategies          # Lista strategii
GET    /api/strategies/:id      # Szczegóły strategii
POST   /api/strategies          # Utwórz strategię
PUT    /api/strategies/:id      # Aktualizuj strategię
DELETE /api/strategies/:id      # Usuń strategię
POST   /api/strategies/:id/clone # Klonuj strategię
```

### Backtesty
```
GET    /api/backtests           # Lista backtestów
GET    /api/backtests/:id       # Wynik backtestu
POST   /api/backtests           # Uruchom backtest
DELETE /api/backtests/:id       # Usuń backtest
GET    /api/backtests/:id/trades   # Lista transakcji
GET    /api/backtests/:id/equity   # Equity curve
GET    /api/backtests/:id/metrics  # Metryki
```

### Dane rynkowe
```
GET /api/market-data/klines     # Świece OHLCV
GET /api/market-data/symbols    # Dostępne symbole
GET /api/market-data/timeframes # Dostępne timeframe'y
```

### Przykład uruchomienia backtestu

```bash
curl -X POST http://localhost:3000/api/backtests \
  -H "Content-Type: application/json" \
  -d '{
    "strategyId": "sma-crossover-rsi",
    "startDate": "2024-01-01",
    "endDate": "2024-12-01",
    "initialCapital": 10000,
    "symbol": "BTCUSDT"
  }'
```

## 📊 Strategie

### Wbudowane strategie

#### SMA Crossover + RSI
- **ID:** `sma-crossover-rsi`
- **Opis:** Prosta strategia oparta na przecięciu SMA20/SMA50 z filtrem RSI
- **Sygnał LONG:** SMA20 > SMA50 AND RSI między 30-70
- **Sygnał SHORT:** SMA20 < SMA50 AND RSI między 30-70

#### Pivot SMMA v3
- **ID:** `pivot-smma-v3`
- **Opis:** Strategia oparta na odbiciach od Pivot Points z filtrem trendu SMMA
- **Sygnał LONG:** SMMA33 > SMMA144 AND cena blisko Pivot S1
- **Sygnał SHORT:** SMMA33 < SMMA144 AND cena blisko Pivot R1

### Tworzenie własnej strategii

```typescript
const myStrategy: StrategySchema = {
  id: 'my-strategy',
  version: '1.0.0',
  name: 'My Custom Strategy',
  dataRequirements: {
    primaryTimeframe: '4h',
    lookbackPeriods: 100,
    symbols: ['BTCUSDT'],
  },
  indicators: [
    { id: 'sma20', type: 'SMA', params: { period: 20, source: 'close' } },
    { id: 'rsi', type: 'RSI', params: { period: 14, source: 'close' } },
  ],
  entrySignals: {
    long: {
      conditions: {
        operator: 'AND',
        conditions: [
          { type: 'greater_than', left: 'close', right: 'sma20' },
          { type: 'less_than', left: 'rsi', right: 70 },
        ],
      },
    },
  },
  exitSignals: {
    stopLoss: { type: 'atr_multiple', value: 2.0, atrPeriod: 14 },
    takeProfit: { type: 'risk_reward', value: 2.0 },
  },
  riskManagement: {
    riskPerTrade: 2,
    maxPositionSize: 10,
    maxOpenPositions: 1,
  },
};
```

## 📈 Wskaźniki techniczne

| Wskaźnik | Typ | Parametry |
|----------|-----|-----------|
| SMA | Trend | period, source |
| EMA | Trend | period, source |
| SMMA | Trend | period, source |
| RSI | Momentum | period, source |
| MACD | Momentum | fastPeriod, slowPeriod, signalPeriod |
| Bollinger Bands | Volatility | period, stdDev |
| ATR | Volatility | period |
| ADX | Trend Strength | period |
| Stochastic | Momentum | kPeriod, dPeriod, smooth |
| Pivot Points | Support/Resistance | method |
| OBV | Volume | signalPeriod |
| Volume SMA | Volume | period |

## ⚙️ Konfiguracja

### Zmienne środowiskowe

Utwórz plik `.env.local` w głównym katalogu:

```env
# Bybit API (opcjonalne - dla prawdziwych danych)
BYBIT_API_KEY=your_api_key
BYBIT_API_SECRET=your_api_secret
BYBIT_TESTNET=true

# Serwer
PORT=3000
```

### Konfiguracja Bybit

Bez kluczy API system automatycznie używa danych syntetycznych do backtestingu. Dane syntetyczne są generowane z realistyczną zmiennością dla każdego symbolu.

## 🧪 Testy

```bash
# Wszystkie testy
npx nx run-many -t test

# Testy core library
npx nx run core:test

# Testy API
npx nx run api:test

# Testy z pokryciem
npx nx run core:test --coverage
```

## 🛠 Rozwój

### Dodawanie nowego wskaźnika

1. Utwórz plik w `libs/trading/core/src/lib/indicators/`
2. Zaimplementuj interfejs `IIndicator`
3. Zarejestruj w `registry.ts`
4. Wyeksportuj w `index.ts`

```typescript
// my-indicator.ts
export class MyIndicator implements IIndicator {
  readonly name = 'MY_INDICATOR';
  
  calculate(data: OHLCV[], params: Record<string, number | string>): IndicatorResult[] {
    // implementacja
  }
  
  getRequiredPeriods(params: Record<string, number | string>): number {
    return Number(params['period']) || 14;
  }
  
  validate(params: Record<string, number | string>): ValidationResult {
    // walidacja parametrów
  }
}
```

### Polecenia Nx

```bash
# Wizualizacja zależności
npx nx graph

# Lint
npx nx run-many -t lint

# Format
npx nx format:write

# Aktualizacja Nx
npx nx migrate latest
```

## 📝 Licencja

MIT

## 🤝 Kontakt

Projekt rozwijany jako narzędzie do backtestingu strategii tradingowych.
