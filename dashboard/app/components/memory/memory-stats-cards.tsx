import type { MemoryStats } from '@autonomy/shared';
import { Card, CardContent } from '@/components/ui/card';

interface MemoryStatsCardsProps {
  stats: MemoryStats | null;
  graphStats?: { nodeCount: number; edgeCount: number } | null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MemoryStatsCards({ stats, graphStats }: MemoryStatsCardsProps) {
  if (!stats) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {['total', 'short', 'long', 'episodic'].map((id) => (
          <Card key={id}>
            <CardContent className="py-3">
              <div className="h-4 w-16 animate-pulse rounded bg-muted" />
              <div className="mt-1 h-6 w-10 animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    { label: 'Entries', value: String(stats.totalEntries) },
    { label: 'Vectors', value: String(stats.vectorCount) },
    { label: 'Storage', value: formatBytes(stats.storageUsedBytes) },
    {
      label: 'Graph',
      value: graphStats ? `${graphStats.nodeCount}N / ${graphStats.edgeCount}E` : '—',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label} className="card-hover accent-line-top transition-all">
          <CardContent className="py-3">
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className="font-mono text-lg font-bold">{card.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
