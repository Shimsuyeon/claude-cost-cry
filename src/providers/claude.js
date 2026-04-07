import { join } from 'node:path';
import { homedir } from 'node:os';

export default {
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

  resolveModel(modelName) {
    for (const { pattern, key } of this.modelPatterns) {
      if (pattern.test(modelName)) return this.models[key];
    }
    return this.models.sonnet;
  },

  getModelLabel(modelName) {
    return this.resolveModel(modelName).label;
  },

  /**
   * Claude Code JSONL 로그 라인에서 usage를 추출한다.
   * 스트리밍 중간 엔트리(stop_reason null)는 건너뛴다.
   */
  parseLogLine(entry) {
    if (entry?.type !== 'assistant') return null;

    const message = entry.message;
    if (!message?.usage) return null;
    if (message.stop_reason === null || message.stop_reason === undefined) return null;

    const usage = message.usage;
    return {
      provider: 'claude',
      model: message.model || 'unknown',
      inputTokens: usage.input_tokens || 0,
      outputTokens: usage.output_tokens || 0,
      cacheCreationTokens: usage.cache_creation_input_tokens || 0,
      cacheReadTokens: usage.cache_read_input_tokens || 0,
      timestamp: entry.timestamp || new Date().toISOString(),
      sessionId: entry.sessionId || 'unknown',
    };
  },

  extractUserText(entry) {
    if (entry?.type !== 'user') return null;

    const content = entry.message?.content;
    if (typeof content === 'string') {
      const clean = content.replace(/<[^>]*>/gs, '').trim();
      return clean.length > 3 ? clean : null;
    }

    if (Array.isArray(content)) {
      for (const block of content) {
        if (block.type === 'text') {
          const clean = block.text.replace(/<[^>]*>/gs, '').trim();
          if (clean.length > 3) return clean;
        }
      }
    }

    return null;
  },

  calculateCost(usage) {
    const pricing = this.resolveModel(usage.model);
    return (usage.inputTokens / 1e6) * pricing.input
         + (usage.outputTokens / 1e6) * pricing.output
         + (usage.cacheCreationTokens / 1e6) * pricing.cacheWrite
         + (usage.cacheReadTokens / 1e6) * pricing.cacheRead;
  },
};
