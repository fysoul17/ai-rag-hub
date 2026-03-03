import type { HookRegistryInterface } from '@autonomy/shared';
import type { IncomingMessage } from '../../src/types.ts';

/** Minimal mock hook registry that records emitWaterfall calls. */
export function createMockRegistry(
  returnValue: unknown = undefined,
): HookRegistryInterface & { calls: Array<{ hookType: string; data: unknown }> } {
  const calls: Array<{ hookType: string; data: unknown }> = [];
  return {
    calls,
    register: () => () => {},
    emit: async () => {},
    emitWaterfall: async <T>(hookType: string, data: T): Promise<T> => {
      calls.push({ hookType, data });
      return returnValue as T;
    },
    unregisterPlugin: () => {},
    getHandlerCount: () => 0,
    clear: () => {},
  };
}

export function makeMessage(overrides: Partial<IncomingMessage> = {}): IncomingMessage {
  return {
    content: 'Hello world',
    senderId: 'agent-1',
    senderName: 'TestAgent',
    sessionId: 'sess-1',
    ...overrides,
  };
}
