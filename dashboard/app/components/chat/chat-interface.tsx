'use client';

import type { AgentRuntimeInfo } from '@autonomy/shared';
import { Bug } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useDebugMode } from '@/hooks/use-debug-mode';
import { useWebSocket } from '@/hooks/use-websocket';
import { AgentSelector } from './agent-selector';
import { ChatInput } from './chat-input';
import { ChatMessageBubble } from './chat-message';

const RUNTIME_URL = process.env.NEXT_PUBLIC_RUNTIME_URL ?? 'http://localhost:7820';
const WS_URL = `${RUNTIME_URL.replace(/^http/, 'ws')}/ws/chat`;

interface ChatInterfaceProps {
  initialAgents: AgentRuntimeInfo[];
}

export function ChatInterface({ initialAgents }: ChatInterfaceProps) {
  const [agents, setAgents] = useState<AgentRuntimeInfo[]>(initialAgents);
  const [targetAgent, setTargetAgent] = useState<string | undefined>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { debugMode, toggleDebug } = useDebugMode();

  const handleAgentStatus = useCallback((newAgents: AgentRuntimeInfo[]) => {
    setAgents(newAgents);
  }, []);

  const { status, messages, sendMessage } = useWebSocket({
    url: WS_URL,
    onAgentStatus: handleAgentStatus,
  });

  // Auto-scroll to bottom on new messages
  const messageCount = messages.length;
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional trigger on message count change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messageCount]);

  const handleSend = useCallback(
    (content: string) => {
      sendMessage(content, targetAgent);
    },
    [sendMessage, targetAgent],
  );

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col">
      {/* Agent selector */}
      <AgentSelector agents={agents} selected={targetAgent} onSelect={setTargetAgent} />

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="text-lg font-medium text-muted-foreground">
                {targetAgent
                  ? `Chat with ${agents.find((a) => a.id === targetAgent)?.name ?? 'agent'}`
                  : 'Chat with Conductor'}
              </p>
              <p className="text-sm text-muted-foreground/60">Send a message to get started.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <ChatMessageBubble key={msg.id} message={msg} debugMode={debugMode} />
            ))}
          </div>
        )}
      </div>

      {/* Connection status + debug toggle */}
      <div className="flex items-center gap-2 border-t border-border/50 px-4 py-1">
        <span
          className={`h-2 w-2 rounded-full animate-pulse-glow ${
            status === 'connected'
              ? 'bg-neon-cyan'
              : status === 'connecting'
                ? 'bg-neon-amber'
                : 'bg-neon-red'
          }`}
        />
        <span className="text-[10px] text-muted-foreground capitalize">{status}</span>

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={toggleDebug}
            aria-pressed={debugMode}
            aria-label="Toggle debug mode"
            className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-mono transition-colors ${
              debugMode
                ? 'bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30'
                : 'text-muted-foreground/50 hover:text-muted-foreground/70'
            }`}
            title="Toggle debug mode (Ctrl+Shift+D)"
          >
            <Bug className="h-3 w-3" />
            Debug
          </button>
        </div>
      </div>

      {/* Input */}
      <ChatInput onSend={handleSend} status={status} />
    </div>
  );
}
