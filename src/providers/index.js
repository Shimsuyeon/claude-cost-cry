import claude from './claude.js';
import openai from './openai.js';
import google from './google.js';
import cursor from './cursor.js';

const PROVIDERS = { claude, openai, google, cursor };

export function getProvider(name) {
  return PROVIDERS[name] || null;
}

export function getAllProviders() {
  return Object.values(PROVIDERS);
}

export function getProviderNames() {
  return Object.keys(PROVIDERS);
}

/**
 * JSONL 라인을 파싱하여 어떤 프로바이더의 응답인지 자동 감지한다.
 * 모든 프로바이더의 parseLogLine을 시도하여 첫 번째 성공한 결과를 반환.
 */
export function autoDetectAndParse(entry) {
  for (const provider of Object.values(PROVIDERS)) {
    const usage = provider.parseLogLine(entry);
    if (usage) return usage;
  }
  return null;
}

/**
 * 특정 프로바이더로 비용을 계산한다.
 */
export function calculateCost(usage) {
  const provider = PROVIDERS[usage.provider];
  if (!provider) return 0;
  return provider.calculateCost(usage);
}

/**
 * 모델 라벨을 반환한다.
 */
export function getModelLabel(usage) {
  const provider = PROVIDERS[usage.provider];
  if (!provider) return usage.model;
  return provider.getModelLabel(usage.model);
}

/**
 * 프로바이더의 이모지를 반환한다.
 */
export function getProviderEmoji(providerName) {
  return PROVIDERS[providerName]?.emoji || '⚪';
}

export function getProviderDisplayName(providerName) {
  return PROVIDERS[providerName]?.displayName || providerName;
}

export default PROVIDERS;
