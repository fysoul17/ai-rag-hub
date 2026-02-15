import { Bot, User } from 'lucide-react';
import type { ChatMessage } from '@/hooks/use-websocket';

export function ChatMessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          isUser ? 'bg-primary/10' : 'bg-neon-purple/10'
        }`}
      >
        {isUser ? (
          <User className="h-4 w-4 text-primary" />
        ) : (
          <Bot className="h-4 w-4 text-neon-purple" />
        )}
      </div>
      <div className={`max-w-[80%] space-y-1 ${isUser ? 'items-end' : ''}`}>
        {!isUser && message.agentId && (
          <span className="text-[10px] font-mono text-neon-purple text-glow-purple">
            {message.agentId}
          </span>
        )}
        <div
          className={`rounded-lg px-3 py-2 text-sm ${
            isUser
              ? 'glass border-primary/20 text-foreground'
              : 'glass border-neon-purple/20 text-foreground'
          }`}
        >
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
          {message.streaming && (
            <span className="inline-block h-4 w-1 animate-pulse bg-primary ml-0.5" />
          )}
        </div>
      </div>
    </div>
  );
}
