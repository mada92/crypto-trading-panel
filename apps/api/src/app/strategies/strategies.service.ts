import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  StrategySchema,
  // Single Source of Truth - strategie z core
  PIVOT_SMMA_V3_STRATEGY,
  SMA_CROSSOVER_RSI_STRATEGY,
} from '@trading-system/core';

const uuidv4 = (): string => randomUUID();
import { CreateStrategyDto, UpdateStrategyDto } from './dto/strategy.dto';

interface StoredStrategy {
  id: string;
  schema: StrategySchema;
  versions: { version: string; schema: StrategySchema; createdAt: Date }[];
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class StrategiesService {
  // In-memory storage (w produkcji zastąpione bazą danych)
  private strategies: Map<string, StoredStrategy> = new Map();

  constructor() {
    // Dodaj przykładowe strategie
    this.createSampleStrategy();
    this.createSimpleTestStrategy();
  }

  private createSampleStrategy(): void {
    // Single Source of Truth - używamy strategii z @trading-system/core
    const pivotSmmaStrategy = PIVOT_SMMA_V3_STRATEGY;

    const id = pivotSmmaStrategy.id;
    this.strategies.set(id, {
      id,
      schema: pivotSmmaStrategy,
      versions: [
        {
          version: pivotSmmaStrategy.version,
          schema: pivotSmmaStrategy,
          createdAt: new Date(),
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /**
   * Prosta strategia testowa - SMA Crossover + RSI
   */
  private createSimpleTestStrategy(): void {
    // Single Source of Truth - używamy strategii z @trading-system/core
    const simpleStrategy = SMA_CROSSOVER_RSI_STRATEGY;

    const id = simpleStrategy.id;
    this.strategies.set(id, {
      id,
      schema: simpleStrategy,
      versions: [
        {
          version: simpleStrategy.version,
          schema: simpleStrategy,
          createdAt: new Date(),
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async findAll(status?: string): Promise<StoredStrategy[]> {
    let strategies = Array.from(this.strategies.values());

    if (status) {
      strategies = strategies.filter((s) => s.schema.status === status);
    }

    return strategies;
  }

  async findOne(id: string): Promise<StoredStrategy> {
    const strategy = this.strategies.get(id);
    if (!strategy) {
      throw new NotFoundException(`Strategy with ID ${id} not found`);
    }
    return strategy;
  }

  async create(dto: CreateStrategyDto): Promise<StoredStrategy> {
    const id = uuidv4();

    // Ensure required fields have defaults
    const schema: StrategySchema = {
      id,
      version: '1.0.0',
      name: dto.schema.name || 'Unnamed Strategy',
      description: dto.schema.description,
      status: 'draft',
      dataRequirements: dto.schema.dataRequirements || {
        primaryTimeframe: '4h',
        lookbackPeriods: 100,
        symbols: ['BTCUSDT'],
      },
      indicators: dto.schema.indicators || [],
      computedVariables: dto.schema.computedVariables,
      entrySignals: dto.schema.entrySignals || {},
      exitSignals: dto.schema.exitSignals || {},
      riskManagement: dto.schema.riskManagement || {
        riskPerTrade: 2,
        maxPositionSize: 10,
        maxOpenPositions: 1,
      },
      optimizationHints: dto.schema.optimizationHints,
    };

    const stored: StoredStrategy = {
      id,
      schema,
      versions: [{ version: '1.0.0', schema, createdAt: new Date() }],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.strategies.set(id, stored);
    return stored;
  }

  async update(id: string, dto: UpdateStrategyDto): Promise<StoredStrategy> {
    const existing = await this.findOne(id);

    // Increment version
    const versionParts = existing.schema.version.split('.');
    versionParts[2] = String(parseInt(versionParts[2]) + 1);
    const newVersion = versionParts.join('.');

    const updatedSchema: StrategySchema = {
      ...existing.schema,
      name: dto.schema.name ?? existing.schema.name,
      description: dto.schema.description ?? existing.schema.description,
      dataRequirements: dto.schema.dataRequirements ?? existing.schema.dataRequirements,
      indicators: dto.schema.indicators ?? existing.schema.indicators,
      computedVariables: dto.schema.computedVariables ?? existing.schema.computedVariables,
      entrySignals: dto.schema.entrySignals ?? existing.schema.entrySignals,
      exitSignals: dto.schema.exitSignals ?? existing.schema.exitSignals,
      riskManagement: dto.schema.riskManagement ?? existing.schema.riskManagement,
      optimizationHints: dto.schema.optimizationHints ?? existing.schema.optimizationHints,
      id,
      version: newVersion,
    };

    const updated: StoredStrategy = {
      ...existing,
      schema: updatedSchema,
      versions: [
        ...existing.versions,
        { version: newVersion, schema: updatedSchema, createdAt: new Date() },
      ],
      updatedAt: new Date(),
    };

    this.strategies.set(id, updated);
    return updated;
  }

  async remove(id: string): Promise<void> {
    const exists = this.strategies.has(id);
    if (!exists) {
      throw new NotFoundException(`Strategy with ID ${id} not found`);
    }
    this.strategies.delete(id);
  }

  async clone(id: string): Promise<StoredStrategy> {
    const original = await this.findOne(id);
    const newId = uuidv4();

    const clonedSchema: StrategySchema = {
      ...original.schema,
      id: newId,
      name: `${original.schema.name} (Copy)`,
      version: '1.0.0',
      status: 'draft',
    };

    const cloned: StoredStrategy = {
      id: newId,
      schema: clonedSchema,
      versions: [{ version: '1.0.0', schema: clonedSchema, createdAt: new Date() }],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.strategies.set(newId, cloned);
    return cloned;
  }

  async getVersions(id: string) {
    const strategy = await this.findOne(id);
    return strategy.versions;
  }

  async validate(schema: unknown): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Basic validation
    if (!schema || typeof schema !== 'object') {
      errors.push('Schema must be an object');
      return { valid: false, errors };
    }

    const s = schema as Record<string, unknown>;

    if (!s['name']) {
      errors.push('Strategy name is required');
    }

    if (!s['dataRequirements']) {
      errors.push('Data requirements are required');
    }

    if (!s['indicators'] || !Array.isArray(s['indicators'])) {
      errors.push('Indicators array is required');
    }

    if (!s['entrySignals']) {
      errors.push('Entry signals are required');
    }

    if (!s['exitSignals']) {
      errors.push('Exit signals are required');
    }

    if (!s['riskManagement']) {
      errors.push('Risk management configuration is required');
    }

    return { valid: errors.length === 0, errors };
  }

  getSchema(id: string): StrategySchema | undefined {
    return this.strategies.get(id)?.schema;
  }
}
