import { RecentActivity } from '@/components/home/recent-activity';
import { RuntimeOffline } from '@/components/home/runtime-offline';
import { StatusCards } from '@/components/home/status-cards';
import { Header } from '@/components/layout/header';
import { getActivity, getHealth, getMemoryStats } from '@/lib/api-server';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  try {
    const [health, activity, memoryStats] = await Promise.all([
      getHealth(),
      getActivity(5).catch(() => []),
      getMemoryStats().catch(() => null),
    ]);

    return (
      <>
        <Header title="Home" />
        <div className="space-y-6 p-6">
          <StatusCards health={health} memoryStats={memoryStats} />
          <RecentActivity entries={activity} />
        </div>
      </>
    );
  } catch {
    return (
      <>
        <Header title="Home" />
        <div className="p-6">
          <RuntimeOffline />
        </div>
      </>
    );
  }
}
