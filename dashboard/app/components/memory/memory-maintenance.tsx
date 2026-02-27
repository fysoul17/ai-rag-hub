'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { consolidateMemory, decayMemory, reindexMemory } from '@/lib/api';
import { useCallback, useEffect, useState } from 'react';

interface ActionResult {
  message: string;
  isError: boolean;
}

interface PendingAction {
  name: string;
  label: string;
  description: string;
}

function ActionButton({
  label,
  description,
  onClick,
  disabled,
  loading,
}: {
  label: string;
  description: string;
  onClick: () => void;
  disabled: boolean;
  loading: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={onClick}
        disabled={disabled}
        className="shrink-0"
      >
        {loading ? 'Running...' : 'Run'}
      </Button>
    </div>
  );
}

export function MemoryMaintenance() {
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  // Auto-clear result after 5 seconds
  useEffect(() => {
    if (!result) return;
    const timer = setTimeout(() => setResult(null), 5000);
    return () => clearTimeout(timer);
  }, [result]);

  const runAction = useCallback(
    async (name: string, action: () => Promise<string>) => {
      setLoading(name);
      setResult(null);
      try {
        const message = await action();
        setResult({ message, isError: false });
      } catch (err) {
        setResult({
          message: err instanceof Error ? err.message : 'Operation failed',
          isError: true,
        });
      } finally {
        setLoading(null);
      }
    },
    [],
  );

  const executeAction = useCallback(
    (action: PendingAction) => {
      setPendingAction(null);
      if (action.name === 'consolidate') {
        runAction('consolidate', async () => {
          const res = await consolidateMemory();
          return `Processed ${res.entriesProcessed} entries, merged ${res.entriesMerged}, archived ${res.entriesArchived} (${res.durationMs}ms)`;
        });
      } else if (action.name === 'decay') {
        runAction('decay', async () => {
          const res = await decayMemory();
          return `Archived ${res.archivedCount} entries below threshold`;
        });
      } else if (action.name === 'reindex') {
        runAction('reindex', async () => {
          await reindexMemory();
          return 'Vector embeddings reindexed successfully';
        });
      }
    },
    [runAction],
  );

  const anyLoading = loading !== null;

  return (
    <div className="space-y-4">
      <Card className="glass">
        <CardContent className="space-y-4 py-4">
          <ActionButton
            label="Consolidate"
            description="Merge related memories, deduplicate, and extract facts"
            onClick={() =>
              setPendingAction({
                name: 'consolidate',
                label: 'Consolidate',
                description:
                  'This will merge related memories, deduplicate entries, and extract facts. This may take a while.',
              })
            }
            disabled={anyLoading}
            loading={loading === 'consolidate'}
          />

          <div className="border-t border-border" />

          <ActionButton
            label="Run Decay"
            description="Archive old, low-importance memories below threshold"
            onClick={() =>
              setPendingAction({
                name: 'decay',
                label: 'Run Decay',
                description:
                  'This will archive old, low-importance memories below the decay threshold. Archived entries will no longer appear in searches.',
              })
            }
            disabled={anyLoading}
            loading={loading === 'decay'}
          />

          <div className="border-t border-border" />

          <ActionButton
            label="Reindex"
            description="Rebuild full-text search index for all entries"
            onClick={() =>
              setPendingAction({
                name: 'reindex',
                label: 'Reindex',
                description:
                  'This will rebuild the vector embeddings for all memory entries. This may take a while for large stores.',
              })
            }
            disabled={anyLoading}
            loading={loading === 'reindex'}
          />
        </CardContent>
      </Card>

      {result && (
        <p
          role="status"
          className={`text-xs ${result.isError ? 'text-neon-red' : 'text-neon-green'}`}
        >
          {result.message}
        </p>
      )}

      <AlertDialog open={pendingAction !== null} onOpenChange={() => setPendingAction(null)}>
        <AlertDialogContent className="glass">
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingAction?.label}</AlertDialogTitle>
            <AlertDialogDescription>{pendingAction?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => pendingAction && executeAction(pendingAction)}>
              Run
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
