import type { UsageSummary } from '@autonomy/shared';
import { Header } from '@/components/layout/header';
import { UsageDashboard } from '@/components/settings/usage-dashboard';
import { getUsageSummary } from '@/lib/api-server';

export const dynamic = 'force-dynamic';

export default async function UsagePage() {
  let dailySummary: UsageSummary[] = [];
  let monthlySummary: UsageSummary[] = [];
  let fetchError = false;

  try {
    [dailySummary, monthlySummary] = await Promise.all([
      getUsageSummary('day'),
      getUsageSummary('month'),
    ]);
  } catch {
    fetchError = true;
  }

  return (
    <>
      <Header title="Usage" />
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-lg font-bold">Usage Analytics</h2>
          <p className="text-sm text-muted-foreground">API request tracking and quota monitoring</p>
        </div>
        {fetchError && (
          <div className="mb-4 rounded-lg border border-neon-red/30 bg-neon-red/10 p-3 text-sm text-neon-red">
            Failed to load data. The runtime server may be unavailable.
          </div>
        )}
        <UsageDashboard daily={dailySummary} monthly={monthlySummary} />
      </div>
    </>
  );
}
