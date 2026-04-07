import { getPricing, EQUIVALENTS } from './pricing.js';
import { calculateCost as providerCalculateCost, getProvider } from './providers/index.js';

/**
 * usage 데이터로부터 비용을 계산한다 (USD).
 * provider가 있으면 프로바이더 시스템 사용, 없으면 레거시 호환.
 */
export function calculateCost(usage) {
  if (usage.provider) {
    return providerCalculateCost(usage);
  }

  const pricing = getPricing(usage.model);
  return (usage.inputTokens / 1e6) * pricing.input
       + (usage.outputTokens / 1e6) * pricing.output
       + (usage.cacheCreationTokens / 1e6) * pricing.cacheWrite
       + (usage.cacheReadTokens / 1e6) * pricing.cacheRead;
}

export function formatCost(cost) {
  return `$${cost.toFixed(4)}`;
}

export function formatCostShort(cost) {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  if (cost < 1) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
}

export function getAllEquivalents(config) {
  const custom = config?.customEquivalents || [];
  return [...custom, ...EQUIVALENTS];
}

export function toEquivalent(cost, config) {
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

export function formatTokenCount(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/**
 * 같은 프로바이더 내에서 다른 모델을 썼을 때의 비용을 계산한다.
 */
export function getSavingsNudge(usage, actualCost) {
  const provider = usage.provider ? getProvider(usage.provider) : null;
  if (!provider) return null;

  const models = provider.models;
  const currentLabel = provider.getModelLabel(usage.model).toLowerCase();

  let bestSaving = null;

  for (const [key, pricing] of Object.entries(models)) {
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
