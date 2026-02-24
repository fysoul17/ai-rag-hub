'use client';

import type { DebugEvent, DebugEventCategory, DebugEventLevel } from '@autonomy/shared';
import { ChevronDown, Trash2, X } from 'lucide-react';
import { memo, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { DebugConnectionStatus } from '@/hooks/use-debug-websocket';

// ─── Color maps ────────────────────────────────────────────────────────────

const CATEGORY_BADGE: Record<DebugEventCategory, string> = {
  conductor: 'bg-primary/10 text-primary/70',
  agent: 'bg-status-purple/10 text-status-purple/70',
  memory: 'bg-status-green/10 text-status-green/70',
  websocket: 'bg-muted-foreground/5 text-muted-foreground/40',
  system: 'bg-muted-foreground/5 text-muted-foreground/40',
};

const CATEGORY_PILL_ACTIVE: Record<DebugEventCategory, string> = {
  conductor: 'bg-primary/10 text-primary/70 border border-primary/20',
  agent: 'bg-status-purple/10 text-status-purple/70 border border-status-purple/20',
  memory: 'bg-status-green/10 text-status-green/70 border border-status-green/20',
  websocket: 'bg-muted-foreground/10 text-muted-foreground/50',
  system: 'bg-muted-foreground/10 text-muted-foreground/50',
};

// Fix UI-1/UI-2: Use design system tokens (status-amber/status-red), not raw Tailwind amber-400/red-400
const LEVEL_TEXT: Record<DebugEventLevel, string> = {
  debug: 'text-muted-foreground/40',
  info: 'text-muted-foreground/70',
  warn: 'text-status-amber',
  error: 'text-status-red',
};

const LEVEL_ROW_BG: Record<DebugEventLevel, string> = {
  debug: '',
  info: '',
  warn: 'bg-status-amber/5',
  error: 'bg-status-red/5',
};

const ALL_CATEGORIES: DebugEventCategory[] = [
  'conductor',
  'agent',
  'memory',
  'websocket',
  'system',
];

// ─── Timestamp formatter ───────────────────────────────────────────────────

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    const hh = d.getHours().toString().padStart(2, '0');
    const mm = d.getMinutes().toString().padStart(2, '0');
    const ss = d.getSeconds().toString().padStart(2, '0');
    const ms = d.getMilliseconds().toString().padStart(3, '0');
    return `${hh}:${mm}:${ss}.${ms}`;
  } catch {
    return '??:??:??.???';
  }
}

// ─── Individual log entry ──────────────────────────────────────────────────

const DebugLogEntry = memo(function DebugLogEntry({ event }: { event: DebugEvent }) {
  const [expanded, setExpanded] = useState(false);
  const hasData = event.data && Object.keys(event.data).length > 0;
  // A11y-12: aria-controls link between toggle button and expanded content
  const dataId = useId();

  return (
    <div className={`px-2 py-0.5 rounded ${LEVEL_ROW_BG[event.level]}`}>
      <div className="flex items-baseline gap-1.5 min-w-0 leading-tight">
        <span className="text-[9px] font-mono text-muted-foreground/30 shrink-0 tabular-nums">
          {formatTimestamp(event.timestamp)}
        </span>
        <span
          className={`text-[9px] font-mono shrink-0 px-1 rounded ${CATEGORY_BADGE[event.category]}`}
        >
          {event.category.slice(0, 4)}
        </span>
        <span className={`text-[9px] font-mono shrink-0 ${LEVEL_TEXT[event.level]}`}>
          {event.level === 'warn'
            ? 'WRN'
            : event.level === 'error'
              ? 'ERR'
              : event.level.slice(0, 3).toUpperCase()}
        </span>
        <span className="text-[9px] font-mono text-muted-foreground/50 shrink-0 truncate max-w-[100px]">
          {event.source}
        </span>
        <span className={`text-[9px] font-mono flex-1 min-w-0 truncate ${LEVEL_TEXT[event.level]}`}>
          {event.message}
        </span>
        {event.durationMs !== undefined && (
          <span className="text-[9px] font-mono text-muted-foreground/30 shrink-0 tabular-nums">
            {event.durationMs}ms
          </span>
        )}
        {hasData && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-controls={dataId}
            aria-label="Toggle event data"
            className="shrink-0 text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors"
          >
            <ChevronDown
              className={`h-2.5 w-2.5 transition-transform duration-150 motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>
        )}
      </div>
      {hasData && (
        <pre
          id={dataId}
          hidden={!expanded}
          className="mt-0.5 ml-[9.5rem] rounded px-1.5 py-1 text-[8px] font-mono text-muted-foreground/60 overflow-x-auto max-h-32 whitespace-pre-wrap break-all"
        >
          {JSON.stringify(event.data, null, 2)}
        </pre>
      )}
    </div>
  );
});

// ─── Debounced SR-only announcer ───────────────────────────────────────────
// A11y-1: role="log" uses implicit aria-live="polite"; this announcer batches
// rapid-fire events so screen readers hear "N new events" rather than each one.

function useDebouncedEventAnnouncement(count: number): string {
  const [announcement, setAnnouncement] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevCountRef = useRef(count);

  useEffect(() => {
    const delta = count - prevCountRef.current;
    prevCountRef.current = count;
    if (delta <= 0) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setAnnouncement(`${delta} new debug event${delta !== 1 ? 's' : ''}`);
    }, 500);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [count]);

  return announcement;
}

// ─── Main DebugConsole component ───────────────────────────────────────────

export interface DebugConsoleProps {
  events: DebugEvent[];
  connectionStatus: DebugConnectionStatus;
  onClear: () => void;
  onClose: () => void;
}

export function DebugConsole({ events, connectionStatus, onClear, onClose }: DebugConsoleProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const [activeCategories, setActiveCategories] = useState<Set<DebugEventCategory>>(
    new Set(ALL_CATEGORIES),
  );

  const filteredEvents = useMemo(
    () => events.filter((e) => activeCategories.has(e.category)),
    [events, activeCategories],
  );

  const announcement = useDebouncedEventAnnouncement(filteredEvents.length);

  function toggleCategory(cat: DebugEventCategory) {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        if (next.size > 1) next.delete(cat);
        // If it's the last active, do nothing — visual feedback via opacity handles it
      } else {
        next.add(cat);
      }
      return next;
    });
  }

  // Auto-scroll to bottom when new events arrive — suppressed if user scrolled up
  // biome-ignore lint/correctness/useExhaustiveDependencies: bodyRef is a stable ref, intentional trigger on count only
  useEffect(() => {
    if (isAtBottomRef.current && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [filteredEvents.length]);

  function handleScroll() {
    if (!bodyRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = bodyRef.current;
    isAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 40;
  }

  // Fix UI-1: status-amber instead of amber-400 for connecting dot
  const statusDot =
    connectionStatus === 'connected'
      ? 'bg-status-green'
      : connectionStatus === 'connecting'
        ? 'bg-status-amber animate-pulse motion-reduce:animate-none'
        : 'bg-muted-foreground/30';

  // Fix UX-HIGH-1/2: precise empty state copy
  function emptyStateText(): string {
    if (connectionStatus === 'connecting') return 'Connecting to debug stream…';
    if (connectionStatus === 'disconnected') return 'Reconnecting…';
    if (events.length === 0) return 'Waiting for activity…';
    return 'No events match current filter.';
  }

  return (
    <div className="shrink-0 border-t border-border/40 flex flex-col bg-background/30">
      {/* Header toolbar */}
      <div className="flex items-center gap-2 px-3 py-1 border-b border-border/20 shrink-0">
        {/* Status dot — aria-hidden since sr-only span provides text equivalent */}
        <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${statusDot}`} aria-hidden="true" />
        {/* A11y-5: SR-only connection status text */}
        <span className="sr-only">Debug console: {connectionStatus}</span>
        {/* Fix UI-1: status-amber/70 instead of amber-400/70 */}
        <span className="text-[10px] font-mono font-medium text-status-amber/70 tracking-widest uppercase">
          Debug
        </span>
        {/* A11y-6: sr-only provides accessible context; visible span is decorative */}
        <span aria-hidden="true" className="text-[9px] font-mono text-muted-foreground/30">
          {filteredEvents.length}/{events.length}
        </span>
        <span className="sr-only">
          Showing {filteredEvents.length} of {events.length} events
        </span>

        {/* Category filter pills */}
        {/* biome-ignore lint/a11y/useSemanticElements: fieldset causes layout issues in flex row; role=group with aria-label provides equivalent semantics */}
        <div role="group" aria-label="Filter by category" className="flex items-center gap-1 ml-2">
          {ALL_CATEGORIES.map((cat) => {
            const isOnlyActive = activeCategories.has(cat) && activeCategories.size === 1;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => toggleCategory(cat)}
                aria-pressed={activeCategories.has(cat)}
                disabled={isOnlyActive}
                aria-label={cat}
                title={isOnlyActive ? 'At least one category must be active' : undefined}
                className={`text-[9px] font-mono px-1.5 py-0.5 rounded transition-colors ${
                  activeCategories.has(cat)
                    ? isOnlyActive
                      ? `${CATEGORY_PILL_ACTIVE[cat]} opacity-60 cursor-not-allowed`
                      : CATEGORY_PILL_ACTIVE[cat]
                    : 'text-muted-foreground/30 hover:text-muted-foreground/50'
                }`}
              >
                {cat.slice(0, 4)}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear debug events"
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-mono text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors"
          >
            <Trash2 className="h-2.5 w-2.5" aria-hidden="true" />
            clear
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close debug console"
            className="rounded p-0.5 text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors"
          >
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* A11y-1: SR announcer (debounced) — keeps role="log" implicit polite live region intact */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>

      {/* Log body — role="log" carries implicit aria-live="polite"; do NOT override with aria-live="off" */}
      <div
        ref={bodyRef}
        onScroll={handleScroll}
        className="max-h-48 overflow-y-auto py-1"
        role="log"
        aria-label="Debug event log"
      >
        {filteredEvents.length === 0 ? (
          <div className="flex items-center justify-center py-6">
            <span className="text-[10px] font-mono text-muted-foreground/30 italic">
              {emptyStateText()}
            </span>
          </div>
        ) : (
          filteredEvents.map((event) => <DebugLogEntry key={event.id} event={event} />)
        )}
      </div>
    </div>
  );
}
