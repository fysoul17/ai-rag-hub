import { Header } from '@/components/layout/header';
import { ConfigForm } from '@/components/settings/config-form';
import { DangerZone } from '@/components/settings/danger-zone';
import { getRuntimeConfig } from '@/lib/api-server';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  let config = null;
  try {
    config = await getRuntimeConfig();
  } catch {
    config = null;
  }

  return (
    <>
      <Header title="Settings" />
      <div className="p-6 space-y-10">
        <div>
          <div className="mb-6">
            <h2 className="text-lg font-bold">Runtime Configuration</h2>
            <p className="text-sm text-muted-foreground">
              Manage runtime settings for this Agent Forge instance
            </p>
          </div>
          {config ? (
            <ConfigForm config={config} />
          ) : (
            <div className="rounded-none p-6 text-center text-muted-foreground">
              Unable to load configuration. Is the runtime running?
            </div>
          )}
        </div>

        <DangerZone />
      </div>
    </>
  );
}
