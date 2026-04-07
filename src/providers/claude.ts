import { join } from 'node:path';
import { homedir } from 'node:os';
import type { Provider, Usage, ModelPricing } from '../types.js';

const provider: Provider = {
  name: 'claude',
  displayName: 'Claude',
  emoji: '🟣',

  defaultLogDir: join(homedir(), '.claude', 'projects'),

  models: {
    opus: { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.5, label: 'Opus' },
    sonnet: { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3, label: 'Sonnet' },
    haiku: { input: 0.8, output: 4, cacheWrite: 1, cacheRead: 0.08, label: 'Haiku' },
  },

  modelPatterns: [
    { pattern: /opus/i, key: 'opus' },
    { pattern: /sonnet/i, key: 'sonnet' },
    { pattern: /haiku/i, key: 'haiku' },
  ],

  resolveModel(modelName: string): ModelPricing {
    for (const { pattern, key } of this.modelPatterns!) {
      if (pattern.test(modelName)) return this.models[key];
    }
    return this.models['sonnet'];
  },

  getModelLabel(modelName: string): string {
    return this.resolveModel(modelName).label;
  },

  parseLogLine(entry: unknown): Usage | null {
    const e = entry as Record<string, unknown>;
    if (e?.type !== 'assistant') return null;

    const message = e.message as Record<string, unknown> | undefined;
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
      timestamp: (e.timestamp as string) || new Date().toISOString(),
      sessionId: (e.sessionId as string) || 'unknown',
    };
  },

  extractUserText(entry: unknown): string | null {
    const e = entry as Record<string, unknown>;
    if (e?.type !== 'user') return null;

    const message = e.message as Record<string, unknown> | undefined;
    const content = message?.content;
    if (typeof content === 'string') {
      const clean = content.replace(/<[^>]*>/gs, '').trim();
      return clean.length > 3 ? clean : null;
    }

    if (Array.isArray(content)) {
      for (const block of content) {
        if (block.type === 'text') {
          const clean = (block.text as string).replace(/<[^>]*>/gs, '').trim();
          if (clean.length > 3) return clean;
        }
      }
    }

    return null;
  },

  calculateCost(usage: Usage): number {
    const pricing = this.resolveModel(usage.model);
    return (usage.inputTokens / 1e6) * pricing.input
         + (usage.outputTokens / 1e6) * pricing.output
         + (usage.cacheCreationTokens / 1e6) * (pricing.cacheWrite || 0)
         + (usage.cacheReadTokens / 1e6) * (pricing.cacheRead || 0);
  },
};

export default provider;
