import { MemoryType, RAGStrategy } from '@autonomy/shared';
import { EntityType, RelationType } from '@pyx-memory/core';
import { BadRequestError } from './errors.ts';

const VALID_MEMORY_TYPES = new Set<string>(Object.values(MemoryType));
const VALID_RAG_STRATEGIES = new Set<string>(Object.values(RAGStrategy));
const VALID_ENTITY_TYPES = new Set<string>(Object.values(EntityType));
const VALID_RELATION_TYPES = new Set<string>(Object.values(RelationType));

export function validateMemoryType(value: string | null | undefined): MemoryType | undefined {
  if (value == null) return undefined;
  if (!VALID_MEMORY_TYPES.has(value)) {
    throw new BadRequestError(
      `Invalid type: must be one of ${[...VALID_MEMORY_TYPES].join(', ')}`,
    );
  }
  return value as MemoryType;
}

export function validateRAGStrategy(value: string | null | undefined): RAGStrategy | undefined {
  if (value == null) return undefined;
  if (!VALID_RAG_STRATEGIES.has(value)) {
    throw new BadRequestError(
      `Invalid strategy: must be one of ${[...VALID_RAG_STRATEGIES].join(', ')}`,
    );
  }
  return value as RAGStrategy;
}

export function validateEntityType(value: string): typeof EntityType[keyof typeof EntityType] {
  if (!VALID_ENTITY_TYPES.has(value)) {
    throw new BadRequestError(
      `Invalid entity type: must be one of ${[...VALID_ENTITY_TYPES].join(', ')}`,
    );
  }
  return value as typeof EntityType[keyof typeof EntityType];
}

export function validateRelationType(value: string): typeof RelationType[keyof typeof RelationType] {
  if (!VALID_RELATION_TYPES.has(value)) {
    throw new BadRequestError(
      `Invalid relation type: must be one of ${[...VALID_RELATION_TYPES].join(', ')}`,
    );
  }
  return value as typeof RelationType[keyof typeof RelationType];
}

export function validatePositiveInt(
  value: string | null | undefined,
  name: string,
  defaultValue: number,
): number {
  if (value == null) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed < 1) {
    throw new BadRequestError(`${name} must be a positive integer`);
  }
  return parsed;
}
