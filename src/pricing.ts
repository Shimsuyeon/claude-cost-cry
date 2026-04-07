import { t } from './i18n.js';
import en from './locales/en.js';
import ko from './locales/ko.js';
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
    { key: 'americano', name: t('equiv.americano'), price: 3, emoji: '☕', unit: t('equiv.americano.unit') },
    { key: 'lunch', name: t('equiv.lunch'), price: 8, emoji: '🍱', unit: t('equiv.lunch.unit') },
    { key: 'tteokbokki', name: t('equiv.tteokbokki'), price: 3.5, emoji: '🍢', unit: t('equiv.tteokbokki.unit') },
    { key: 'gukbap', name: t('equiv.gukbap'), price: 5.5, emoji: '🍲', unit: t('equiv.gukbap.unit') },
    { key: 'chicken', name: t('equiv.chicken'), price: 17, emoji: '🍗', unit: t('equiv.chicken.unit') },
    { key: 'netflix', name: t('equiv.netflix'), price: 13, emoji: '📺', unit: t('equiv.netflix.unit') },
    { key: 'frappuccino', name: t('equiv.frappuccino'), price: 6, emoji: '🥤', unit: t('equiv.frappuccino.unit') },
  ];
}

const EQUIV_KEYS = ['americano', 'lunch', 'tteokbokki', 'gukbap', 'chicken', 'netflix', 'frappuccino'] as const;
const locales = [en, ko] as const;

export function resolveEquivKey(nameOrKey: string): string {
  if ((EQUIV_KEYS as readonly string[]).includes(nameOrKey)) return nameOrKey;
  for (const key of EQUIV_KEYS) {
    for (const loc of locales) {
      if (nameOrKey === loc[`equiv.${key}` as keyof typeof loc]) return key;
    }
  }
  return nameOrKey;
}

export { getEquivalents as EQUIVALENTS_FN };
