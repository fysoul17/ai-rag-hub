'use client';

import type { CronEntry } from '@autonomy/shared';
import { MoreVertical, Pause, Play, Trash2, Zap } from 'lucide-react';
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
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { deleteCron, triggerCron, updateCron } from '@/lib/api';

export function CronCardActions({ cron }: { cron: CronEntry }) {
  const router = useRouter();
  const [showDelete, setShowDelete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleTrigger() {
    setLoading(true);
    setError('');
    try {
      await triggerCron(cron.id);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trigger');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle() {
    setLoading(true);
    setError('');
    try {
      await updateCron(cron.id, { enabled: !cron.enabled });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    setLoading(true);
    setError('');
    try {
      await deleteCron(cron.id);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setLoading(false);
      setShowDelete(false);
    }
  }

  return (
    <>
      {error && (
        <p className="absolute -bottom-5 left-0 right-0 truncate text-[10px] text-neon-red">
          {error}
        </p>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            aria-label="Cron job actions"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="glass">
          <DropdownMenuItem onClick={handleTrigger} disabled={loading}>
            <Zap className="mr-2 h-4 w-4" />
            Trigger Now
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleToggle} disabled={loading}>
            {cron.enabled ? (
              <>
                <Pause className="mr-2 h-4 w-4" />
                Disable
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Enable
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setShowDelete(true)}
            disabled={loading}
            className="text-neon-red focus:text-neon-red"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent className="glass border-neon-red/30">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Cron Job</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{cron.name}</strong>? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-neon-red hover:bg-neon-red/80">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
