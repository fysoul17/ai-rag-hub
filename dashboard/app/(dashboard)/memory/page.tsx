import { Header } from '@/components/layout/header';
import { MemoryBrowser } from '@/components/memory/memory-browser';
import { MemoryStatsCards } from '@/components/memory/memory-stats-cards';
import { getGraphEdges, getMemoryEntries, getMemoryStats } from '@/lib/api-server';

export const dynamic = 'force-dynamic';

export default async function MemoryPage() {
  let stats = null;
  let graphStats = null;
  let entries: Awaited<ReturnType<typeof getMemoryEntries>> = {
    entries: [],
    page: 1,
    limit: 20,
    totalCount: 0,
  };
  let fetchError = false;

  try {
    let statsFailed = false;
    let entriesFailed = false;
    let graphFailed = false;

    [stats, entries, graphStats] = await Promise.all([
      getMemoryStats().catch(() => {
        statsFailed = true;
        return null;
      }),
      getMemoryEntries(1, 20).catch(() => {
        entriesFailed = true;
        return {
          entries: [] as Awaited<ReturnType<typeof getMemoryEntries>>['entries'],
          page: 1,
          limit: 20,
          totalCount: 0,
        };
      }),
      getGraphEdges()
        .then((r) => r.stats)
        .catch(() => {
          graphFailed = true;
          return null;
        }),
    ]);

    fetchError = statsFailed || entriesFailed || graphFailed;
  } catch {
    fetchError = true;
  }

  return (
    <>
      <Header title="Memory" />
      <div className="space-y-6 p-6">
        {fetchError && (
          <div className="rounded-lg border border-neon-red/30 bg-neon-red/10 p-3 text-sm text-neon-red">
            Failed to load data. The runtime server may be unavailable.
          </div>
        )}
        <MemoryStatsCards stats={stats} graphStats={graphStats} />
        <MemoryBrowser initialEntries={entries.entries} />
      </div>
    </>
  );
}
