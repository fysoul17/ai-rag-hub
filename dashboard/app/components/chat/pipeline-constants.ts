export interface PhaseConfig {
  dot: string;
  text: string;
  label: string;
  friendlyLabel: string;
}

const PHASE_CONFIG: Record<string, PhaseConfig> = {
  memory_search: {
    dot: 'bg-status-purple',
    text: 'text-status-purple',
    label: 'Memory Search',
    friendlyLabel: 'Searching memory...',
  },
  context_inject: {
    dot: 'bg-status-purple',
    text: 'text-status-purple',
    label: 'Context',
    friendlyLabel: 'Loading history...',
  },
  analyzing: {
    dot: 'bg-status-purple',
    text: 'text-status-purple',
    label: 'Routing',
    friendlyLabel: 'Analyzing...',
  },
  routing_complete: {
    dot: 'bg-status-purple',
    text: 'text-status-purple',
    label: 'Route Decided',
    friendlyLabel: 'Route decided',
  },
  creating_agent: {
    dot: 'bg-status-green',
    text: 'text-status-green',
    label: 'Agent Creation',
    friendlyLabel: 'Creating agent...',
  },
  delegating: {
    dot: 'bg-status-amber',
    text: 'text-status-amber',
    label: 'Delegation',
    friendlyLabel: 'Delegating...',
  },
  delegation_complete: {
    dot: 'bg-status-amber',
    text: 'text-status-amber',
    label: 'Complete',
    friendlyLabel: 'Complete',
  },
  memory_store: {
    dot: 'bg-status-green',
    text: 'text-status-green',
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
