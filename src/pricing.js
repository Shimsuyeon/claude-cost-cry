// Claude API pricing per 1M tokens (USD)
// https://docs.anthropic.com/en/docs/about-claude/models
const MODEL_PRICING = {
  'opus': {
    input: 15,
    output: 75,
    cacheWrite: 18.75,  // 1.25x input
    cacheRead: 1.5,     // 0.1x input
    label: 'Opus',
  },
  'sonnet': {
    input: 3,
    output: 15,
    cacheWrite: 3.75,
    cacheRead: 0.3,
    label: 'Sonnet',
  },
  'haiku': {
    input: 0.8,
    output: 4,
    cacheWrite: 1,
    cacheRead: 0.08,
    label: 'Haiku',
  },
};

const MODEL_PATTERNS = [
  { pattern: /opus/i, key: 'opus' },
  { pattern: /sonnet/i, key: 'sonnet' },
  { pattern: /haiku/i, key: 'haiku' },
];

export function getPricing(modelName) {
  for (const { pattern, key } of MODEL_PATTERNS) {
    if (pattern.test(modelName)) {
      return MODEL_PRICING[key];
    }
  }
  // 알 수 없는 모델은 Sonnet 기준으로 계산 (가장 일반적)
  return MODEL_PRICING['sonnet'];
}

export function getModelLabel(modelName) {
  return getPricing(modelName).label;
}

// 체감 환산 아이템 (USD 기준)
export const EQUIVALENTS = [
  { name: '아이스 아메리카노', price: 4.5, emoji: '☕' },
  { name: '점심 한 끼', price: 8, emoji: '🍱' },
  { name: '치킨', price: 17, emoji: '🍗' },
  { name: '넷플릭스 한 달', price: 13, emoji: '📺' },
  { name: '스타벅스 프라푸치노', price: 6, emoji: '🥤' },
];
