import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_DIR = join(homedir(), '.claude-cost-cry');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');

const DEFAULTS = {
  dailyBudget: null,   // USD, null = 제한 없음
  monthlyBudget: null,
  currency: 'USD',
  exchangeRate: null,  // null = API 자동, 숫자 = 수동 고정
  showNudge: true,
  equivalentUnit: 'auto',
  customEquivalents: [],
  // 로그 소스: [{ provider: 'openai', path: '/path/to/logs' }, ...]
  // Claude Code는 자동 감지되므로 여기에 넣을 필요 없음
  logSources: [],
};

export function loadConfig() {
  try {
    const raw = readFileSync(CONFIG_PATH, 'utf-8');
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveConfig(config) {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

export function updateConfig(updates) {
  const config = loadConfig();
  Object.assign(config, updates);
  saveConfig(config);
  return config;
}

/**
 * 예산 대비 현재 비용의 상태를 반환한다.
 * ratio: 0~1 (사용 비율)
 * status: 'ok' | 'warning' | 'danger' | 'exceeded'
 */
export function getBudgetStatus(cost, budget) {
  if (!budget || budget <= 0) return { ratio: 0, status: 'ok', budget: null };

  const ratio = cost / budget;

  let status = 'ok';
  if (ratio >= 1) status = 'exceeded';
  else if (ratio >= 0.9) status = 'danger';
  else if (ratio >= 0.7) status = 'warning';

  return { ratio: Math.min(ratio, 1), status, budget, remaining: Math.max(0, budget - cost) };
}
