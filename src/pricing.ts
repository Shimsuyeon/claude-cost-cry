import { t } from './i18n.js';
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

export function getEquivalents(): EquivalentItem[] {
  return [
    { name: t('equiv.americano'), price: 4.5, emoji: '☕', unit: t('equiv.americano.unit') },
    { name: t('equiv.lunch'), price: 8, emoji: '🍱', unit: t('equiv.lunch.unit') },
    { name: t('equiv.chicken'), price: 17, emoji: '🍗', unit: t('equiv.chicken.unit') },
    { name: t('equiv.netflix'), price: 13, emoji: '📺', unit: t('equiv.netflix.unit') },
    { name: t('equiv.frappuccino'), price: 6, emoji: '🥤', unit: t('equiv.frappuccino.unit') },
  ];
}

export { getEquivalents as EQUIVALENTS_FN };
