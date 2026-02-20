'use client';

import type { BackendStatus } from '@autonomy/shared';
import { ChevronDown, ChevronUp, Key } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { updateBackendApiKey } from '@/lib/api';
import { ClaudeLoginTerminal } from './claude-login-terminal';

interface AuthActionsProps {
  backend: BackendStatus;
  onAuthChange: () => void;
}

function ApiKeyInput({
  value,
  onChange,
  onSave,
  saving,
}: {
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div className="flex gap-2">
      <Input
        type="password"
        placeholder="sk-ant-..."
        aria-label="Anthropic API key"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 text-xs"
        onKeyDown={(e) => e.key === 'Enter' && onSave()}
      />
      <Button size="sm" className="h-8 text-xs" disabled={saving || !value.trim()} onClick={onSave}>
        {saving ? 'Saving...' : 'Save'}
      </Button>
    </div>
  );
}

function useApiKeyActions(onAuthChange: () => void) {
  const [showForm, setShowForm] = useState(false);
  const [apiKeyValue, setApiKeyValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!apiKeyValue.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await updateBackendApiKey(apiKeyValue.trim());
      setApiKeyValue('');
      setShowForm(false);
      onAuthChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update API key');
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    setSaving(true);
    setError(null);
    try {
      await updateBackendApiKey(null);
      onAuthChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear API key');
    } finally {
      setSaving(false);
    }
  }

  return {
    showForm,
    setShowForm,
    apiKeyValue,
    setApiKeyValue,
    saving,
    error,
    handleSave,
    handleClear,
  };
}

function ApiKeyModeActions({ onAuthChange }: { onAuthChange: () => void }) {
  const {
    showForm,
    setShowForm,
    apiKeyValue,
    setApiKeyValue,
    saving,
    error,
    handleSave,
    handleClear,
  } = useApiKeyActions(onAuthChange);
  const [confirmClear, setConfirmClear] = useState(false);

  return (
    <div className="space-y-2 border-t border-border/50 pt-3">
      {error && (
        <div className="text-xs text-red-400" role="alert">
          {error}
        </div>
      )}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 text-xs"
          disabled={saving}
          aria-expanded={showForm}
          onClick={() => setShowForm(!showForm)}
        >
          <Key className="mr-1 h-3 w-3" />
          Change Key
        </Button>
        {!confirmClear ? (
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs text-red-400 hover:text-red-300"
            disabled={saving}
            onClick={() => setConfirmClear(true)}
          >
            Clear Key
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs text-red-400 hover:text-red-300 border-red-500/30"
            disabled={saving}
            onClick={() => {
              handleClear();
              setConfirmClear(false);
            }}
            onBlur={() => setConfirmClear(false)}
          >
            {saving ? 'Clearing...' : 'Confirm Clear'}
          </Button>
        )}
      </div>
      {showForm && (
        <ApiKeyInput
          value={apiKeyValue}
          onChange={setApiKeyValue}
          onSave={handleSave}
          saving={saving}
        />
      )}
    </div>
  );
}

function CliLoginModeActions({ onAuthChange }: { onAuthChange: () => void }) {
  const { showForm, setShowForm, apiKeyValue, setApiKeyValue, saving, error, handleSave } =
    useApiKeyActions(onAuthChange);

  return (
    <div className="space-y-2 border-t border-border/50 pt-3">
      {error && (
        <div className="text-xs text-red-400" role="alert">
          {error}
        </div>
      )}
      <ClaudeLoginTerminal isAuthenticated onComplete={onAuthChange} />
      <button
        type="button"
        className="flex w-full items-center justify-between text-xs text-muted-foreground hover:text-foreground/70 transition-colors"
        aria-expanded={showForm}
        onClick={() => setShowForm(!showForm)}
      >
        <span>Or use API key instead</span>
        {showForm ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {showForm && (
        <ApiKeyInput
          value={apiKeyValue}
          onChange={setApiKeyValue}
          onSave={handleSave}
          saving={saving}
        />
      )}
    </div>
  );
}

function NoAuthModeActions({ onAuthChange }: { onAuthChange: () => void }) {
  const { apiKeyValue, setApiKeyValue, saving, error, handleSave } = useApiKeyActions(onAuthChange);

  return (
    <div className="space-y-2 border-t border-border/50 pt-3">
      {error && (
        <div className="text-xs text-red-400" role="alert">
          {error}
        </div>
      )}
      <ClaudeLoginTerminal onComplete={onAuthChange} />
      <div className="text-xs text-muted-foreground">Or set an API key:</div>
      <ApiKeyInput
        value={apiKeyValue}
        onChange={setApiKeyValue}
        onSave={handleSave}
        saving={saving}
      />
    </div>
  );
}

export function AuthActions({ backend, onAuthChange }: AuthActionsProps) {
  if (backend.authMode === 'api_key') {
    return <ApiKeyModeActions onAuthChange={onAuthChange} />;
  }
  if (backend.authMode === 'cli_login') {
    return <CliLoginModeActions onAuthChange={onAuthChange} />;
  }
  return <NoAuthModeActions onAuthChange={onAuthChange} />;
}
