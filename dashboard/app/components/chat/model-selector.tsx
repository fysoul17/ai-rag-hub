'use client';

import type { BackendConfigOption } from '@autonomy/shared';
import { Sparkles } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ModelSelectorProps {
  options: BackendConfigOption[];
  currentOverrides: Record<string, string>;
  onChangeOption: (name: string, value: string) => void;
}

export function ModelSelector({ options, currentOverrides, onChangeOption }: ModelSelectorProps) {
  const modelOption = options.find((o) => o.name === 'model');
  if (!modelOption?.values) return null;

  const current = currentOverrides.model ?? modelOption.defaultValue ?? modelOption.values[0];

  return (
    <Select value={current} onValueChange={(v) => onChangeOption('model', v)}>
      <SelectTrigger
        aria-label="Select model"
        className="h-6 gap-1 border-none bg-transparent px-2 text-xs font-mono shadow-none"
      >
        <Sparkles className="h-3 w-3 text-status-amber" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {modelOption.values.map((v) => (
          <SelectItem key={v} value={v} className="text-xs font-mono">
            {v}
            {v === modelOption.defaultValue && (
              <span className="ml-1.5 text-muted-foreground">(default)</span>
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
