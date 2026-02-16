import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import type { PipelinePhase } from '@/hooks/use-websocket';
import { getPhaseConfig } from './pipeline-constants';

export function PipelineTimeline({ phases }: { phases: PipelinePhase[] }) {
  const [showRaw, setShowRaw] = useState(false);

  const lastPhaseWithDecisions = [...phases].reverse().find((p) => p.debug?.decisions);

  return (
    <div className="space-y-1 py-1">
      {phases.map((phase, i) => {
        const config = getPhaseConfig(phase.phase);

        return (
          <div key={`${phase.phase}-${i}`} className="flex items-start gap-2">
            {/* Timeline connector */}
            <div className="flex flex-col items-center">
              <div className={`h-2 w-2 rounded-full ${config.dot} shrink-0 mt-1`} />
              {i < phases.length - 1 && <div className="w-px h-3 bg-border/50" />}
            </div>

            {/* Phase info */}
            <div className="flex-1 min-w-0 flex items-baseline gap-2">
              <span className={`text-[10px] font-mono font-medium ${config.text} shrink-0`}>
                {config.label}
              </span>
              <span className="text-[10px] text-muted-foreground/60 truncate">{phase.message}</span>
              {phase.durationMs !== undefined && (
                <span className="text-[10px] font-mono text-muted-foreground/40 shrink-0">
                  {phase.durationMs}ms
                </span>
              )}
            </div>
          </div>
        );
      })}

      {/* Raw decisions toggle */}
      {lastPhaseWithDecisions && (
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowRaw(!showRaw)}
            aria-expanded={showRaw}
            aria-label="Toggle raw decisions"
            className="flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          >
            <ChevronDown
              className={`h-3 w-3 transition-transform ${showRaw ? 'rotate-180' : ''}`}
            />
            {showRaw ? 'Hide' : 'Show'} decisions
          </button>
          {showRaw && (
            <pre className="mt-1 glass rounded p-2 text-[9px] font-mono text-muted-foreground/70 overflow-x-auto max-h-40">
              {JSON.stringify(lastPhaseWithDecisions.debug?.decisions, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
