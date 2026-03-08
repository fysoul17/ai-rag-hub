'use client';

import type { CronEntryWithStatus } from '@autonomy/shared';
import { Plus, Trash2 } from 'lucide-react';
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
import { updateCron } from '@/lib/api';
import { COMMON_TIMEZONES, type WorkflowStep } from '@/lib/cron-options';
import { getErrorMessage } from '@/lib/utils';

interface EditCronDialogProps {
  cron: CronEntryWithStatus;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditCronDialog({ cron, open, onOpenChange }: EditCronDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timezone, setTimezone] = useState(cron.timezone);
  const [enabled, setEnabled] = useState(cron.enabled);
  const [steps, setSteps] = useState<WorkflowStep[]>(
    cron.workflow.steps.map((s, i) => ({ key: String(i), agentId: s.agentId, task: s.task })),
  );

  function addStep() {
    setSteps([...steps, { key: String(Date.now()), agentId: '', task: '' }]);
  }

  function removeStep(index: number) {
    setSteps(steps.filter((_, i) => i !== index));
  }

  function updateStep(index: number, field: keyof WorkflowStep, value: string) {
    setSteps(steps.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const name = form.get('name') as string;
    const schedule = form.get('schedule') as string;

    if (!name || !schedule) {
      setError('Name and schedule are required.');
      setLoading(false);
      return;
    }

    const validSteps = steps.filter((s) => s.agentId && s.task);
    if (validSteps.length === 0) {
      setError('At least one workflow step with agent ID and task is required.');
      setLoading(false);
      return;
    }

    try {
      await updateCron(cron.id, {
        name,
        schedule,
        timezone,
        enabled,
        workflow: {
          steps: validSteps,
          output: 'last',
        },
      });
      toast.success(`Cron job "${name}" updated`);
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      const msg = getErrorMessage(err, 'Failed to update cron job');
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
          <DialogTitle className="text-primary text-glow-cyan">Edit Cron Job</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-cron-name">Name</Label>
            <Input
              id="edit-cron-name"
              name="name"
              defaultValue={cron.name}
              placeholder="daily-report"
              className="font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-schedule">Schedule (cron expression)</Label>
            <Input
              id="edit-schedule"
              name="schedule"
              defaultValue={cron.schedule}
              placeholder="0 9 * * *"
              className="font-mono"
            />
            <p className="text-[10px] text-muted-foreground">
              e.g. &quot;0 9 * * *&quot; = every day at 9:00 AM
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-timezone">Timezone</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger id="edit-timezone">
                <SelectValue placeholder="UTC" />
              </SelectTrigger>
              <SelectContent>
                {COMMON_TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="edit-enabled">Enabled</Label>
            <Switch id="edit-enabled" checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Workflow Steps</Label>
              <Button type="button" variant="ghost" size="sm" onClick={addStep}>
                <Plus className="mr-1 h-3 w-3" />
                Add Step
              </Button>
            </div>
            {steps.map((step, index) => (
              <div key={step.key} className="flex items-start gap-2">
                <div className="flex-1 space-y-1">
                  <Input
                    placeholder="Agent ID"
                    aria-label={`Step ${index + 1} agent ID`}
                    value={step.agentId}
                    onChange={(e) => updateStep(index, 'agentId', e.target.value)}
                    className="font-mono text-xs"
                  />
                  <Input
                    placeholder="Task prompt"
                    aria-label={`Step ${index + 1} task prompt`}
                    value={step.task}
                    onChange={(e) => updateStep(index, 'task', e.target.value)}
                    className="text-xs"
                  />
                </div>
                {steps.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-neon-red"
                    onClick={() => removeStep(index)}
                    aria-label={`Remove step ${index + 1}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
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
