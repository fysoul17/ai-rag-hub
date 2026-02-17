// @autonomy/memory-server — Standalone memory sidecar service

import {
  AnthropicEmbeddingProvider,
  createGraphStore,
  type EmbeddingProviderInstance,
  getEmbeddingProvider,
  Memory,
  OpenAIEmbeddingProvider,
  registerEmbeddingProvider,
  StubEmbeddingProvider,
} from '@autonomy/memory';
import { EmbeddingProviderName } from '@autonomy/shared';
import { parseMemoryServerConfig } from './config.ts';
import { Router } from './router.ts';
import { createGraphRoutes } from './routes/graph.ts';
import { createHealthRoute } from './routes/health.ts';
import { createFileIngestRoute } from './routes/ingest-file.ts';
import { createMemoryRoutes } from './routes/memory.ts';

export { parseMemoryServerConfig } from './config.ts';
export { BadRequestError, InternalError, NotFoundError, ServerError } from './errors.ts';
export { corsHeaders, errorResponse, handlePreflight, jsonResponse, parseJsonBody } from './middleware.ts';
export { type RouteHandler, type RouteParams, Router } from './router.ts';

function createEmbeddingProvider(config: {
  provider: EmbeddingProviderName;
  apiKey?: string;
  model?: string;
  dimensions?: number;
}): EmbeddingProviderInstance {
  switch (config.provider) {
    case EmbeddingProviderName.ANTHROPIC: {
      const provider = new AnthropicEmbeddingProvider({
        apiKey: config.apiKey,
        model: config.model,
        dimensions: config.dimensions,
      });
      registerEmbeddingProvider(provider);
      return provider;
    }
    case EmbeddingProviderName.OPENAI: {
      const provider = new OpenAIEmbeddingProvider({
        apiKey: config.apiKey,
        model: config.model,
        dimensions: config.dimensions,
      });
      registerEmbeddingProvider(provider);
      return provider;
    }
    case EmbeddingProviderName.STUB:
    default:
      return getEmbeddingProvider(EmbeddingProviderName.STUB);
  }
}

async function main() {
  const startTime = Date.now();
  const config = parseMemoryServerConfig();

  console.log(
    `[memory-server] Starting with config: PORT=${config.PORT}, EMBEDDING=${config.EMBEDDING_PROVIDER}`,
  );

  // Initialize embedding provider
  const embeddingProvider = createEmbeddingProvider({
    provider: config.EMBEDDING_PROVIDER,
    apiKey: config.EMBEDDING_API_KEY,
    model: config.EMBEDDING_MODEL,
    dimensions: config.EMBEDDING_DIMENSIONS,
  });
  const embedder = (texts: string[]) => embeddingProvider.embed(texts);
  console.log(`[memory-server] Embedding provider: ${embeddingProvider.name} (${embeddingProvider.dimensions}d)`);

  // Initialize graph store (before Memory so Graph RAG can be registered)
  const graphStore = createGraphStore({
    neo4jUrl: config.NEO4J_URL,
    neo4jUsername: config.NEO4J_USERNAME,
    neo4jPassword: config.NEO4J_PASSWORD,
  });
  await graphStore.initialize({
    neo4jUrl: config.NEO4J_URL,
    neo4jUsername: config.NEO4J_USERNAME,
    neo4jPassword: config.NEO4J_PASSWORD,
  });
  console.log(`[memory-server] Graph store: ${graphStore.name}`);

  // Initialize Memory (with graph store for Graph RAG)
  const memory = new Memory({
    dataDir: config.DATA_DIR,
    embedder,
    dimensions: embeddingProvider.dimensions,
    graphStore,
  });
  await memory.initialize();
  console.log('[memory-server] Memory initialized');

  // Build HTTP router
  const router = new Router();

  const healthRoute = createHealthRoute(memory, config.EMBEDDING_PROVIDER, startTime);
  const memoryRoutes = createMemoryRoutes(memory);
  const graphRoutes = createGraphRoutes(graphStore);
  const fileIngestRoute = createFileIngestRoute(memory);

  router.get('/health', healthRoute);

  router.get('/api/memory/search', memoryRoutes.search);
  router.post('/api/memory/ingest', memoryRoutes.ingest);
  router.post('/api/memory/ingest/file', fileIngestRoute);
  router.get('/api/memory/stats', memoryRoutes.stats);
  router.get('/api/memory/entries', memoryRoutes.listEntries);
  router.get('/api/memory/entries/:id', memoryRoutes.getEntry);
  router.delete('/api/memory/entries/:id', memoryRoutes.deleteEntry);
  router.delete('/api/memory/sessions/:sessionId', memoryRoutes.clearSession);

  router.get('/api/memory/graph/nodes', graphRoutes.getNodes);
  router.get('/api/memory/graph/edges', graphRoutes.getEdges);
  router.post('/api/memory/graph/query', graphRoutes.query);

  // Start server
  const server = Bun.serve({
    port: config.PORT,
    fetch(req) {
      return router.handle(req);
    },
  });

  console.log(`[memory-server] Listening on http://localhost:${server.port}`);

  // Graceful shutdown
  const shutdown = async () => {
    console.log('[memory-server] Shutting down...');
    await graphStore.shutdown();
    await memory.shutdown();
    server.stop();
    console.log('[memory-server] Shutdown complete');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// Only run main when this is the entry point
const isMainModule = typeof Bun !== 'undefined' && Bun.main === import.meta.path;

if (isMainModule) {
  main().catch((error) => {
    console.error('[memory-server] Fatal error:', error);
    process.exit(1);
  });
}
