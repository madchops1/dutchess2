const TechnicalIndicators = require('../src/utils/technicalIndicators');

describe('TechnicalIndicators', () => {
  describe('SMA', () => {
    test('should calculate simple moving average correctly', () => {
      const prices = [1, 2, 3, 4, 5];
      const sma = TechnicalIndicators.sma(prices, 3);
      expect(sma).toBe(4); // (3+4+5)/3 = 4
    });

    test('should return null for insufficient data', () => {
      const prices = [1, 2];
      const sma = TechnicalIndicators.sma(prices, 3);
      expect(sma).toBeNull();
    });
  });

  describe('RSI', () => {
    test('should calculate RSI for upward trend', () => {
      const prices = [44, 44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.85, 47.25, 47.92, 46.67, 46.49, 46.26];
      const rsi = TechnicalIndicators.rsi(prices, 12);
      expect(rsi).toBeGreaterThan(0);
      expect(rsi).toBeLessThan(100);
    });

    test('should return null for insufficient data', () => {
      const prices = [1, 2, 3];
      const rsi = TechnicalIndicators.rsi(prices, 14);
      expect(rsi).toBeNull();
    });
  });

  describe('Bollinger Bands', () => {
    test('should calculate bollinger bands correctly', () => {
      const prices = Array.from({length: 20}, (_, i) => 100 + Math.sin(i * 0.1) * 10);
      const bands = TechnicalIndicators.bollingerBands(prices, 20, 2);
      
      expect(bands).toHaveProperty('upper');
      expect(bands).toHaveProperty('middle');
      expect(bands).toHaveProperty('lower');
      expect(bands.upper).toBeGreaterThan(bands.middle);
      expect(bands.middle).toBeGreaterThan(bands.lower);
    });
  });
});
