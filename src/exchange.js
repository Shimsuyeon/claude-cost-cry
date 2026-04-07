import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CACHE_DIR = join(homedir(), '.claude-cost-cry');
const CACHE_PATH = join(CACHE_DIR, 'exchange-cache.json');
const API_URL = 'https://api.frankfurter.app/latest?from=USD';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24시간

const CURRENCY_SYMBOLS = {
  USD: '$',
  KRW: '₩',
  JPY: '¥',
  EUR: '€',
  GBP: '£',
  CNY: '¥',
};

function loadCache() {
  try {
    return JSON.parse(readFileSync(CACHE_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

function saveCache(data) {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(CACHE_PATH, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

async function fetchRates() {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) return null;
    const data = await res.json();
    return data.rates || null;
  } catch {
    return null;
  }
}

/**
 * 환율을 가져온다 (캐시 우선, 만료 시 API 조회).
 * config.exchangeRate가 있으면 수동 오버라이드.
 */
export async function getExchangeRate(config) {
  const currency = config?.currency || 'USD';
  if (currency === 'USD') return { rate: 1, symbol: '$', currency: 'USD', source: 'base' };

  // 수동 오버라이드
  if (config?.exchangeRate) {
    return {
      rate: config.exchangeRate,
      symbol: CURRENCY_SYMBOLS[currency] || currency,
      currency,
      source: 'manual',
    };
  }

  // 캐시 확인
  const cache = loadCache();
  const now = Date.now();

  if (cache?.rates?.[currency] && cache.timestamp && (now - cache.timestamp < CACHE_TTL_MS)) {
    return {
      rate: cache.rates[currency],
      symbol: CURRENCY_SYMBOLS[currency] || currency,
      currency,
      source: 'cache',
      updatedAt: new Date(cache.timestamp).toLocaleDateString('ko-KR'),
    };
  }

  // API 조회
  const rates = await fetchRates();
  if (rates && rates[currency]) {
    const cacheData = { rates, timestamp: now };
    saveCache(cacheData);
    return {
      rate: rates[currency],
      symbol: CURRENCY_SYMBOLS[currency] || currency,
      currency,
      source: 'api',
      updatedAt: new Date(now).toLocaleDateString('ko-KR'),
    };
  }

  // API 실패 → 만료된 캐시라도 사용
  if (cache?.rates?.[currency]) {
    return {
      rate: cache.rates[currency],
      symbol: CURRENCY_SYMBOLS[currency] || currency,
      currency,
      source: 'stale-cache',
      updatedAt: cache.timestamp ? new Date(cache.timestamp).toLocaleDateString('ko-KR') : '알 수 없음',
    };
  }

  // 아무것도 없으면 USD 폴백
  return { rate: 1, symbol: '$', currency: 'USD', source: 'fallback' };
}

/**
 * USD 금액을 현지 통화로 변환하여 포맷한다.
 */
export function formatLocalCost(usdCost, exchangeInfo) {
  if (!exchangeInfo || exchangeInfo.currency === 'USD') {
    if (usdCost < 0.01) return `$${usdCost.toFixed(4)}`;
    if (usdCost < 1) return `$${usdCost.toFixed(3)}`;
    return `$${usdCost.toFixed(2)}`;
  }

  const local = usdCost * exchangeInfo.rate;
  const sym = exchangeInfo.symbol;

  if (exchangeInfo.currency === 'KRW' || exchangeInfo.currency === 'JPY') {
    return `${sym}${Math.round(local).toLocaleString()}`;
  }

  return `${sym}${local.toFixed(2)}`;
}

export function getCurrencySymbol(currency) {
  return CURRENCY_SYMBOLS[currency] || currency;
}

export const SUPPORTED_CURRENCIES = Object.keys(CURRENCY_SYMBOLS);
