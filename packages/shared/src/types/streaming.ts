export interface StreamEvent {
  type: 'chunk' | 'complete' | 'error' | 'tool_start' | 'tool_input' | 'tool_complete' | 'thinking';
  // chunk
  content?: string;
  // error
  error?: string;
  // tool_start / tool_input / tool_complete
  toolId?: string;
  toolName?: string;
  inputDelta?: string;
  durationMs?: number;
  // thinking (same content field as chunk)
}
