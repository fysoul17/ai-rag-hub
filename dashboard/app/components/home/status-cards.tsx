import type { HealthCheckResponse, MemoryStats } from '@autonomy/shared';
import { Bot, Brain, Clock, Cpu } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatBytes, formatUptime } from '@/lib/format';
import { HealthIndicator } from './health-indicator';

interface StatusCardsProps {
  health: HealthCheckResponse;
  memoryStats: MemoryStats | null;
}

export function StatusCards({ health, memoryStats }: StatusCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* System Status */}
      <Card className="glass glass-hover transition-all">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            System
          </CardTitle>
          <Cpu className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <HealthIndicator status={health.status} />
            <span className="font-mono text-2xl font-bold capitalize text-foreground">
              {health.status}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">v{health.version}</p>
        </CardContent>
      </Card>

      {/* Uptime */}
      <Card className="glass glass-hover transition-all">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Uptime
          </CardTitle>
          <Clock className="h-4 w-4 text-neon-green" />
        </CardHeader>
        <CardContent>
          <span className="font-mono text-2xl font-bold text-foreground">
            {formatUptime(health.uptime)}
          </span>
          <p className="mt-1 text-xs text-muted-foreground">
            {health.uptime.toLocaleString()}s total
          </p>
        </CardContent>
      </Card>

      {/* Agents */}
      <Card className="glass glass-hover transition-all">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Agents
          </CardTitle>
          <Bot className="h-4 w-4 text-neon-purple" />
        </CardHeader>
        <CardContent>
          <span className="font-mono text-2xl font-bold text-foreground">{health.agentCount}</span>
          <p className="mt-1 text-xs text-muted-foreground">active processes</p>
        </CardContent>
      </Card>

      {/* Memory */}
      <Card className="glass glass-hover transition-all">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Memory
          </CardTitle>
          <Brain className="h-4 w-4 text-neon-amber" />
        </CardHeader>
        <CardContent>
          <span className="font-mono text-2xl font-bold text-foreground">
            {memoryStats ? memoryStats.totalEntries : 0}
          </span>
          <p className="mt-1 text-xs text-muted-foreground">
            {memoryStats ? formatBytes(memoryStats.storageUsedBytes) : '0 B'} stored
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
