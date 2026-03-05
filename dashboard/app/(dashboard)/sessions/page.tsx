import { Header } from '@/components/layout/header';
import { RuntimeFetchError } from '@/components/runtime-fetch-error';
import { SessionList } from '@/components/sessions/session-list';
import { getSessions } from '@/lib/api-server';

export const dynamic = 'force-dynamic';

export default async function SessionsPage() {
  let sessions: Awaited<ReturnType<typeof getSessions>> = {
    sessions: [],
    total: 0,
    page: 1,
    limit: 50,
  };
  let fetchError = false;
  try {
    sessions = await getSessions();
  } catch {
    fetchError = true;
  }

  return (
    <>
      <Header title="Sessions" />
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-lg font-bold">Conversation History</h2>
          <p className="text-sm text-muted-foreground">
            {sessions.total} session{sessions.total !== 1 ? 's' : ''} total
          </p>
        </div>
        {fetchError && <RuntimeFetchError />}
        <SessionList sessions={sessions.sessions} />
      </div>
    </>
  );
}
