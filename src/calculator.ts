import { getPricing, EQUIVALENTS } from './pricing.js';
import { calculateCost as providerCalculateCost, getProvider } from './providers/index.js';
import type { Usage, Config, EquivalentResult, SavingsNudge } from './types.js';

export function calculateCost(usage: Usage): number {
  if (usage.provider) {
    return providerCalculateCost(usage);
  }

  const pricing = getPricing(usage.model);
  return (usage.inputTokens / 1e6) * pricing.input
       + (usage.outputTokens / 1e6) * pricing.output
       + (usage.cacheCreationTokens / 1e6) * (pricing.cacheWrite || 0)
       + (usage.cacheReadTokens / 1e6) * (pricing.cacheRead || 0);
}

export function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}

export function formatCostShort(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  if (cost < 1) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
}

export function getAllEquivalents(config: Config) {
  const custom = config?.customEquivalents || [];
  return [...custom, ...EQUIVALENTS];
}

export function toEquivalent(cost: number, config: Config): EquivalentResult | null {
  if (cost < 0.01) return null;

  const allItems = getAllEquivalents(config);
  const unit = config?.equivalentUnit || 'auto';

  if (unit !== 'auto') {
    const fixed = allItems.find(i => i.name === unit);
    if (fixed) {
      return { ...fixed, count: Math.round((cost / fixed.price) * 10) / 10 };
    }
  }

  for (const item of allItems) {
    const count = cost / item.price;
    if (count >= 0.1) {
      return { ...item, count: Math.round(count * 10) / 10 };
    }
  }

  return { ...allItems[0], count: Math.round((cost / allItems[0].price) * 10) / 10 };
}

export function formatTokenCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function getSavingsNudge(usage: Usage, actualCost: number): SavingsNudge | null {
  const provider = usage.provider ? getProvider(usage.provider) : null;
  if (!provider) return null;

  const models = provider.models;
  const currentLabel = provider.getModelLabel(usage.model).toLowerCase();

  let bestSaving: SavingsNudge | null = null;

  for (const [, pricing] of Object.entries(models)) {
    if (pricing.label.toLowerCase() === currentLabel) continue;

    const totalInput = usage.inputTokens + usage.cacheCreationTokens + usage.cacheReadTokens;
    const altCost = (totalInput / 1e6) * pricing.input
                  + (usage.outputTokens / 1e6) * pricing.output;

    const saving = actualCost - altCost;
    if (saving > 0.001 && (!bestSaving || saving > bestSaving.saving)) {
      bestSaving = { model: pricing.label, cost: altCost, saving };
    }
  }

  return bestSaving;
}
