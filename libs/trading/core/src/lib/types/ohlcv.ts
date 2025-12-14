/**
 * OHLCV - Open, High, Low, Close, Volume
 * Podstawowa struktura danych świecowych
 */
export interface OHLCV {
  timestamp: number; // Unix timestamp w ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Rozszerzone dane OHLCV z dodatkowymi metadanymi
 */
export interface OHLCVWithMetadata extends OHLCV {
  symbol: string;
  timeframe: Timeframe;
}

/**
 * Dostępne timeframes
 */
export type Timeframe =
  | '1m'
  | '3m'
  | '5m'
  | '15m'
  | '30m'
  | '1h'
  | '2h'
  | '4h'
  | '6h'
  | '12h'
  | '1d'
  | '1w'
  | '1M';

/**
 * Mapowanie timeframe na minuty
 */
export const TIMEFRAME_TO_MINUTES: Record<Timeframe, number> = {
  '1m': 1,
  '3m': 3,
  '5m': 5,
  '15m': 15,
  '30m': 30,
  '1h': 60,
  '2h': 120,
  '4h': 240,
  '6h': 360,
  '12h': 720,
  '1d': 1440,
  '1w': 10080,
  '1M': 43200,
};

/**
 * Konwersja timeframe na milisekundy
 */
export function timeframeToMs(timeframe: Timeframe): number {
  return TIMEFRAME_TO_MINUTES[timeframe] * 60 * 1000;
}

/**
 * Dane dla wielu timeframe'ów
 */
export type MultiTimeframeData = Map<Timeframe, OHLCV[]>;

/**
 * Znajdź świecę z wyższego timeframe'u dla danego timestamp'u
 * Zwraca świecę, która zawiera dany timestamp (lub poprzednią zamkniętą)
 */
export function findHigherTfCandle(
  timestamp: number,
  higherTfData: OHLCV[],
  higherTf: Timeframe
): OHLCV | null {
  const tfMs = timeframeToMs(higherTf);
  
  // Znajdź świecę, która zawiera ten timestamp lub jest tuż przed nim
  // Używamy ostatniej ZAMKNIĘTEJ świecy (nie bieżącej)
  const candleStartTime = Math.floor(timestamp / tfMs) * tfMs;
  const previousCandleStart = candleStartTime - tfMs;
  
  // Szukamy świecy z poprzedniego okresu (zamkniętej)
  for (let i = higherTfData.length - 1; i >= 0; i--) {
    if (higherTfData[i].timestamp <= previousCandleStart) {
      return higherTfData[i];
    }
  }
  
  // Fallback - pierwsza dostępna świeca
  return higherTfData.length > 0 ? higherTfData[0] : null;
}

/**
 * Zbuduj indeks świec wyższego TF dla szybkiego wyszukiwania
 */
export function buildHigherTfIndex(
  primaryData: OHLCV[],
  higherTfData: OHLCV[],
  higherTf: Timeframe
): (OHLCV | null)[] {
  const tfMs = timeframeToMs(higherTf);
  const result: (OHLCV | null)[] = [];
  
  let htfIndex = 0;
  
  for (const candle of primaryData) {
    const previousCandleStart = Math.floor(candle.timestamp / tfMs) * tfMs - tfMs;
    
    // Przesuń indeks do odpowiedniej świecy HTF
    while (
      htfIndex < higherTfData.length - 1 &&
      higherTfData[htfIndex + 1].timestamp <= previousCandleStart
    ) {
      htfIndex++;
    }
    
    if (htfIndex < higherTfData.length && higherTfData[htfIndex].timestamp <= previousCandleStart) {
      result.push(higherTfData[htfIndex]);
    } else {
      result.push(null);
    }
  }
  
  return result;
}
