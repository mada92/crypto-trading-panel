import { Condition, ConditionGroup, ConditionType } from '../types/strategy';

/**
 * Kontekst dla ewaluacji warunków
 * Zawiera wszystkie dostępne wartości wskaźników i zmiennych
 */
export interface EvaluationContext {
  // Wskaźniki - klucz to id wskaźnika
  indicators: Record<string, number | Record<string, number | null> | null>;

  // Zmienne obliczeniowe
  variables: Record<string, number | null>;

  // Ceny
  price: {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  };

  // Poprzednie wartości (dla crosses_above/below)
  previous?: {
    indicators: Record<string, number | Record<string, number | null> | null>;
    variables: Record<string, number | null>;
    price: {
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    };
  };
}

/**
 * Evaluator warunków strategii
 */
export class ConditionEvaluator {
  private debugMode = false;
  private debugSampleInterval = 1000; // Loguj co N-tą świecę
  private evaluationCount = 0;

  /**
   * Włącz/wyłącz tryb debugowania
   */
  setDebugMode(enabled: boolean, sampleInterval = 1000): void {
    this.debugMode = enabled;
    this.debugSampleInterval = sampleInterval;
    this.evaluationCount = 0;
  }

  /**
   * Ewaluuj grupę warunków
   */
  evaluateGroup(group: ConditionGroup, context: EvaluationContext, label = 'conditions'): boolean {
    if (!group.conditions || group.conditions.length === 0) {
      return true; // Brak warunków = zawsze prawda
    }

    this.evaluationCount++;
    const shouldLog = this.debugMode && (this.evaluationCount % this.debugSampleInterval === 0);

    const results = group.conditions.map((condition, idx) => {
      if (this.isConditionGroup(condition)) {
        return this.evaluateGroup(condition, context, `${label}[${idx}]`);
      }
      const result = this.evaluateCondition(condition, context);
      
      if (shouldLog) {
        const leftVal = this.resolveValue(condition.left, context);
        const rightVal = this.resolveValue(condition.right, context);
        console.log(`[DEBUG] ${label}[${idx}] ${condition.left}(${leftVal?.toFixed(2)}) ${condition.type} ${condition.right}(${typeof condition.right === 'number' ? condition.right : rightVal?.toFixed(2)}) => ${result}`);
      }
      
      return result;
    });

    const finalResult = group.operator === 'AND' 
      ? results.every((r) => r)
      : results.some((r) => r);

    if (shouldLog) {
      console.log(`[DEBUG] ${label} (${group.operator}): [${results.join(', ')}] => ${finalResult}`);
    }

    return finalResult;
  }

  /**
   * Ewaluuj pojedynczy warunek
   */
  evaluateCondition(condition: Condition, context: EvaluationContext): boolean {
    const leftValue = this.resolveValue(condition.left, context);
    const rightValue = this.resolveValue(condition.right, context);

    if (leftValue === null || leftValue === undefined) {
      return false;
    }

    switch (condition.type) {
      case 'greater_than':
        return rightValue !== null && leftValue > rightValue;

      case 'less_than':
        return rightValue !== null && leftValue < rightValue;

      case 'equals':
        return leftValue === rightValue;

      case 'not_equals':
        return leftValue !== rightValue;

      case 'between':
        return this.evaluateBetween(leftValue, rightValue, condition.params);

      case 'crosses_above':
        return this.evaluateCrossesAbove(condition.left, condition.right, context);

      case 'crosses_below':
        return this.evaluateCrossesBelow(condition.left, condition.right, context);

      case 'is_rising':
        return this.evaluateIsRising(condition.left, context);

      case 'is_falling':
        return this.evaluateIsFalling(condition.left, context);

      default:
        console.warn(`Unknown condition type: ${condition.type}`);
        return false;
    }
  }

  /**
   * Rozwiąż wartość z referencji lub zwróć liczbę
   */
  private resolveValue(
    ref: string | number,
    context: EvaluationContext,
    usePrevious = false
  ): number | null {
    if (typeof ref === 'number') {
      return ref;
    }

    const ctx = usePrevious && context.previous ? context.previous : context;

    // Sprawdź ceny
    const priceKeys = ['open', 'high', 'low', 'close', 'volume', 'price'];
    if (priceKeys.includes(ref.toLowerCase())) {
      const key = ref.toLowerCase() === 'price' ? 'close' : ref.toLowerCase();
      return ctx.price[key as keyof typeof ctx.price] ?? null;
    }

    // Sprawdź wskaźniki (może być id.property dla multi-line)
    if (ref.includes('.')) {
      const [indicatorId, property] = ref.split('.');
      const indicator = ctx.indicators[indicatorId];
      if (indicator && typeof indicator === 'object' && property in indicator) {
        return indicator[property] as number | null;
      }
    }

    // Sprawdź wskaźniki (single value)
    if (ref in ctx.indicators) {
      const value = ctx.indicators[ref];
      if (typeof value === 'number') {
        return value;
      }
      // Dla multi-line, domyślnie zwróć pierwszą wartość
      if (typeof value === 'object' && value !== null) {
        const firstKey = Object.keys(value)[0];
        return value[firstKey] as number | null;
      }
    }

    // Sprawdź zmienne
    if (ref in ctx.variables) {
      return ctx.variables[ref];
    }

    // Spróbuj sparsować jako liczbę
    const parsed = parseFloat(ref);
    if (!isNaN(parsed)) {
      return parsed;
    }

    return null;
  }

  /**
   * Sprawdź czy wartość jest w zakresie
   * Jeśli rightValue jest podane, sprawdza czy left/right ratio jest między min i max
   */
  private evaluateBetween(
    leftValue: number,
    rightValue: number | null,
    params?: Record<string, number | string>
  ): boolean {
    if (!params) return false;

    const min = Number(params['min']);
    const max = Number(params['max']);

    if (isNaN(min) || isNaN(max)) {
      return false;
    }

    // Jeśli mamy rightValue, porównaj stosunek left/right z min/max
    if (rightValue !== null && rightValue !== 0) {
      const ratio = leftValue / rightValue;
      return ratio >= min && ratio <= max;
    }

    // Bez rightValue - proste sprawdzenie zakresu
    return leftValue >= min && leftValue <= max;
  }

  /**
   * Sprawdź czy wartość przecięła w górę
   */
  private evaluateCrossesAbove(
    leftRef: string,
    rightRef: string | number,
    context: EvaluationContext
  ): boolean {
    if (!context.previous) return false;

    const currentLeft = this.resolveValue(leftRef, context);
    const currentRight = this.resolveValue(rightRef, context);
    const prevLeft = this.resolveValue(leftRef, context, true);
    const prevRight = this.resolveValue(rightRef, context, true);

    if (
      currentLeft === null ||
      currentRight === null ||
      prevLeft === null ||
      prevRight === null
    ) {
      return false;
    }

    // Poprzednio był poniżej lub równy, teraz jest powyżej
    return prevLeft <= prevRight && currentLeft > currentRight;
  }

  /**
   * Sprawdź czy wartość przecięła w dół
   */
  private evaluateCrossesBelow(
    leftRef: string,
    rightRef: string | number,
    context: EvaluationContext
  ): boolean {
    if (!context.previous) return false;

    const currentLeft = this.resolveValue(leftRef, context);
    const currentRight = this.resolveValue(rightRef, context);
    const prevLeft = this.resolveValue(leftRef, context, true);
    const prevRight = this.resolveValue(rightRef, context, true);

    if (
      currentLeft === null ||
      currentRight === null ||
      prevLeft === null ||
      prevRight === null
    ) {
      return false;
    }

    // Poprzednio był powyżej lub równy, teraz jest poniżej
    return prevLeft >= prevRight && currentLeft < currentRight;
  }

  /**
   * Sprawdź czy wartość rośnie
   */
  private evaluateIsRising(ref: string, context: EvaluationContext): boolean {
    if (!context.previous) return false;

    const current = this.resolveValue(ref, context);
    const prev = this.resolveValue(ref, context, true);

    if (current === null || prev === null) {
      return false;
    }

    return current > prev;
  }

  /**
   * Sprawdź czy wartość spada
   */
  private evaluateIsFalling(ref: string, context: EvaluationContext): boolean {
    if (!context.previous) return false;

    const current = this.resolveValue(ref, context);
    const prev = this.resolveValue(ref, context, true);

    if (current === null || prev === null) {
      return false;
    }

    return current < prev;
  }

  /**
   * Sprawdź czy obiekt to ConditionGroup
   */
  private isConditionGroup(obj: Condition | ConditionGroup): obj is ConditionGroup {
    return 'operator' in obj && 'conditions' in obj;
  }
}

/**
 * Singleton instance
 */
let evaluatorInstance: ConditionEvaluator | null = null;

export function getConditionEvaluator(): ConditionEvaluator {
  if (!evaluatorInstance) {
    evaluatorInstance = new ConditionEvaluator();
  }
  return evaluatorInstance;
}
