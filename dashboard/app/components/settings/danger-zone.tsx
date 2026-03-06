'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { resetSystem } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';

const CONFIRM_TEXT = 'reset my forge';

export function DangerZone() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [purgeMemory, setPurgeMemory] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [outcome, setOutcome] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );

  const confirmed = confirmation === CONFIRM_TEXT;

  function resetDialogState() {
    setConfirmation('');
    setPurgeMemory(false);
  }

  async function handleReset() {
    setResetting(true);
    setOutcome(null);

    try {
      const res = await resetSystem({ purgeMemory });
      const message = `Reset complete. ${res.agentsRestored} seed agent(s) restored.${res.memoryPurged ? ` ${res.memoryEntriesDeleted} memory entries purged.` : ''}${res.seedFailed ? ' Warning: re-seeding failed.' : ''}`;
      setOutcome({ type: 'success', message });
      setOpen(false);
      resetDialogState();
      router.refresh();
    } catch (err) {
      setOutcome({ type: 'error', message: getErrorMessage(err, 'Reset failed') });
    } finally {
      setResetting(false);
    }
  }

  return (
    <Card className="max-w-2xl border-red-900/50">
      <CardHeader>
        <CardTitle className="text-sm text-red-400">Danger Zone</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">Reset this instance</p>
            <p className="text-xs text-muted-foreground">
              Delete all agents, sessions, chat history, and cron jobs. Seed agents will be
              re-created. This action cannot be undone.
            </p>
          </div>
          <AlertDialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v);
              if (!v) resetDialogState();
            }}
          >
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="shrink-0 border-red-900/50 text-red-400 hover:bg-red-950/50 hover:text-red-300"
              >
                Reset Instance
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset this Agent Forge instance?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all agents, sessions, and cron jobs. Default seed
                  agents will be re-created after reset.
                </AlertDialogDescription>
              </AlertDialogHeader>

              <div className="space-y-3">
                <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                  <li>All agents and their configurations</li>
                  <li>All chat sessions and message history</li>
                  <li>All cron jobs and execution logs</li>
                </ul>
                <div className="flex items-center gap-2 rounded-md bg-red-950/30 border border-red-900/50 px-3 py-2">
                  <Switch
                    id="purge-memory"
                    size="sm"
                    checked={purgeMemory}
                    onCheckedChange={setPurgeMemory}
                    className="data-[state=checked]:bg-red-500"
                  />
                  <Label htmlFor="purge-memory" className="text-xs text-red-300 cursor-pointer">
                    Also purge all memory data (vector store + graph)
                  </Label>
                </div>
                <div className="pt-2">
                  <Label htmlFor="confirm-reset" className="text-xs text-muted-foreground">
                    Type <span className="font-mono font-bold text-foreground">{CONFIRM_TEXT}</span>{' '}
                    to confirm
                  </Label>
                  <Input
                    id="confirm-reset"
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
                    placeholder={CONFIRM_TEXT}
                    className="mt-1.5 font-mono text-sm"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
              </div>

              <AlertDialogFooter>
                <AlertDialogCancel disabled={resetting}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={!confirmed || resetting}
                  onClick={(e) => {
                    e.preventDefault();
                    handleReset();
                  }}
                >
                  {resetting ? 'Resetting...' : 'I understand, reset this instance'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <div aria-live="polite">
          {outcome?.type === 'error' && <p className="text-xs text-red-400">{outcome.message}</p>}
          {outcome?.type === 'success' && (
            <p className="text-xs text-green-400">{outcome.message}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
