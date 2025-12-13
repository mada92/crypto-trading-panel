import { ConditionEvaluator, EvaluationContext } from './condition-evaluator';
import { ConditionGroup, Condition } from '../types/strategy';

describe('ConditionEvaluator', () => {
  let evaluator: ConditionEvaluator;
  let baseContext: EvaluationContext;

  beforeEach(() => {
    evaluator = new ConditionEvaluator();
    baseContext = {
      indicators: {
        sma20: 100,
        sma50: 95,
        rsi: 55,
        macd: { macd: 2, signal: 1, histogram: 1 },
      },
      variables: {
        trendUp: 1,
        trendDown: 0,
      },
      price: {
        open: 98,
        high: 102,
        low: 97,
        close: 101,
        volume: 1000000,
      },
    };
  });

  describe('evaluateCondition', () => {
    it('should evaluate greater_than correctly', () => {
      const condition: Condition = {
        type: 'greater_than',
        left: 'sma20',
        right: 'sma50',
      };

      expect(evaluator.evaluateCondition(condition, baseContext)).toBe(true);

      // Zmień wartości
      baseContext.indicators['sma20'] = 90;
      expect(evaluator.evaluateCondition(condition, baseContext)).toBe(false);
    });

    it('should evaluate less_than correctly', () => {
      const condition: Condition = {
        type: 'less_than',
        left: 'rsi',
        right: 70,
      };

      expect(evaluator.evaluateCondition(condition, baseContext)).toBe(true);

      baseContext.indicators['rsi'] = 75;
      expect(evaluator.evaluateCondition(condition, baseContext)).toBe(false);
    });

    it('should evaluate equals correctly', () => {
      const condition: Condition = {
        type: 'equals',
        left: 'trendUp',
        right: 1,
      };

      expect(evaluator.evaluateCondition(condition, baseContext)).toBe(true);
    });

    it('should evaluate not_equals correctly', () => {
      const condition: Condition = {
        type: 'not_equals',
        left: 'trendDown',
        right: 1,
      };

      expect(evaluator.evaluateCondition(condition, baseContext)).toBe(true);
    });

    it('should evaluate between correctly', () => {
      const condition: Condition = {
        type: 'between',
        left: 'rsi',
        right: '',
        params: { min: 30, max: 70 },
      };

      expect(evaluator.evaluateCondition(condition, baseContext)).toBe(true);

      baseContext.indicators['rsi'] = 80;
      expect(evaluator.evaluateCondition(condition, baseContext)).toBe(false);
    });

    it('should evaluate crosses_above correctly', () => {
      const contextWithPrevious: EvaluationContext = {
        ...baseContext,
        indicators: { sma20: 100, sma50: 95 },
        previous: {
          indicators: { sma20: 90, sma50: 95 }, // Poprzednio sma20 < sma50
          variables: {},
          price: { open: 95, high: 100, low: 94, close: 98, volume: 900000 },
        },
      };

      const condition: Condition = {
        type: 'crosses_above',
        left: 'sma20',
        right: 'sma50',
      };

      expect(evaluator.evaluateCondition(condition, contextWithPrevious)).toBe(true);
    });

    it('should evaluate crosses_below correctly', () => {
      const contextWithPrevious: EvaluationContext = {
        ...baseContext,
        indicators: { sma20: 90, sma50: 95 },
        previous: {
          indicators: { sma20: 100, sma50: 95 }, // Poprzednio sma20 > sma50
          variables: {},
          price: { open: 95, high: 100, low: 94, close: 98, volume: 900000 },
        },
      };

      const condition: Condition = {
        type: 'crosses_below',
        left: 'sma20',
        right: 'sma50',
      };

      expect(evaluator.evaluateCondition(condition, contextWithPrevious)).toBe(true);
    });

    it('should evaluate is_rising correctly', () => {
      const contextWithPrevious: EvaluationContext = {
        ...baseContext,
        indicators: { sma20: 100 },
        previous: {
          indicators: { sma20: 95 },
          variables: {},
          price: { open: 95, high: 100, low: 94, close: 98, volume: 900000 },
        },
      };

      const condition: Condition = {
        type: 'is_rising',
        left: 'sma20',
        right: 0,
      };

      expect(evaluator.evaluateCondition(condition, contextWithPrevious)).toBe(true);
    });

    it('should evaluate is_falling correctly', () => {
      const contextWithPrevious: EvaluationContext = {
        ...baseContext,
        indicators: { sma20: 90 },
        previous: {
          indicators: { sma20: 100 },
          variables: {},
          price: { open: 95, high: 100, low: 94, close: 98, volume: 900000 },
        },
      };

      const condition: Condition = {
        type: 'is_falling',
        left: 'sma20',
        right: 0,
      };

      expect(evaluator.evaluateCondition(condition, contextWithPrevious)).toBe(true);
    });

    it('should resolve price references', () => {
      const condition: Condition = {
        type: 'greater_than',
        left: 'close',
        right: 100,
      };

      expect(evaluator.evaluateCondition(condition, baseContext)).toBe(true);
    });

    it('should resolve multi-line indicator properties', () => {
      const condition: Condition = {
        type: 'greater_than',
        left: 'macd.macd',
        right: 'macd.signal',
      };

      expect(evaluator.evaluateCondition(condition, baseContext)).toBe(true);
    });

    it('should return false for null values', () => {
      baseContext.indicators['nullIndicator'] = null;

      const condition: Condition = {
        type: 'greater_than',
        left: 'nullIndicator',
        right: 50,
      };

      expect(evaluator.evaluateCondition(condition, baseContext)).toBe(false);
    });
  });

  describe('evaluateGroup', () => {
    it('should evaluate AND group correctly', () => {
      const group: ConditionGroup = {
        operator: 'AND',
        conditions: [
          { type: 'greater_than', left: 'sma20', right: 'sma50' },
          { type: 'less_than', left: 'rsi', right: 70 },
        ],
      };

      expect(evaluator.evaluateGroup(group, baseContext)).toBe(true);

      // Zmień RSI aby warunek nie był spełniony
      baseContext.indicators['rsi'] = 75;
      expect(evaluator.evaluateGroup(group, baseContext)).toBe(false);
    });

    it('should evaluate OR group correctly', () => {
      const group: ConditionGroup = {
        operator: 'OR',
        conditions: [
          { type: 'greater_than', left: 'rsi', right: 80 }, // false
          { type: 'less_than', left: 'rsi', right: 70 }, // true
        ],
      };

      expect(evaluator.evaluateGroup(group, baseContext)).toBe(true);
    });

    it('should evaluate nested groups', () => {
      const group: ConditionGroup = {
        operator: 'AND',
        conditions: [
          { type: 'greater_than', left: 'sma20', right: 'sma50' },
          {
            operator: 'OR',
            conditions: [
              { type: 'less_than', left: 'rsi', right: 30 },
              { type: 'greater_than', left: 'rsi', right: 50 },
            ],
          },
        ],
      };

      expect(evaluator.evaluateGroup(group, baseContext)).toBe(true);
    });

    it('should return true for empty conditions', () => {
      const group: ConditionGroup = {
        operator: 'AND',
        conditions: [],
      };

      expect(evaluator.evaluateGroup(group, baseContext)).toBe(true);
    });
  });
});
