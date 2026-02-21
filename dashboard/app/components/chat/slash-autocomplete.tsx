'use client';

import type { SlashCommand } from '@/hooks/use-backend-options';

interface SlashAutocompleteProps {
  commands: SlashCommand[];
  activeIndex: number;
  onSelect: (command: SlashCommand) => void;
}

export function SlashAutocomplete({ commands, activeIndex, onSelect }: SlashAutocompleteProps) {
  if (commands.length === 0) return null;

  return (
    <div
      id="slash-command-listbox"
      role="listbox"
      className="absolute bottom-full left-0 z-50 mb-1 w-full max-h-56 overflow-y-auto rounded-md glass p-1"
    >
      {commands.map((cmd, i) => (
        <div
          key={cmd.name}
          id={`slash-option-${i}`}
          role="option"
          tabIndex={-1}
          aria-selected={i === activeIndex}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(cmd);
          }}
          className={`flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
            i === activeIndex ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted/50'
          }`}
        >
          <span className="font-mono font-medium">
            /{cmd.name}
            {cmd.values && (
              <span className="ml-1 text-muted-foreground font-normal">
                {'{'}
                {cmd.values.join('|')}
                {'}'}
              </span>
            )}
          </span>
          <span className="ml-auto truncate text-xs text-muted-foreground">{cmd.description}</span>
          {cmd.defaultValue && (
            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
              default: {cmd.defaultValue}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
