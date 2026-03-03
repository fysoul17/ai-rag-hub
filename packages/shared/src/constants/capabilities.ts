import type { BackendCapabilities } from '../types/index.ts';
import { AIBackend } from '../types/index.ts';

export const BACKEND_CAPABILITIES: Record<AIBackend, BackendCapabilities> = {
  [AIBackend.CLAUDE]: {
    customTools: true,
    streaming: true,
    sessionPersistence: true,
    fileAccess: true,
  },
  [AIBackend.CODEX]: {
    customTools: true,
    streaming: true,
    sessionPersistence: true,
    fileAccess: true,
  },
  [AIBackend.GEMINI]: {
    customTools: true,
    streaming: true,
    sessionPersistence: true,
    fileAccess: false,
  },
  [AIBackend.PI]: {
    customTools: false,
    streaming: true,
    sessionPersistence: true,
    fileAccess: false,
  },
  [AIBackend.OLLAMA]: {
    customTools: true,
    streaming: true,
    sessionPersistence: false,
    fileAccess: false,
  },
};
