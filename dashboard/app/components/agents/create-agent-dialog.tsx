'use client';

import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { createAgent } from '@/lib/api';

export function CreateAgentDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const name = form.get('name') as string;
    const role = form.get('role') as string;
    const systemPrompt = form.get('systemPrompt') as string;
    const toolsRaw = form.get('tools') as string;
    const canModifyFiles = form.get('canModifyFiles') === 'on';
    const canDelegateToAgents = form.get('canDelegateToAgents') === 'on';
    const persistent = form.get('persistent') === 'on';

    if (!name || !role || !systemPrompt) {
      setError('Name, role, and system prompt are required.');
      setLoading(false);
      return;
    }

    try {
      await createAgent({
        name,
        role,
        systemPrompt,
        tools: toolsRaw
          ? toolsRaw
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
        canModifyFiles,
        canDelegateToAgents,
        persistent,
      });
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create agent');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 glow-cyan">
          <Plus className="h-4 w-4" />
          Create Agent
        </Button>
      </DialogTrigger>
      <DialogContent className="glass border-primary/20 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-primary text-glow-cyan">New Agent</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" placeholder="my-agent" className="font-mono" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Input id="role" name="role" placeholder="General assistant" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="systemPrompt">System Prompt</Label>
            <Textarea
              id="systemPrompt"
              name="systemPrompt"
              placeholder="You are a helpful AI agent..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tools">Tools (comma-separated)</Label>
            <Input
              id="tools"
              name="tools"
              placeholder="read, write, search"
              className="font-mono"
            />
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="canModifyFiles">Can modify files</Label>
              <Switch id="canModifyFiles" name="canModifyFiles" />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="canDelegateToAgents">Can delegate to agents</Label>
              <Switch id="canDelegateToAgents" name="canDelegateToAgents" />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="persistent">Persistent</Label>
              <Switch id="persistent" name="persistent" />
            </div>
          </div>

          {error && <p className="text-sm text-neon-red">{error}</p>}

          <Button type="submit" className="w-full glow-cyan" disabled={loading}>
            {loading ? 'Creating...' : 'Create Agent'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
