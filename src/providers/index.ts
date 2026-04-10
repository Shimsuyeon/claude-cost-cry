import type { Provider, Usage } from '../types.js';
import claude from './claude.js';
import openai from './openai.js';
import google from './google.js';
import cursor from './cursor.js';

const PROVIDERS: Record<string, Provider> = { claude, openai, google, cursor };

export function getProvider(name: string): Provider | null {
  return PROVIDERS[name] || null;
}

export function getAllProviders(): Provider[] {
  return Object.values(PROVIDERS);
}

export function getProviderNames(): string[] {
  return Object.keys(PROVIDERS);
}

export function autoDetectAndParse(entry: unknown): Usage | null {
  for (const provider of Object.values(PROVIDERS)) {
    const usage = provider.parseLogLine(entry);
    if (usage) return usage;
  }
  return null;
}

export function calculateCost(usage: Usage): number {
  const provider = PROVIDERS[usage.provider];
  if (!provider) return 0;
  return provider.calculateCost(usage);
}

export function calculateCostBreakdown(usage: Usage): { inputCost: number; outputCost: number } {
  const provider = PROVIDERS[usage.provider];
  if (!provider) return { inputCost: 0, outputCost: 0 };
  const pricing = provider.resolveModel(usage.model);
  const inputCost = (usage.inputTokens / 1e6) * pricing.input
                  + (usage.cacheCreationTokens / 1e6) * (pricing.cacheWrite || 0)
                  + (usage.cacheReadTokens / 1e6) * (pricing.cacheRead || 0);
  const outputCost = (usage.outputTokens / 1e6) * pricing.output;
  return { inputCost, outputCost };
}

export function getModelLabel(usage: Usage): string {
  const provider = PROVIDERS[usage.provider];
  if (!provider) return usage.model;
  return provider.getModelLabel(usage.model);
}

export function getProviderEmoji(providerName: string): string {
  return PROVIDERS[providerName]?.emoji || '⚪';
}

export function getProviderDisplayName(providerName: string): string {
  return PROVIDERS[providerName]?.displayName || providerName;
}
