import { getPricing, EQUIVALENTS } from './pricing.js';

/**
 * usage 데이터로부터 비용을 계산한다 (USD).
 * 비용 = input * input_price + output * output_price
 *       + cache_creation * cache_write_price
 *       + cache_read * cache_read_price
 * 단가는 1M 토큰 기준이므로 / 1_000_000 처리.
 */
export function calculateCost(usage) {
  const pricing = getPricing(usage.model);

  const inputCost = (usage.inputTokens / 1_000_000) * pricing.input;
  const outputCost = (usage.outputTokens / 1_000_000) * pricing.output;
  const cacheWriteCost = (usage.cacheCreationTokens / 1_000_000) * pricing.cacheWrite;
  const cacheReadCost = (usage.cacheReadTokens / 1_000_000) * pricing.cacheRead;

  return inputCost + outputCost + cacheWriteCost + cacheReadCost;
}

export function formatCost(cost) {
  return `$${cost.toFixed(4)}`;
}

export function formatCostShort(cost) {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  if (cost < 1) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
}

/**
 * 비용을 가장 적절한 일상 소비 아이템으로 환산한다.
 * 0.3잔 이상일 때 해당 아이템을 사용한다.
 */
export function toEquivalent(cost) {
  if (cost < 0.01) return null;

  for (const item of EQUIVALENTS) {
    const count = cost / item.price;
    if (count >= 0.1) {
      return {
        ...item,
        count: Math.round(count * 10) / 10,
      };
    }
  }

  return {
    ...EQUIVALENTS[0],
    count: Math.round((cost / EQUIVALENTS[0].price) * 10) / 10,
  };
}

export function formatTokenCount(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
