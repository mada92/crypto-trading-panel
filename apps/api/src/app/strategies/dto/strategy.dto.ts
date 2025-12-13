import { StrategySchema } from '@trading-system/core';

export class CreateStrategyDto {
  schema: Partial<StrategySchema>;
}

export class UpdateStrategyDto {
  schema: Partial<StrategySchema>;
}
