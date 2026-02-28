import { AgentList } from '@/components/agents/agent-list';
import { CreateAgentDialog } from '@/components/agents/create-agent-dialog';
import { Header } from '@/components/layout/header';
import { getAgents } from '@/lib/api-server';

export const dynamic = 'force-dynamic';

export default async function AgentsPage() {
  let agents: Awaited<ReturnType<typeof getAgents>> = [];
  let fetchError = false;
  try {
    agents = await getAgents();
  } catch {
    fetchError = true;
    agents = [];
  }

  return (
    <>
      <Header title="Agents" />
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Agent Fleet</h2>
            <p className="text-sm text-muted-foreground">
              {agents.length} agent{agents.length !== 1 ? 's' : ''} registered
            </p>
          </div>
          <CreateAgentDialog />
        </div>
        {fetchError && (
          <div className="mb-4 rounded-lg border border-neon-red/30 bg-neon-red/10 p-3 text-sm text-neon-red">
            Failed to load data. The runtime server may be unavailable.
          </div>
        )}
        <AgentList agents={agents} />
      </div>
    </>
  );
}
