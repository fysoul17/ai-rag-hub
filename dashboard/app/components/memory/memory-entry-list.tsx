'use client';

import type { MemoryEntry } from '@autonomy/shared';
import { MemoryEntryCard } from './memory-entry-card';

interface MemoryEntryListProps {
  entries: MemoryEntry[];
  onSelectEntry: (entry: MemoryEntry) => void;
}

export function MemoryEntryList({ entries, onSelectEntry }: MemoryEntryListProps) {
  if (entries.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">No memory entries found.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {entries.map((entry) => (
        <MemoryEntryCard key={entry.id} entry={entry} onSelect={onSelectEntry} />
      ))}
    </div>
  );
}
