import type { ApiKey } from '@autonomy/shared';
import { Header } from '@/components/layout/header';
import { ApiKeyList } from '@/components/settings/api-key-list';
import { CreateApiKeyDialog } from '@/components/settings/create-api-key-dialog';
import { getApiKeys } from '@/lib/api-server';

export const dynamic = 'force-dynamic';

export default async function ApiKeysPage() {
  let keys: ApiKey[] = [];
  let fetchError = false;
  try {
    keys = await getApiKeys();
  } catch {
    fetchError = true;
    keys = [];
  }

  return (
    <>
      <Header title="API Keys" />
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">API Keys</h2>
            <p className="text-sm text-muted-foreground">
              {keys.length} key{keys.length !== 1 ? 's' : ''} configured
            </p>
          </div>
          <CreateApiKeyDialog />
        </div>
        {fetchError && (
          <div className="mb-4 rounded-lg border border-neon-red/30 bg-neon-red/10 p-3 text-sm text-neon-red">
            Failed to load data. The runtime server may be unavailable.
          </div>
        )}
        <ApiKeyList keys={keys} />
      </div>
    </>
  );
}
