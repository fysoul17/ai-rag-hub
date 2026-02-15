import { ChatInterface } from '@/components/chat/chat-interface';
import { Header } from '@/components/layout/header';
import { getAgents } from '@/lib/api-server';

export const dynamic = 'force-dynamic';

export default async function ChatPage() {
  let agents: Awaited<ReturnType<typeof getAgents>> = [];
  try {
    agents = await getAgents();
  } catch {
    agents = [];
  }

  return (
    <>
      <Header title="Chat" />
      <ChatInterface initialAgents={agents} />
    </>
  );
}
