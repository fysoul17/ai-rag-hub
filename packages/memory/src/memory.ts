import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type {
  MemoryEntry,
  MemorySearchParams,
  MemorySearchResult,
  MemoryStats,
} from '@autonomy/shared';
import { DEFAULTS, RAGStrategy, type VectorProvider } from '@autonomy/shared';
import { nanoid } from 'nanoid';
import { MemoryError } from './errors.ts';
import { getProvider } from './providers/index.ts';
import type { VectorStore } from './providers/types.ts';
import { getRAGEngine } from './rag/index.ts';
import type { EmbeddingProvider } from './rag/types.ts';
import { SQLiteStore } from './sqlite-store.ts';

export interface MemoryOptions {
  /** Directory where data files are stored. Default: DEFAULTS.DATA_DIR */
  dataDir?: string;
  /** Vector provider to use. Default: 'lancedb' */
  vectorProvider?: VectorProvider;
  /** Qdrant URL (only if vectorProvider is 'qdrant'). */
  qdrantUrl?: string;
  /** Embedding generation function. Required. */
  embedder: EmbeddingProvider;
  /** Embedding vector dimensions. Default: 1024 */
  dimensions?: number;
}

export class Memory {
  private sqliteStore: SQLiteStore | null = null;
  private vectorStore: VectorStore | null = null;
  private embedder: EmbeddingProvider;
  private dataDir: string;
  private vectorProviderName: VectorProvider;
  private dimensions: number;
  private initialized = false;

  constructor(options: MemoryOptions) {
    this.embedder = options.embedder;
    this.dataDir = options.dataDir ?? DEFAULTS.DATA_DIR;
    this.vectorProviderName =
      options.vectorProvider ?? (DEFAULTS.VECTOR_PROVIDER as VectorProvider);
    this.dimensions = options.dimensions ?? 1024;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Initialize SQLite store
    const sqlitePath =
      this.dataDir === ':memory:' ? ':memory:' : join(this.dataDir, 'memory', 'memory.db');
    if (sqlitePath !== ':memory:') {
      mkdirSync(dirname(sqlitePath), { recursive: true });
    }
    this.sqliteStore = new SQLiteStore(sqlitePath);

    // Initialize vector store
    this.vectorStore = getProvider(this.vectorProviderName);
    const vectorDir =
      this.dataDir === ':memory:' ? '/tmp/autonomy-vectors' : join(this.dataDir, 'vectors');
    if (this.dataDir !== ':memory:') {
      mkdirSync(vectorDir, { recursive: true });
    }
    await this.vectorStore.initialize({
      dataDir: vectorDir,
      dimensions: this.dimensions,
    });

    this.initialized = true;
  }

  async store(
    entry: Omit<MemoryEntry, 'id' | 'createdAt'> & { id?: string; createdAt?: string },
  ): Promise<MemoryEntry> {
    this.ensureInitialized();

    const fullEntry: MemoryEntry = {
      id: entry.id ?? nanoid(),
      content: entry.content,
      type: entry.type,
      agentId: entry.agentId,
      sessionId: entry.sessionId,
      metadata: entry.metadata ?? {},
      createdAt: entry.createdAt ?? new Date().toISOString(),
    };

    // Store structured data in SQLite
    this.sqliteStore?.store(fullEntry);

    // Generate embedding and store in vector DB
    const [embedding] = await this.embedder([fullEntry.content]);
    if (embedding) {
      await this.vectorStore?.upsert([
        {
          id: fullEntry.id,
          vector: embedding,
          metadata: {
            type: fullEntry.type,
            agentId: fullEntry.agentId ?? '',
          },
        },
      ]);
    }

    return fullEntry;
  }

  async search(params: MemorySearchParams): Promise<MemorySearchResult> {
    this.ensureInitialized();

    const strategy = params.strategy ?? RAGStrategy.NAIVE;
    const engine = getRAGEngine(strategy);

    if (!this.vectorStore || !this.sqliteStore) {
      throw new MemoryError('Memory not initialized: vectorStore or sqliteStore is null');
    }
    return engine.search(params, this.vectorStore, this.sqliteStore, this.embedder);
  }

  get(id: string): MemoryEntry | null {
    this.ensureInitialized();
    if (!this.sqliteStore) {
      throw new MemoryError('Memory not initialized: sqliteStore is null');
    }
    return this.sqliteStore.get(id);
  }

  delete(id: string): boolean {
    this.ensureInitialized();
    if (!this.sqliteStore) {
      throw new MemoryError('Memory not initialized: sqliteStore is null');
    }
    const deleted = this.sqliteStore.delete(id);
    if (deleted) {
      // Fire and forget vector deletion
      this.vectorStore?.delete([id]).catch(() => {});
    }
    return deleted;
  }

  clearSession(sessionId: string): number {
    this.ensureInitialized();
    if (!this.sqliteStore) {
      throw new MemoryError('Memory not initialized: sqliteStore is null');
    }
    return this.sqliteStore.deleteBySession(sessionId);
  }

  async stats(): Promise<MemoryStats> {
    this.ensureInitialized();
    if (!this.sqliteStore || !this.vectorStore) {
      throw new MemoryError('Memory not initialized: stores are null');
    }

    const totalEntries = this.sqliteStore.count();
    const vectorCount = await this.vectorStore.count();

    // Rough storage estimation — actual bytes depend on content length
    const recentEntries = this.sqliteStore.query({ limit: 100 });
    const storageEstimate = recentEntries.reduce(
      (sum, e) => sum + e.content.length + JSON.stringify(e.metadata).length,
      0,
    );

    return {
      totalEntries,
      storageUsedBytes: storageEstimate,
      vectorCount,
      recentAccessCount: recentEntries.length,
    };
  }

  async shutdown(): Promise<void> {
    if (this.vectorStore) {
      await this.vectorStore.shutdown();
      this.vectorStore = null;
    }
    if (this.sqliteStore) {
      this.sqliteStore.close();
      this.sqliteStore = null;
    }
    this.initialized = false;
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new MemoryError('Memory system not initialized. Call initialize() first.');
    }
  }
}
