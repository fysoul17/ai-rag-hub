'use client';

import type { AgentRuntimeInfo } from '@autonomy/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { updateAgent } from '@/lib/api';
import { BACKEND_DEFAULT, BACKEND_OPTIONS } from '@/lib/backend-options';
import { getErrorMessage } from '@/lib/utils';

interface EditAgentDialogProps {
  agent: AgentRuntimeInfo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditAgentDialog({ agent, open, onOpenChange }: EditAgentDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [backend, setBackend] = useState(agent.backend ?? BACKEND_DEFAULT);

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

    if (!name || !role) {
      setError('Name and role are required.');
      setLoading(false);
      return;
    }

    try {
      await updateAgent(agent.id, {
        name,
        role,
        ...(systemPrompt ? { systemPrompt } : {}),
        tools: toolsRaw
          ? toolsRaw
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
        canModifyFiles,
        canDelegateToAgents,
        persistent,
        ...(backend !== BACKEND_DEFAULT
          ? { backend: backend as 'claude' | 'codex' | 'gemini' | 'pi' }
          : {}),
      });
      toast.success(`Agent "${name}" updated`);
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      const msg = getErrorMessage(err, 'Failed to update agent');
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass border-primary/20 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-primary text-glow-cyan">Edit Agent</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Name</Label>
            <Input
              id="edit-name"
              name="name"
              defaultValue={agent.name}
              placeholder="my-agent"
              className="font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-role">Role</Label>
            <Input
              id="edit-role"
              name="role"
              defaultValue={agent.role}
              placeholder="General assistant"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-systemPrompt">System Prompt</Label>
            <Textarea
              id="edit-systemPrompt"
              name="systemPrompt"
              placeholder="You are a helpful AI agent..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-tools">Tools (comma-separated)</Label>
            <Input
              id="edit-tools"
              name="tools"
              placeholder="read, write, search"
              className="font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-backend">Backend</Label>
            <Select value={backend} onValueChange={setBackend}>
              <SelectTrigger id="edit-backend">
                <SelectValue placeholder="Default (platform)" />
              </SelectTrigger>
              <SelectContent>
                {BACKEND_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-canModifyFiles">Can modify files</Label>
              <Switch id="edit-canModifyFiles" name="canModifyFiles" />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-canDelegateToAgents">Can delegate to agents</Label>
              <Switch id="edit-canDelegateToAgents" name="canDelegateToAgents" />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-persistent">Persistent</Label>
              <Switch id="edit-persistent" name="persistent" defaultChecked={agent.persistent} />
            </div>
          </div>

          {error && <p className="text-sm text-neon-red">{error}</p>}

          <Button type="submit" className="w-full glow-cyan" disabled={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
