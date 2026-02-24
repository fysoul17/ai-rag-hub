'use client';

import type { MemoryEntry } from '@autonomy/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { deleteMemoryEntry } from '@/lib/api';
import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface EntryDetailDialogProps {
  entry: MemoryEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EntryDetailDialog({ entry, open, onOpenChange }: EntryDetailDialogProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  if (!entry) return null;

  async function handleDelete() {
    if (!entry) return;
    setDeleting(true);
    try {
      await deleteMemoryEntry(entry.id);
      onOpenChange(false);
      router.refresh();
    } catch {
      // Delete failed — entry remains
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-primary/20 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary font-display tracking-wider">
            <span className="font-mono text-sm">{entry.id.slice(0, 16)}...</span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={entry.type === 'short-term' ? 'secondary' : 'default'}>
              {entry.type}
            </Badge>
            {entry.agentId && (
              <Badge variant="outline" className="font-mono">
                agent: {entry.agentId}
              </Badge>
            )}
            {entry.sessionId && (
              <Badge variant="outline" className="font-mono">
                session: {entry.sessionId.slice(0, 8)}
              </Badge>
            )}
          </div>

          <div className="rounded-md border bg-muted/50 p-4">
            <p className="whitespace-pre-wrap text-sm">{entry.content}</p>
          </div>

          {Object.keys(entry.metadata).length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Metadata</p>
              <pre className="rounded-md border bg-muted/50 p-3 font-mono text-xs">
                {JSON.stringify(entry.metadata, null, 2)}
              </pre>
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Created: {new Date(entry.createdAt).toLocaleString()}</span>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
              className="gap-1"
            >
              <Trash2 className="h-3 w-3" />
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
