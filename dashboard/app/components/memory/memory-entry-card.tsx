import type { MemoryEntry } from '@autonomy/shared';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { formatRelativeTime } from '@/lib/format';
import { shortId } from '@/lib/short-id';
import { memoryTypeBadgeVariant } from './memory-utils';

interface MemoryEntryCardProps {
  entry: MemoryEntry;
  onSelect?: (entry: MemoryEntry) => void;
}

const typeGlow: Record<string, string> = {
  'short-term': 'hover:border-neon-amber/30 hover:glow-amber',
  'long-term': 'hover:border-neon-cyan/30 hover:glow-cyan',
  working: 'hover:border-neon-green/30 hover:glow-green',
  episodic: 'hover:border-neon-purple/30 hover:glow-purple',
  summary: 'hover:border-neon-red/30 hover:glow-red',
};

export function MemoryEntryCard({ entry, onSelect }: MemoryEntryCardProps) {
  const glow = typeGlow[entry.type] ?? '';

  return (
    <Card
      className={`card-hover accent-line-top cursor-pointer transition-all ${glow}`}
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
          <Badge variant={memoryTypeBadgeVariant(entry.type)}>{entry.type}</Badge>
          {entry.agentId && (
            <Badge variant="outline" className="font-mono text-[10px]">
              {shortId(entry.agentId)}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="line-clamp-3 text-sm text-foreground">{entry.content}</p>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="font-mono">{shortId(entry.id, 12)}...</span>
          <span>{formatRelativeTime(entry.createdAt)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
