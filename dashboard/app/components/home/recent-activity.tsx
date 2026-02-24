import type { ActivityEntry } from '@autonomy/shared';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatRelativeTime } from '@/lib/format';

const typeBadgeColors: Record<string, string> = {
  message: 'bg-primary/10 text-primary border-primary/20',
  delegation: 'bg-status-purple/10 text-status-purple border-status-purple/20',
  agent_created: 'bg-status-green/10 text-status-green border-status-green/20',
  agent_deleted: 'bg-status-red/10 text-status-red border-status-red/20',
  cron_executed: 'bg-status-amber/10 text-status-amber border-status-amber/20',
  memory_stored: 'bg-primary/10 text-primary border-primary/20',
  error: 'bg-status-red/10 text-status-red border-status-red/20',
};

export function RecentActivity({ entries }: { entries: ActivityEntry[] }) {
  if (entries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
          Recent Activity
        </CardTitle>
        <Link
          href="/activity"
          className="text-xs text-primary hover:text-primary/80 transition-colors"
        >
          View all
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {entries.slice(0, 5).map((entry) => (
          <div key={entry.id} className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2 min-w-0">
              <Badge
                variant="outline"
                className={`shrink-0 text-[10px] ${typeBadgeColors[entry.type] ?? ''}`}
              >
                {entry.type}
              </Badge>
              <span className="text-sm text-foreground truncate">{entry.details}</span>
            </div>
            <span className="shrink-0 text-[10px] font-mono text-muted-foreground">
              {formatRelativeTime(entry.timestamp)}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
