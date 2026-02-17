export type { EmbeddingProviderConfig, EmbeddingProviderInstance } from './types.ts';
export {
  getEmbeddingProvider,
  listEmbeddingProviders,
  registerEmbeddingProvider,
} from './registry.ts';
export { hashToVector, StubEmbeddingProvider } from './stub.ts';
export { AnthropicEmbeddingProvider } from './anthropic.ts';
export { OpenAIEmbeddingProvider } from './openai.ts';
export { LocalEmbeddingProvider } from './local.ts';

// Auto-register built-in stub provider
import { registerEmbeddingProvider } from './registry.ts';
import { StubEmbeddingProvider } from './stub.ts';

registerEmbeddingProvider(new StubEmbeddingProvider());
