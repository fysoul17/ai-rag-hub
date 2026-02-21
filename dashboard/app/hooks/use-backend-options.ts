'use client';

import type { BackendConfigOption } from '@autonomy/shared';
import { useMemo } from 'react';

export interface SlashCommand {
  name: string;
  description: string;
  values?: string[];
  defaultValue?: string;
}

/** Derives slash commands from backend config options + built-in commands. */
export function useSlashCommands(options: BackendConfigOption[] = []): SlashCommand[] {
  return useMemo(() => {
    const commands: SlashCommand[] = options.map((opt) => ({
      name: opt.name,
      description: opt.description,
      values: opt.values,
      defaultValue: opt.defaultValue,
    }));

    // Built-in commands
    commands.push(
      { name: 'help', description: 'Show available slash commands' },
      { name: 'config', description: 'Show current session overrides' },
    );

    return commands;
  }, [options]);
}
