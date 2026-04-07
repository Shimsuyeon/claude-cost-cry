import type { ModelPricing, ModelPattern, EquivalentItem } from './types.js';

const MODEL_PRICING: Record<string, ModelPricing> = {
  opus: { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.5, label: 'Opus' },
  sonnet: { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3, label: 'Sonnet' },
  haiku: { input: 0.8, output: 4, cacheWrite: 1, cacheRead: 0.08, label: 'Haiku' },
};

const MODEL_PATTERNS: ModelPattern[] = [
  { pattern: /opus/i, key: 'opus' },
  { pattern: /sonnet/i, key: 'sonnet' },
  { pattern: /haiku/i, key: 'haiku' },
];

export function getPricing(modelName: string): ModelPricing {
  for (const { pattern, key } of MODEL_PATTERNS) {
    if (pattern.test(modelName)) {
      return MODEL_PRICING[key];
    }
  }
  return MODEL_PRICING['sonnet'];
}

export function getModelLabel(modelName: string): string {
  return getPricing(modelName).label;
}

export const EQUIVALENTS: EquivalentItem[] = [
  { name: '아이스 아메리카노', price: 4.5, emoji: '☕', unit: '잔' },
  { name: '점심 한 끼', price: 8, emoji: '🍱', unit: '끼' },
  { name: '치킨', price: 17, emoji: '🍗', unit: '마리' },
  { name: '넷플릭스 한 달', price: 13, emoji: '📺', unit: '개월' },
  { name: '스타벅스 프라푸치노', price: 6, emoji: '🥤', unit: '잔' },
];
