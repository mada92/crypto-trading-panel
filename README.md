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
- **Docker** & **Docker Compose** (opcjonalnie, zalecane)
- **Git**

## 🔧 Instalacja

```bash
# Klonowanie repozytorium
git clone https://github.com/mada92/crypto-trading-panel.git
cd crypto-trading-panel

# Instalacja zależności
npm install
```

## 🚀 Uruchomienie

### 🐳 Docker - Development (zalecane)

Tryb deweloperski z hot reload - bazy danych w kontenerach, aplikacje lokalnie:

```bash
# 1. Uruchom infrastrukturę (MongoDB, Redis, Mongo Express)
npm run dev:infra

# 2. W osobnym terminalu - Backend API (z hot reload)
npm run dev:api

# 3. W osobnym terminalu - Frontend Web (z hot reload)
npm run dev:web
```

| Usługa | URL | Opis |
|--------|-----|------|
| API | http://localhost:3000/api | Backend NestJS |
| Web | http://localhost:4200 | Frontend Angular |
| Mongo Express | http://localhost:8081 | Przeglądarka MongoDB |
| MongoDB | localhost:27017 | Baza danych |
| Redis | localhost:6379 | Cache |

**Mongo Express login:** `admin` / `admin123`

### 🐳 Docker - Production

Wszystko w kontenerach - do wdrożenia produkcyjnego:

```bash
# Zbuduj i uruchom wszystkie kontenery
npm run docker:build
npm run docker:up

# Lub jedną komendą
docker-compose up -d --build
```

### 💻 Bez Dockera (tylko Node.js)

```bash
# Terminal 1 - Backend API
npm run dev:api

# Terminal 2 - Frontend Web
npm run dev:web
```

> ⚠️ Wymaga ręcznej instalacji MongoDB i Redis lokalnie.

### CLI do backtestingu

```bash
# Uruchomienie
npm run backtest

# Lub z parametrami
npx nx serve backtest-cli -- --symbol BTCUSDT --timeframe 4h --start 2024-01-01 --end 2024-12-01
```

## 📜 Dostępne skrypty npm

| Skrypt | Opis |
|--------|------|
| `npm run dev:infra` | Uruchom MongoDB, Redis, Mongo Express (Docker) |
| `npm run dev:infra:down` | Zatrzymaj infrastrukturę |
| `npm run dev:api` | Uruchom API z hot reload |
| `npm run dev:web` | Uruchom Web z hot reload |
| `npm run docker:up` | Uruchom pełny stack produkcyjny |
| `npm run docker:down` | Zatrzymaj kontenery |
| `npm run docker:build` | Zbuduj obrazy Docker |
| `npm run docker:logs` | Pokaż logi kontenerów |
| `npm run backtest` | Uruchom CLI backtestów |
| `npm run build` | Zbuduj wszystkie projekty |
| `npm run lint` | Sprawdź kod |
| `npm run test` | Uruchom testy |

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

## 🐳 Struktura Docker

```
docker-compose.yml       # Produkcja - wszystko w kontenerach
docker-compose.dev.yml   # Development - tylko bazy danych
├── Dockerfile.api       # Multi-stage build dla NestJS
├── Dockerfile.web       # Multi-stage build dla Angular + nginx
├── Dockerfile.cli       # Build dla CLI backtestów
└── docker/
    ├── nginx.conf       # Konfiguracja nginx z proxy do API
    └── mongo-init.js    # Inicjalizacja MongoDB
```

### Kontenery produkcyjne

| Kontener | Obraz | Port | Opis |
|----------|-------|------|------|
| `trading-web` | Angular + nginx | 4200 | Frontend z proxy do API |
| `trading-api` | Node.js | 3000 | Backend NestJS |
| `trading-mongodb` | mongo:7.0 | 27017 | Baza danych |
| `trading-redis` | redis:7-alpine | 6379 | Cache |
| `trading-mongo-express` | mongo-express:1.0 | 8081 | GUI dla MongoDB |

## ⚙️ Konfiguracja

### Zmienne środowiskowe

Utwórz plik `.env` w głównym katalogu (lub użyj wartości domyślnych):

```env
# MongoDB
MONGO_PORT=27017
MONGO_USER=trading
MONGO_PASSWORD=trading123
MONGO_DB=trading

# Redis
REDIS_PORT=6379

# API
API_PORT=3000

# Web
WEB_PORT=4200

# Mongo Express
MONGO_EXPRESS_PORT=8081
MONGO_EXPRESS_USER=admin
MONGO_EXPRESS_PASSWORD=admin123

# Bybit API (opcjonalne - dla prawdziwych danych rynkowych)
BYBIT_API_KEY=your_api_key
BYBIT_API_SECRET=your_api_secret
BYBIT_TESTNET=true
```

### Konfiguracja Bybit

Bez kluczy API system automatycznie używa danych syntetycznych do backtestingu. Dane syntetyczne są generowane z realistyczną zmiennością dla każdego symbolu.

Z kluczami API system pobiera prawdziwe dane historyczne z Bybit i cachuje je w MongoDB.

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

## 🔥 Zaawansowane funkcje

### Multi-Timeframe Analysis (MTF)

Strategie mogą używać danych z wielu timeframe'ów jednocześnie:

```typescript
dataRequirements: {
  primaryTimeframe: '4h',
  additionalTimeframes: ['1d'],  // Dzienny trend
  lookbackPeriods: 200,
}
```

### Agregacja świec 1m → dowolny timeframe

CLI może pobierać dane 1-minutowe i agregować je do wyższych timeframe'ów z dodatkowymi metrykami dynamiki rynku:

```bash
node dist/apps/backtest-cli/main.js --use-1m-data
```

Metryki dynamiki:
- **Price Velocity** - prędkość zmiany ceny
- **Volume Spikes** - nagłe wzrosty wolumenu  
- **Body-to-Wick Ratio** - stosunek korpusu do cienia
- **Intrabar Volatility** - zmienność wewnątrz świecy

### MongoDB Cache

Dane historyczne są automatycznie cachowane w MongoDB, co przyspiesza kolejne backtesty:

```bash
# Pierwsze uruchomienie - pobiera z Bybit (~5 min dla 1m data)
npm run backtest

# Kolejne uruchomienia - używa cache (<1 sek)
npm run backtest
```

## 📝 Licencja

MIT

## 🤝 Kontakt

Projekt rozwijany jako narzędzie do backtestingu strategii tradingowych.

---

**Made with ❤️ using Nx, NestJS, Angular & TypeScript**
