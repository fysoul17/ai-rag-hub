'use client';

import type { WSServerMessage } from '@autonomy/shared';
import { useRef } from 'react';
import type {
  ActivityFeed,
  AgentActivity,
  AgentThinking,
  AgentToolCall,
  ChatMessage,
} from './use-websocket-types.ts';

/** Maximum characters stored per tool's accumulated input before truncation. */
const MAX_INPUT_BYTES = 10_240;

interface UseAgentActivityOptions {
  /** Returns the message ID to attach activity updates to (processing placeholder or streaming message). */
  getTargetId: () => string | null;
  /** Whether the current request has been cancelled. */
  isCancelled: () => boolean;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

/**
 * Manages agent step accumulation (tool_start, tool_input, tool_complete, thinking)
 * and builds activity feeds for display in the chat UI.
 *
 * Extracted from useWebSocket to separate activity tracking concerns from WS lifecycle.
 */
export function useAgentActivity({
  getTargetId,
  isCancelled,
  setMessages,
}: UseAgentActivityOptions) {
  // Map<agentId, AgentActivity> for O(1) lookup during streaming
  const agentActivitiesRef = useRef<Map<string, AgentActivity>>(new Map());
  // Map<toolId, agentId> for routing tool_input/tool_complete to the right agent
  const toolToAgentRef = useRef<Map<string, string>>(new Map());

  function buildActivityFeed(isActive: boolean): ActivityFeed {
    const agents = Array.from(agentActivitiesRef.current.values());
    let totalDurationMs = 0;
    let totalSteps = 0;
    for (const agent of agents) {
      totalSteps += agent.toolCalls.length + agent.thinkingBlocks.length;
      for (const tc of agent.toolCalls) {
        totalDurationMs += tc.durationMs ?? 0;
      }
    }
    return { agents, totalSteps, totalDurationMs, isActive };
  }

  function flushActivityToProcessingMessage(isActive: boolean) {
    const targetId = getTargetId();
    if (!targetId) return;
    const feed = buildActivityFeed(isActive);
    setMessages((prev) => prev.map((m) => (m.id === targetId ? { ...m, activityFeed: feed } : m)));
  }

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: agent step handler processes many event types
  function handleAgentStep(parsed: WSServerMessage & { type: 'agent_step' }) {
    if (isCancelled()) return;

    switch (parsed.stepType) {
      case 'tool_start': {
        const agentId = parsed.agentId;
        const toolId = parsed.toolId;
        const toolName = parsed.toolName ?? 'unknown';
        if (!toolId) return;

        const newTool: AgentToolCall = {
          toolId,
          toolName,
          accumulatedInput: '',
          status: 'streaming',
          startedAt: Date.now(),
        };

        const existing = agentActivitiesRef.current.get(agentId);
        const newAgent: AgentActivity = existing
          ? { ...existing, toolCalls: [...existing.toolCalls, newTool] }
          : {
              agentId,
              agentName: parsed.agentName,
              toolCalls: [newTool],
              thinkingBlocks: [],
            };
        agentActivitiesRef.current.set(agentId, newAgent);
        toolToAgentRef.current.set(toolId, agentId);

        flushActivityToProcessingMessage(true);
        break;
      }

      case 'tool_input': {
        const toolId = parsed.toolId;
        if (!toolId || !parsed.inputDelta) return;
        const agentId = toolToAgentRef.current.get(toolId);
        if (!agentId) return;
        const agent = agentActivitiesRef.current.get(agentId);
        if (!agent) return;
        const tool = agent.toolCalls.find((tc) => tc.toolId === toolId);
        if (!tool) return;

        if (tool.accumulatedInput.length < MAX_INPUT_BYTES) {
          tool.accumulatedInput += parsed.inputDelta;
          if (tool.accumulatedInput.length > MAX_INPUT_BYTES) {
            tool.accumulatedInput = `${tool.accumulatedInput.slice(0, MAX_INPUT_BYTES)}\n[truncated]`;
          }
        }
        break;
      }

      case 'tool_complete': {
        const toolId = parsed.toolId;
        if (!toolId) return;
        const agentId = toolToAgentRef.current.get(toolId);
        if (!agentId) return;
        const agent = agentActivitiesRef.current.get(agentId);
        if (!agent) return;
        const toolIdx = agent.toolCalls.findIndex((tc) => tc.toolId === toolId);
        if (toolIdx === -1) return;

        const existingTool = agent.toolCalls[toolIdx];
        if (!existingTool) return;
        const newToolCalls = [...agent.toolCalls];
        newToolCalls[toolIdx] = {
          ...existingTool,
          status: 'complete',
          durationMs: parsed.durationMs,
          completedAt: Date.now(),
        };
        agentActivitiesRef.current.set(agentId, { ...agent, toolCalls: newToolCalls });
        toolToAgentRef.current.delete(toolId);

        flushActivityToProcessingMessage(true);
        break;
      }

      case 'thinking': {
        const agentId = parsed.agentId;
        const newThink: AgentThinking = {
          content: parsed.content ?? '',
          timestamp: Date.now(),
        };

        const existing = agentActivitiesRef.current.get(agentId);
        const newAgent: AgentActivity = existing
          ? { ...existing, thinkingBlocks: [...existing.thinkingBlocks, newThink] }
          : {
              agentId,
              agentName: parsed.agentName,
              toolCalls: [],
              thinkingBlocks: [newThink],
            };
        agentActivitiesRef.current.set(agentId, newAgent);

        flushActivityToProcessingMessage(true);
        break;
      }
    }
  }

  function clearActivityRefs() {
    agentActivitiesRef.current = new Map();
    toolToAgentRef.current = new Map();
  }

  function hasActivity(): boolean {
    return agentActivitiesRef.current.size > 0;
  }

  return {
    handleAgentStep,
    buildActivityFeed,
    clearActivityRefs,
    hasActivity,
  };
}
