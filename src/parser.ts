import type { Usage } from './types.js';

export function parseLogLine(entry: Record<string, unknown>): Usage | null {
  if (entry?.type !== 'assistant') return null;

  const message = entry.message as Record<string, unknown> | undefined;
  if (!message?.usage) return null;
  if (message.stop_reason === null || message.stop_reason === undefined) return null;

  const usage = message.usage as Record<string, number>;
  return {
    provider: 'claude',
    model: (message.model as string) || 'unknown',
    inputTokens: usage.input_tokens || 0,
    outputTokens: usage.output_tokens || 0,
    cacheCreationTokens: usage.cache_creation_input_tokens || 0,
    cacheReadTokens: usage.cache_read_input_tokens || 0,
    timestamp: (entry.timestamp as string) || new Date().toISOString(),
    sessionId: (entry.sessionId as string) || 'unknown',
  };
}
