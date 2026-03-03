/** Parse a raw WebSocket message as JSON, returning null on failure. */
export function safeParseWsMessage<T>(data: unknown): T | null {
  try {
    return JSON.parse(data as string) as T;
  } catch {
    return null;
  }
}

/** Compute exponential backoff delay, capped at 30s. */
export function reconnectDelay(retryCount: number): number {
  return Math.min(1000 * 2 ** retryCount, 30_000);
}
