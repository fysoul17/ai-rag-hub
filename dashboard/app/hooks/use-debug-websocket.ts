'use client';

import type { DebugEvent, WSServerMessage } from '@autonomy/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { RUNTIME_WS_URL } from '@/lib/constants';
import { reconnectDelay, safeParseWsMessage } from '@/lib/ws-utils';

export type DebugConnectionStatus = 'connecting' | 'connected' | 'disconnected';

// Performance: 500 cap keeps DOM node count manageable without virtualization
const MAX_CLIENT_EVENTS = 500;
const DEBUG_WS_TOKEN =
  typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_DEBUG_WS_TOKEN ?? '') : '';

interface UseDebugWebSocketOptions {
  /** When false, the WebSocket is disconnected and no connection is attempted. Default: true */
  enabled?: boolean;
}

export function useDebugWebSocket({ enabled = true }: UseDebugWebSocketOptions = {}) {
  const [status, setStatus] = useState<DebugConnectionStatus>('disconnected');
  const [events, setEvents] = useState<DebugEvent[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reconnect logic uses refs only
  const connect = useCallback(() => {
    if (!enabledRef.current) return;
    const current = wsRef.current;
    if (current?.readyState === WebSocket.OPEN || current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    try {
      const tokenParam = DEBUG_WS_TOKEN ? `?token=${encodeURIComponent(DEBUG_WS_TOKEN)}` : '';
      const ws = new WebSocket(`${RUNTIME_WS_URL}/ws/debug${tokenParam}`);
      wsRef.current = ws;
      setStatus('connecting');

      ws.onopen = () => {
        setStatus('connected');
        retryCountRef.current = 0;
      };

      ws.onmessage = (event) => {
        const parsed = safeParseWsMessage<WSServerMessage>(event.data);
        if (!parsed) return;

        if (parsed.type === 'debug_history') {
          setEvents((prev) => {
            const combined = [...prev, ...parsed.events];
            return combined.length > MAX_CLIENT_EVENTS
              ? combined.slice(-MAX_CLIENT_EVENTS)
              : combined;
          });
        } else if (parsed.type === 'debug_event') {
          setEvents((prev) => {
            const next = [...prev, parsed.event];
            return next.length > MAX_CLIENT_EVENTS ? next.slice(-MAX_CLIENT_EVENTS) : next;
          });
        }
      };

      ws.onclose = () => {
        setStatus('disconnected');
        if (enabledRef.current) {
          scheduleReconnect();
        }
      };

      ws.onerror = () => {
        // onclose will fire after this
      };
    } catch {
      setStatus('disconnected');
      if (enabledRef.current) {
        scheduleReconnect();
      }
    }
  }, []);

  function scheduleReconnect() {
    reconnectRef.current = setTimeout(connect, reconnectDelay(retryCountRef.current));
    retryCountRef.current += 1;
  }

  function disconnect() {
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onclose = null; // suppress reconnect on intentional close
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus('disconnected');
  }

  // Connect/disconnect based on enabled flag
  // biome-ignore lint/correctness/useExhaustiveDependencies: connect and disconnect only use refs — stable across renders
  useEffect(() => {
    if (enabled) {
      retryCountRef.current = 0;
      connect();
    } else {
      disconnect();
    }
  }, [enabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, []);

  return { status, events, clearEvents };
}
