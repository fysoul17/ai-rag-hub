'use client';

import type { BackendStatus } from '@autonomy/shared';
import { ChevronDown, ChevronUp, Key, LogOut } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { logoutClaudeBackend, updateBackendApiKey } from '@/lib/api';
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

/** Shown when CLI is installed and the user IS authenticated. Provides logout + switch account. */
function CliAuthenticatedActions({ onAuthChange }: { onAuthChange: () => void }) {
  const {
    showForm,
    setShowForm,
    apiKeyValue,
    setApiKeyValue,
    saving,
    error: keyError,
    handleSave,
  } = useApiKeyActions(onAuthChange);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  async function handleLogout() {
    setLoggingOut(true);
    setLogoutError(null);
    try {
      await logoutClaudeBackend();
      onAuthChange();
    } catch (err) {
      setLogoutError(err instanceof Error ? err.message : 'Logout failed');
    } finally {
      setLoggingOut(false);
    }
  }

  const displayError = logoutError ?? keyError;

  return (
    <div className="space-y-2 border-t border-border/50 pt-3">
      {displayError && (
        <div className="text-xs text-red-400" role="alert">
          {displayError}
        </div>
      )}
      <Button
        variant="outline"
        size="sm"
        className="w-full text-xs text-red-400 hover:text-red-300"
        disabled={loggingOut}
        onClick={handleLogout}
      >
        <LogOut className="mr-1 h-3 w-3" />
        {loggingOut ? 'Logging out...' : 'Logout'}
      </Button>
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

/** Shown when CLI binary is not found. Offers API key as the only option. */
function NoCliAvailableActions({ onAuthChange }: { onAuthChange: () => void }) {
  const { showForm, setShowForm, apiKeyValue, setApiKeyValue, saving, error, handleSave } =
    useApiKeyActions(onAuthChange);

  return (
    <div className="space-y-2 border-t border-border/50 pt-3">
      {error && (
        <div className="text-xs text-red-400" role="alert">
          {error}
        </div>
      )}
      <div className="text-xs text-muted-foreground">
        Claude Code CLI not found. Set an API key to use this provider.
      </div>
      <button
        type="button"
        className="flex w-full items-center justify-between text-xs text-muted-foreground hover:text-foreground/70 transition-colors"
        aria-expanded={showForm}
        onClick={() => setShowForm(!showForm)}
      >
        <span>Set API key</span>
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

/** Shown when CLI is installed but user is NOT authenticated. Prompts login. */
function CliNotAuthenticatedActions({ onAuthChange }: { onAuthChange: () => void }) {
  const { showForm, setShowForm, apiKeyValue, setApiKeyValue, saving, error, handleSave } =
    useApiKeyActions(onAuthChange);

  return (
    <div className="space-y-2 border-t border-border/50 pt-3">
      {error && (
        <div className="text-xs text-red-400" role="alert">
          {error}
        </div>
      )}
      <ClaudeLoginTerminal onComplete={onAuthChange} />
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

export function AuthActions({ backend, onAuthChange }: AuthActionsProps) {
  if (backend.authMode === 'api_key') {
    return <ApiKeyModeActions onAuthChange={onAuthChange} />;
  }
  if (backend.authMode === 'cli_login') {
    // CLI installed and actually authenticated — show logout + switch account
    return <CliAuthenticatedActions onAuthChange={onAuthChange} />;
  }
  if (!backend.available) {
    // CLI binary not found on PATH — can't use CLI login, offer API key instead
    return <NoCliAvailableActions onAuthChange={onAuthChange} />;
  }
  // CLI available but not authenticated — show login terminal
  return <CliNotAuthenticatedActions onAuthChange={onAuthChange} />;
}
