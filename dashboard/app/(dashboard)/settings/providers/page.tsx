import type { BackendStatusResponse } from '@autonomy/shared';
import { Header } from '@/components/layout/header';
import { ProviderList } from '@/components/settings/provider-list';
import { getBackendStatus } from '@/lib/api-server';

export const dynamic = 'force-dynamic';

export default async function ProvidersPage() {
  let status: BackendStatusResponse | null = null;
  try {
    status = await getBackendStatus();
  } catch {
    status = null;
  }

  return (
    <>
      <Header title="AI Providers" />
      <div className="p-6">
        <div className="mb-6">
          <p className="text-sm text-muted-foreground">
            Manage AI backend providers and see their connection status
          </p>
        </div>
        {status ? (
          <ProviderList status={status} />
        ) : (
          <div className="glass rounded-lg p-8 text-center text-muted-foreground">
            <p>Unable to connect to runtime. Check that the server is running.</p>
          </div>
        )}
      </div>
    </>
  );
}
