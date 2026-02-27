import type { MemoryEntry } from '@autonomy/shared';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface MemoryEntryCardProps {
  entry: MemoryEntry;
  onSelect?: (entry: MemoryEntry) => void;
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const typeGlow: Record<string, string> = {
  'short-term': 'hover:border-neon-amber/30 hover:glow-amber',
  'long-term': 'hover:border-neon-cyan/30 hover:glow-cyan',
};

export function MemoryEntryCard({ entry, onSelect }: MemoryEntryCardProps) {
  const glow = typeGlow[entry.type] ?? '';

  return (
    <Card
      className={`glass cursor-pointer transition-all hover:scale-[1.02] ${glow}`}
      onClick={() => onSelect?.(entry)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect?.(entry);
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`Memory entry: ${entry.content.slice(0, 50)}`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Badge variant={entry.type === 'short-term' ? 'secondary' : 'default'}>
            {entry.type}
          </Badge>
          {entry.agentId && (
            <Badge variant="outline" className="font-mono text-[10px]">
              {entry.agentId.slice(0, 8)}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="line-clamp-3 text-sm text-foreground">{entry.content}</p>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="font-mono">{entry.id.slice(0, 12)}...</span>
          <span>{formatRelativeTime(entry.createdAt)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
