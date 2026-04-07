import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { t, getLocale } from './i18n.js';
import type { Config, ExchangeInfo } from './types.js';

const CACHE_DIR = join(homedir(), '.claude-cost-cry');
const CACHE_PATH = join(CACHE_DIR, 'exchange-cache.json');
const API_URL = 'https://api.frankfurter.app/latest?from=USD';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', KRW: '₩', JPY: '¥', EUR: '€', GBP: '£', CNY: '¥',
};

interface CacheData {
  rates: Record<string, number>;
  timestamp: number;
}

function loadCache(): CacheData | null {
  try {
    return JSON.parse(readFileSync(CACHE_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

function saveCache(data: CacheData): void {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(CACHE_PATH, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

async function fetchRates(): Promise<Record<string, number> | null> {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) return null;
    const data = await res.json();
    return data.rates || null;
  } catch {
    return null;
  }
}

function dateLocale(): string {
  return getLocale() === 'ko' ? 'ko-KR' : 'en-US';
}

export async function getExchangeRate(config: Config): Promise<ExchangeInfo> {
  const currency = config?.currency || 'USD';
  if (currency === 'USD') return { rate: 1, symbol: '$', currency: 'USD', source: 'base' };

  if (config?.exchangeRate) {
    return {
      rate: config.exchangeRate,
      symbol: CURRENCY_SYMBOLS[currency] || currency,
      currency,
      source: 'manual',
    };
  }

  const cache = loadCache();
  const now = Date.now();

  if (cache?.rates?.[currency] && cache.timestamp && (now - cache.timestamp < CACHE_TTL_MS)) {
    return {
      rate: cache.rates[currency],
      symbol: CURRENCY_SYMBOLS[currency] || currency,
      currency,
      source: 'cache',
      updatedAt: new Date(cache.timestamp).toLocaleDateString(dateLocale()),
    };
  }

  const rates = await fetchRates();
  if (rates && rates[currency]) {
    const cacheData: CacheData = { rates, timestamp: now };
    saveCache(cacheData);
    return {
      rate: rates[currency],
      symbol: CURRENCY_SYMBOLS[currency] || currency,
      currency,
      source: 'api',
      updatedAt: new Date(now).toLocaleDateString(dateLocale()),
    };
  }

  if (cache?.rates?.[currency]) {
    return {
      rate: cache.rates[currency],
      symbol: CURRENCY_SYMBOLS[currency] || currency,
      currency,
      source: 'stale-cache',
      updatedAt: cache.timestamp ? new Date(cache.timestamp).toLocaleDateString(dateLocale()) : t('exchange.unknown'),
    };
  }

  return { rate: 1, symbol: '$', currency: 'USD', source: 'fallback' };
}

export function formatLocalCost(usdCost: number, exchangeInfo: ExchangeInfo): string {
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

export function getCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] || currency;
}

export const SUPPORTED_CURRENCIES = Object.keys(CURRENCY_SYMBOLS);
