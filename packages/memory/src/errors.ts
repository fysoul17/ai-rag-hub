export class MemoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MemoryError';
  }
}

export class MemoryStoreError extends MemoryError {
  constructor(operation: string, detail: string) {
    super(`Store ${operation} failed: ${detail}`);
    this.name = 'MemoryStoreError';
  }
}

export class MemoryNotFoundError extends MemoryError {
  constructor(id: string) {
    super(`Memory entry "${id}" not found`);
    this.name = 'MemoryNotFoundError';
  }
}

export class MemorySearchError extends MemoryError {
  constructor(detail: string) {
    super(`Search failed: ${detail}`);
    this.name = 'MemorySearchError';
  }
}

export class VectorProviderError extends MemoryError {
  constructor(provider: string, detail: string) {
    super(`Vector provider "${provider}" error: ${detail}`);
    this.name = 'VectorProviderError';
  }
}

export class EmbeddingError extends MemoryError {
  constructor(detail: string) {
    super(`Embedding failed: ${detail}`);
    this.name = 'EmbeddingError';
  }
}
