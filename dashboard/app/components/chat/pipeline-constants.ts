export interface PhaseConfig {
  dot: string;
  text: string;
  label: string;
  friendlyLabel: string;
}

const PHASE_CONFIG: Record<string, PhaseConfig> = {
  memory_search: {
    dot: 'bg-neon-cyan',
    text: 'text-neon-cyan',
    label: 'Memory Search',
    friendlyLabel: 'Searching memory...',
  },
  context_inject: {
    dot: 'bg-neon-cyan',
    text: 'text-neon-cyan',
    label: 'Context',
    friendlyLabel: 'Loading history...',
  },
  analyzing: {
    dot: 'bg-neon-purple',
    text: 'text-neon-purple',
    label: 'Routing',
    friendlyLabel: 'Analyzing...',
  },
  routing_complete: {
    dot: 'bg-neon-purple',
    text: 'text-neon-purple',
    label: 'Route Decided',
    friendlyLabel: 'Route decided',
  },
  creating_agent: {
    dot: 'bg-neon-green',
    text: 'text-neon-green',
    label: 'Agent Creation',
    friendlyLabel: 'Creating agent...',
  },
  delegating: {
    dot: 'bg-neon-amber',
    text: 'text-neon-amber',
    label: 'Delegation',
    friendlyLabel: 'Delegating...',
  },
  delegation_complete: {
    dot: 'bg-neon-amber',
    text: 'text-neon-amber',
    label: 'Complete',
    friendlyLabel: 'Complete',
  },
  memory_store: {
    dot: 'bg-neon-green',
    text: 'text-neon-green',
    label: 'Memory Store',
    friendlyLabel: 'Saving to memory...',
  },
  responding: {
    dot: 'bg-foreground',
    text: 'text-foreground',
    label: 'Direct Response',
    friendlyLabel: 'Responding...',
  },
};

const DEFAULT_CONFIG: PhaseConfig = {
  dot: 'bg-muted-foreground',
  text: 'text-muted-foreground',
  label: '',
  friendlyLabel: 'Processing...',
};

export function getPhaseConfig(phase: string): PhaseConfig {
  return PHASE_CONFIG[phase] ?? { ...DEFAULT_CONFIG, label: phase, friendlyLabel: `${phase}...` };
}
