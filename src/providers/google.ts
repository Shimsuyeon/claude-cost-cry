import type { Provider, Usage, ModelPricing } from '../types.js';

const provider: Provider = {
  name: 'google',
  displayName: 'Gemini',
  emoji: '🔵',

  defaultLogDir: null,

  models: {
    'gemini-2.5-pro':   { input: 1.25, output: 10,   label: 'Gemini 2.5 Pro' },
    'gemini-2.5-flash': { input: 0.15, output: 0.6,  label: 'Gemini 2.5 Flash' },
    'gemini-2.0-flash': { input: 0.1,  output: 0.4,  label: 'Gemini 2.0 Flash' },
    'gemini-1.5-pro':   { input: 1.25, output: 5,    label: 'Gemini 1.5 Pro' },
    'gemini-1.5-flash': { input: 0.075, output: 0.3, label: 'Gemini 1.5 Flash' },
  },

  modelPatterns: [
    { pattern: /gemini-2\.5-pro/i,   key: 'gemini-2.5-pro' },
    { pattern: /gemini-2\.5-flash/i, key: 'gemini-2.5-flash' },
    { pattern: /gemini-2\.0-flash/i, key: 'gemini-2.0-flash' },
    { pattern: /gemini-1\.5-pro/i,   key: 'gemini-1.5-pro' },
    { pattern: /gemini-1\.5-flash/i, key: 'gemini-1.5-flash' },
    { pattern: /gemini.*pro/i,       key: 'gemini-2.5-pro' },
    { pattern: /gemini.*flash/i,     key: 'gemini-2.5-flash' },
  ],

  resolveModel(modelName: string): ModelPricing {
    for (const { pattern, key } of this.modelPatterns!) {
      if (pattern.test(modelName)) return this.models[key];
    }
    return this.models['gemini-2.5-flash'];
  },

  getModelLabel(modelName: string): string {
    return this.resolveModel(modelName).label;
  },

  parseLogLine(entry: unknown): Usage | null {
    const e = entry as Record<string, unknown>;
    const usage = (e?.usageMetadata || e?.usage) as Record<string, number> | undefined;
    if (!usage) return null;

    const model = ((e.model || e.modelVersion) as string) || 'unknown';
    if (!/gemini/i.test(model)) return null;

    return {
      provider: 'google',
      model,
      inputTokens: usage.promptTokenCount || usage.prompt_tokens || usage.input_tokens || 0,
      outputTokens: usage.candidatesTokenCount || usage.completion_tokens || usage.output_tokens || 0,
      cacheCreationTokens: 0,
      cacheReadTokens: usage.cachedContentTokenCount || 0,
      timestamp: (e.timestamp as string) || new Date().toISOString(),
      sessionId: (e.id as string) || 'unknown',
    };
  },

  extractUserText(entry: unknown): string | null {
    const e = entry as Record<string, unknown>;
    const parts = e?.contents as Array<Record<string, unknown>> | undefined;
    if (!Array.isArray(parts)) return null;
    for (let i = parts.length - 1; i >= 0; i--) {
      if (parts[i].role === 'user') {
        const p = parts[i].parts as Array<Record<string, string>> | undefined;
        if (p?.[0]?.text) return p[0].text;
      }
    }
    return null;
  },

  calculateCost(usage: Usage): number {
    const pricing = this.resolveModel(usage.model);
    return (usage.inputTokens / 1e6) * pricing.input
         + (usage.outputTokens / 1e6) * pricing.output;
  },
};

export default provider;
