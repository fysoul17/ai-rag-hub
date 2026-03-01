import { formatBytes } from '@pyx-memory/dashboard';
import { Card, CardContent } from '@/components/ui/card';

interface MemoryStatsCardsProps {
  stats: { totalEntries: number; vectorCount: number; storageUsedBytes: number } | null;
  isLoading: boolean;
  error: Error | null;
  graphNodeCount: number | null;
  graphEdgeCount: number | null;
}

export function MemoryStatsCards({
  stats,
  isLoading,
  error,
  graphNodeCount,
  graphEdgeCount,
}: MemoryStatsCardsProps) {
  if (isLoading && !stats) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {['total', 'vectors', 'storage', 'graph'].map((id) => (
          <Card key={id} className="glass">
            <CardContent className="py-3">
              <div className="h-4 w-16 animate-pulse rounded bg-muted" />
              <div className="mt-1 h-6 w-10 animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="rounded-lg border border-neon-red/30 bg-neon-red/10 p-3 text-sm text-neon-red">
        Failed to load stats. The runtime server may be unavailable.
      </div>
    );
  }

  if (!stats) return null;

  const cards = [
    { label: 'Entries', value: String(stats.totalEntries), glow: 'hover:glow-cyan' },
    { label: 'Vectors', value: String(stats.vectorCount), glow: 'hover:glow-purple' },
    { label: 'Storage', value: formatBytes(stats.storageUsedBytes), glow: 'hover:glow-amber' },
    {
      label: 'Graph',
      value: graphNodeCount !== null ? `${graphNodeCount}N / ${graphEdgeCount ?? 0}E` : '\u2014',
      glow: 'hover:glow-cyan',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label} className={`glass transition-all ${card.glow}`}>
          <CardContent className="py-3">
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className="font-mono text-lg font-bold">{card.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
