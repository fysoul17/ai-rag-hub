import type { BackendProcess, BackendSpawnConfig, CLIBackend } from '@autonomy/agent-manager';
import { getErrorDetail, Logger } from '@autonomy/shared';

const logger = new Logger({ context: { source: 'session-process-pool' } });

/**
 * Manages per-session backend processes with LRU eviction.
 * Extracted from the Conductor to keep session lifecycle separate from orchestration.
 *
 * Receives a single resolved backend (primary or fallback is decided at boot by Conductor).
 */
export class SessionProcessPool {
  private processes = new Map<string, BackendProcess>();
  private configOverrides = new Map<string, Record<string, string>>();

  constructor(
    private backend: CLIBackend | undefined,
    private systemPrompt: string,
    private maxProcesses: number = 100,
  ) {}

  /**
   * Get or create a backend process for the given sessionId.
   * Accepts optional configOverrides from message metadata to set model/flags.
   * @param backendSessionId - Stored native CLI session ID for resuming sessions
   *   across process restarts (e.g., Claude --resume, Codex exec resume).
   */
  async getOrCreate(
    sessionId: string,
    configOverrides?: Record<string, string>,
    backendSessionId?: string,
  ): Promise<BackendProcess | undefined> {
    if (!this.backend) return undefined;

    this.invalidateOnConfigChange(sessionId, configOverrides);

    // Reuse alive process (LRU: delete+re-insert moves to tail)
    const existing = this.processes.get(sessionId);
    if (existing?.alive) {
      this.processes.delete(sessionId);
      this.processes.set(sessionId, existing);
      return existing;
    }

    // Remove dead entry if present
    if (existing) {
      this.processes.delete(sessionId);
      this.configOverrides.delete(sessionId);
    }

    await this.evictOldestIfNeeded();

    const spawnConfig = this.buildSpawnConfig(configOverrides, backendSessionId);
    if (configOverrides && Object.keys(configOverrides).length > 0) {
      this.configOverrides.set(sessionId, { ...configOverrides });
    }

    try {
      const proc = await this.backend.spawn(spawnConfig);
      this.processes.set(sessionId, proc);
      logger.info('Session backend spawned', {
        sessionId,
        configOverrideKeys: configOverrides ? Object.keys(configOverrides) : [],
      });
      return proc;
    } catch (error) {
      logger.error('Failed to spawn session backend', {
        sessionId,
        error: getErrorDetail(error),
      });
      return undefined;
    }
  }

  /** Get the live backend process for a session (if any). */
  getProcess(sessionId: string): BackendProcess | undefined {
    const proc = this.processes.get(sessionId);
    return proc?.alive ? proc : undefined;
  }

  /** Kill the backend process for a session so it respawns with new config on next message. */
  invalidate(sessionId: string): void {
    const proc = this.processes.get(sessionId);
    if (proc) {
      this.stopProcess(proc, sessionId, 'invalidated');
      this.processes.delete(sessionId);
      this.configOverrides.delete(sessionId);
    }
  }

  /** Stop all session processes. */
  async shutdown(): Promise<void> {
    await Promise.allSettled(
      [...this.processes.values()].map((proc) =>
        proc.stop().catch((error) => {
          logger.debug('Error stopping session backend during shutdown', {
            error: getErrorDetail(error),
          });
        }),
      ),
    );
    this.processes.clear();
    this.configOverrides.clear();
  }

  // ── Private helpers ──────────────────────────────────────────────────

  /** If config overrides changed, invalidate the existing process for this session. */
  private invalidateOnConfigChange(
    sessionId: string,
    configOverrides?: Record<string, string>,
  ): void {
    if (!configOverrides || Object.keys(configOverrides).length === 0) return;

    const lastOverrides = this.configOverrides.get(sessionId);
    const changed =
      !lastOverrides || JSON.stringify(lastOverrides) !== JSON.stringify(configOverrides);
    if (!changed) return;

    const existing = this.processes.get(sessionId);
    if (existing) {
      this.processes.delete(sessionId);
      this.stopProcess(existing, sessionId, 'config change');
    }
  }

  /** Evict least-recently-used session if at capacity. */
  private async evictOldestIfNeeded(): Promise<void> {
    if (this.processes.size < this.maxProcesses) return;

    const oldest = this.processes.keys().next().value;
    if (!oldest) return;

    const oldProc = this.processes.get(oldest);
    this.processes.delete(oldest);
    this.configOverrides.delete(oldest);
    try {
      await oldProc?.stop();
    } catch (error) {
      logger.debug('Error stopping evicted session', {
        sessionId: oldest,
        error: getErrorDetail(error),
      });
    }
  }

  /** Build spawn config with optional config overrides and session resume ID. */
  private buildSpawnConfig(
    configOverrides?: Record<string, string>,
    backendSessionId?: string,
  ): BackendSpawnConfig {
    const config: BackendSpawnConfig = {
      agentId: 'conductor',
      systemPrompt: this.systemPrompt,
      // skipPermissions: true is required because the conductor runs headlessly
      // (no interactive terminal for user to approve tool prompts).
      skipPermissions: true,
      // Pass stored native session ID so the CLI backend can --resume it.
      ...(backendSessionId ? { sessionId: backendSessionId } : {}),
    };

    if (!this.backend || !configOverrides || Object.keys(configOverrides).length === 0) {
      return config;
    }

    const backendOptions = this.backend.getConfigOptions();
    for (const [optName, optValue] of Object.entries(configOverrides)) {
      if (optName === 'model') {
        config.model = optValue;
      } else {
        const optDef = backendOptions.find((o) => o.name === optName);
        if (optDef) {
          if (!config.extraFlags) config.extraFlags = {};
          config.extraFlags[optDef.cliFlag] = optValue;
        }
      }
    }

    return config;
  }

  /** Fire-and-forget stop with error logging. */
  private stopProcess(proc: BackendProcess, sessionId: string, reason: string): void {
    proc.stop().catch((error) => {
      logger.debug(`Error stopping session for ${reason}`, {
        sessionId,
        error: getErrorDetail(error),
      });
    });
  }
}
