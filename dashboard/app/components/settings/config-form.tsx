'use client';

import type { EnvironmentConfig } from '@autonomy/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { updateConfig } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';

export function ConfigForm({ config }: { config: EnvironmentConfig }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [aiBackend, setAiBackend] = useState<string>(config.AI_BACKEND);
  const [maxAgents, setMaxAgents] = useState(String(config.MAX_AGENTS));
  const [idleTimeout, setIdleTimeout] = useState(String(config.IDLE_TIMEOUT_MS));
  const [logLevel, setLogLevel] = useState<string>(config.LOG_LEVEL);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      await updateConfig({
        AI_BACKEND: aiBackend,
        MAX_AGENTS: Number(maxAgents),
        IDLE_TIMEOUT_MS: Number(idleTimeout),
        LOG_LEVEL: logLevel,
      });
      setSuccess(true);
      router.refresh();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="text-sm">Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="ai-backend" className="text-xs text-muted-foreground">
            AI Backend
          </Label>
          <Select value={aiBackend} onValueChange={setAiBackend}>
            <SelectTrigger id="ai-backend">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="claude">Claude</SelectItem>
              <SelectItem value="codex">Codex</SelectItem>
              <SelectItem value="gemini">Gemini</SelectItem>
              <SelectItem value="pi">Pi</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="max-agents" className="text-xs text-muted-foreground">
            Max Agents
          </Label>
          <Input
            id="max-agents"
            type="number"
            min={1}
            value={maxAgents}
            onChange={(e) => setMaxAgents(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="idle-timeout" className="text-xs text-muted-foreground">
            Idle Timeout (ms)
          </Label>
          <Input
            id="idle-timeout"
            type="number"
            min={0}
            value={idleTimeout}
            onChange={(e) => setIdleTimeout(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="log-level" className="text-xs text-muted-foreground">
            Log Level
          </Label>
          <Select value={logLevel} onValueChange={setLogLevel}>
            <SelectTrigger id="log-level">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="debug">Debug</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="warn">Warn</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}
        {success && <p className="text-xs text-green-400">Configuration saved successfully</p>}

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? 'Saving...' : 'Save Configuration'}
        </Button>
      </CardContent>
    </Card>
  );
}
