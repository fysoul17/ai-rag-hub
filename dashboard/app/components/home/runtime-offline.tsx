import { AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export function RuntimeOffline() {
  return (
    <Card className="border-status-red/30">
      <CardContent className="flex items-center gap-4 py-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-status-red/10">
          <AlertTriangle className="h-6 w-6 text-status-red" />
        </div>
        <div>
          <h3 className="font-bold text-status-red">Runtime Offline</h3>
          <p className="text-sm text-muted-foreground">
            Cannot connect to the runtime at{' '}
            <code className="font-mono text-xs">
              {process.env.RUNTIME_URL ?? 'http://localhost:7820'}
            </code>
            . Make sure the server is running.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
