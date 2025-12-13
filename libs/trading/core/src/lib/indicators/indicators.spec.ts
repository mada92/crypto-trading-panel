import { OHLCV } from '../types/ohlcv';
import { IndicatorRegistry } from './registry';
import { calculateSMA } from './sma';
import { calculateEMA } from './ema';
import { calculateRSI } from './rsi';
import { calculateATR } from './atr';
import { calculateStochastic } from './stochastic';
import { calculateVolumeSMA } from './volume-sma';
import { calculateOBV } from './obv';

// Pomocnicza funkcja do generowania testowych danych OHLCV
function generateTestData(count: number, startPrice = 100): OHLCV[] {
  const data: OHLCV[] = [];
  let price = startPrice;
  const baseTimestamp = Date.now();

  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.5) * 10;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * 5;
    const low = Math.min(open, close) - Math.random() * 5;
    const volume = 1000000 + Math.random() * 500000;

    data.push({
      timestamp: baseTimestamp + i * 3600000, // 1h candles
      open,
      high,
      low,
      close,
      volume: Math.round(volume),
    });

    price = close;
  }

  return data;
}

// Dane testowe z przewidywalnymi wartościami
function createPredictableData(): OHLCV[] {
  const baseTimestamp = Date.now();
  return [
    { timestamp: baseTimestamp, open: 100, high: 105, low: 95, close: 102, volume: 1000 },
    { timestamp: baseTimestamp + 3600000, open: 102, high: 108, low: 100, close: 106, volume: 1200 },
    { timestamp: baseTimestamp + 7200000, open: 106, high: 110, low: 104, close: 108, volume: 1100 },
    { timestamp: baseTimestamp + 10800000, open: 108, high: 112, low: 106, close: 104, volume: 1300 },
    { timestamp: baseTimestamp + 14400000, open: 104, high: 106, low: 100, close: 102, volume: 900 },
    { timestamp: baseTimestamp + 18000000, open: 102, high: 105, low: 98, close: 100, volume: 1000 },
    { timestamp: baseTimestamp + 21600000, open: 100, high: 104, low: 96, close: 103, volume: 1150 },
    { timestamp: baseTimestamp + 25200000, open: 103, high: 108, low: 102, close: 107, volume: 1250 },
    { timestamp: baseTimestamp + 28800000, open: 107, high: 112, low: 105, close: 110, volume: 1400 },
    { timestamp: baseTimestamp + 32400000, open: 110, high: 115, low: 108, close: 112, volume: 1500 },
  ];
}

describe('IndicatorRegistry', () => {
  let registry: IndicatorRegistry;

  beforeEach(() => {
    registry = IndicatorRegistry.getInstance();
  });

  it('should be a singleton', () => {
    const instance1 = IndicatorRegistry.getInstance();
    const instance2 = IndicatorRegistry.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('should have all built-in indicators registered', () => {
    const names = registry.getNames();
    expect(names).toContain('SMA');
    expect(names).toContain('EMA');
    expect(names).toContain('SMMA');
    expect(names).toContain('RSI');
    expect(names).toContain('ATR');
    expect(names).toContain('MACD');
    expect(names).toContain('BOLLINGER');
    expect(names).toContain('PIVOT');
    expect(names).toContain('ADX');
    expect(names).toContain('STOCHASTIC');
    expect(names).toContain('VOLUME_SMA');
    expect(names).toContain('OBV');
  });

  it('should get indicator by name (case insensitive)', () => {
    expect(registry.get('SMA')).toBeDefined();
    expect(registry.get('sma')).toBeDefined();
    expect(registry.get('Sma')).toBeDefined();
  });
});

describe('SMA Indicator', () => {
  it('should calculate SMA correctly', () => {
    const values = [10, 20, 30, 40, 50];
    const result = calculateSMA(values, 3);

    expect(result[0]).toBeNull();
    expect(result[1]).toBeNull();
    expect(result[2]).toBeCloseTo(20, 5); // (10+20+30)/3
    expect(result[3]).toBeCloseTo(30, 5); // (20+30+40)/3
    expect(result[4]).toBeCloseTo(40, 5); // (30+40+50)/3
  });

  it('should return nulls for insufficient data', () => {
    const values = [10, 20];
    const result = calculateSMA(values, 5);
    expect(result.every((v) => v === null)).toBe(true);
  });
});

describe('EMA Indicator', () => {
  it('should calculate EMA correctly', () => {
    const values = [10, 20, 30, 40, 50];
    const result = calculateEMA(values, 3);

    // EMA pierwsza wartość = SMA
    expect(result[0]).toBeNull();
    expect(result[1]).toBeNull();
    expect(result[2]).toBeCloseTo(20, 5); // SMA(10,20,30)
    // EMA następne = (price * multiplier) + (prevEMA * (1 - multiplier))
    // multiplier = 2 / (3 + 1) = 0.5
    expect(result[3]).toBeCloseTo(30, 5); // (40 * 0.5) + (20 * 0.5) = 30
    expect(result[4]).toBeCloseTo(40, 5); // (50 * 0.5) + (30 * 0.5) = 40
  });
});

describe('RSI Indicator', () => {
  it('should calculate RSI in range 0-100', () => {
    const data = generateTestData(50);
    const values = data.map((d) => d.close);
    const result = calculateRSI(values, 14);

    const validValues = result.filter((v) => v !== null) as number[];
    expect(validValues.length).toBeGreaterThan(0);
    validValues.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    });
  });

  it('should return nulls for first period+1 values', () => {
    const values = Array(20).fill(100);
    const result = calculateRSI(values, 14);

    for (let i = 0; i < 14; i++) {
      expect(result[i]).toBeNull();
    }
  });
});

describe('ATR Indicator', () => {
  it('should calculate ATR correctly', () => {
    const data = createPredictableData();
    const result = calculateATR(data, 5);

    // Pierwsze wartości powinny być null
    for (let i = 0; i < 4; i++) {
      expect(result[i]).toBeNull();
    }

    // Wartości ATR powinny być dodatnie
    const validValues = result.filter((v) => v !== null) as number[];
    validValues.forEach((v) => {
      expect(v).toBeGreaterThan(0);
    });
  });
});

describe('Stochastic Indicator', () => {
  it('should calculate Stochastic in range 0-100', () => {
    const data = generateTestData(50);
    const result = calculateStochastic(data, 14, 3, 3);

    result.forEach((r) => {
      if (r['k'] !== null) {
        expect(r['k']).toBeGreaterThanOrEqual(0);
        expect(r['k']).toBeLessThanOrEqual(100);
      }
      if (r['d'] !== null) {
        expect(r['d']).toBeGreaterThanOrEqual(0);
        expect(r['d']).toBeLessThanOrEqual(100);
      }
    });
  });

  it('should have k and d properties', () => {
    const data = generateTestData(30);
    const result = calculateStochastic(data, 14, 3, 3);

    const lastResult = result[result.length - 1];
    expect(lastResult).toHaveProperty('k');
    expect(lastResult).toHaveProperty('d');
  });
});

describe('Volume SMA Indicator', () => {
  it('should calculate Volume SMA correctly', () => {
    const data = createPredictableData();
    const result = calculateVolumeSMA(data, 3);

    expect(result[0]).toBeNull();
    expect(result[1]).toBeNull();
    // (1000 + 1200 + 1100) / 3 = 1100
    expect(result[2]).toBeCloseTo(1100, 0);
  });
});

describe('OBV Indicator', () => {
  it('should calculate OBV correctly', () => {
    const data = createPredictableData();
    const result = calculateOBV(data, 0);

    // OBV powinno rosnąć gdy cena rośnie i maleć gdy spada
    expect(result[0]).toBe(1000); // Pierwsza wartość = wolumen
    // Cena wzrosła (100 -> 106), więc OBV rośnie
    expect(result[1]).toBe(1000 + 1200);
  });

  it('should support signal line', () => {
    const data = generateTestData(30);
    const result = calculateOBV(data, 5);

    const lastResult = result[result.length - 1];
    expect(lastResult).toHaveProperty('obv');
    expect(lastResult).toHaveProperty('signal');
  });
});

describe('Indicator Integration', () => {
  it('should work with registry', () => {
    const registry = IndicatorRegistry.getInstance();
    const data = generateTestData(50);

    const sma = registry.get('SMA');
    expect(sma).toBeDefined();

    const result = sma!.calculate(data, { period: 10, source: 'close' });
    expect(result.length).toBe(50);
  });

  it('should validate parameters', () => {
    const registry = IndicatorRegistry.getInstance();

    const sma = registry.get('SMA');
    expect(sma!.validate({ period: -1 }).valid).toBe(false);
    expect(sma!.validate({ period: 10 }).valid).toBe(true);

    const rsi = registry.get('RSI');
    expect(rsi!.validate({ period: 1 }).valid).toBe(false);
    expect(rsi!.validate({ period: 14 }).valid).toBe(true);
  });
});
