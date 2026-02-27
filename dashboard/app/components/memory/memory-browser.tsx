'use client';

import type { MemoryEntry, RAGStrategy } from '@autonomy/shared';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { searchMemoryWithStrategy } from '@/lib/api';
import { useCallback, useEffect, useState } from 'react';
import { EntryDetailDialog } from './entry-detail-dialog';
import { FileUpload } from './file-upload';
import { GraphViewer } from './graph-viewer';
import { MemoryEntryList } from './memory-entry-list';
import { MemoryMaintenance } from './memory-maintenance';
import { MemorySearch } from './memory-search';

interface MemoryBrowserProps {
  initialEntries: MemoryEntry[];
}

export function MemoryBrowser({ initialEntries }: MemoryBrowserProps) {
  const [entries, setEntries] = useState<MemoryEntry[]>(initialEntries);
  const [query, setQuery] = useState('');
  const [strategy, setStrategy] = useState<string>('naive');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedEntry, setSelectedEntry] = useState<MemoryEntry | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searching, setSearching] = useState(false);

  const doSearch = useCallback(async () => {
    if (!query.trim()) {
      setEntries(initialEntries);
      return;
    }

    setSearching(true);
    try {
      const results = await searchMemoryWithStrategy(query, {
        strategy: strategy as RAGStrategy,
        type: typeFilter !== 'all' ? typeFilter : undefined,
        limit: 20,
      });
      setEntries(results.entries);
    } catch {
      // Silently handle search errors — keep current entries
    } finally {
      setSearching(false);
    }
  }, [query, strategy, typeFilter, initialEntries]);

  useEffect(() => {
    const timeout = setTimeout(doSearch, 300);
    return () => clearTimeout(timeout);
  }, [doSearch]);

  function handleSelectEntry(entry: MemoryEntry) {
    setSelectedEntry(entry);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-4">
      <MemorySearch
        query={query}
        onQueryChange={setQuery}
        strategy={strategy}
        onStrategyChange={setStrategy}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
      />

      <Tabs defaultValue="entries">
        <TabsList>
          <TabsTrigger value="entries">
            Entries {searching ? '...' : `(${entries.length})`}
          </TabsTrigger>
          <TabsTrigger value="graph">Graph</TabsTrigger>
          <TabsTrigger value="upload">Upload</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
        </TabsList>

        <TabsContent value="entries" className="mt-4">
          <MemoryEntryList entries={entries} onSelectEntry={handleSelectEntry} />
        </TabsContent>

        <TabsContent value="graph" className="mt-4">
          <GraphViewer />
        </TabsContent>

        <TabsContent value="upload" className="mt-4">
          <FileUpload />
        </TabsContent>

        <TabsContent value="maintenance" className="mt-4">
          <MemoryMaintenance />
        </TabsContent>
      </Tabs>

      <EntryDetailDialog
        entry={selectedEntry}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
