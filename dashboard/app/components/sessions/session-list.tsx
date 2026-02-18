import type { Session } from '@autonomy/shared';
import { SessionCard } from './session-card';

interface SessionListProps {
  sessions: Session[];
}

export function SessionList({ sessions }: SessionListProps) {
  if (sessions.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">No sessions yet. Start a chat to create one.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sessions.map((session) => (
        <SessionCard key={session.id} session={session} />
      ))}
    </div>
  );
}
