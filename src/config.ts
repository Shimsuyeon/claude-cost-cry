import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { Config, BudgetStatus } from './types.js';

const CONFIG_DIR = join(homedir(), '.claude-cost-cry');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');

const DEFAULTS: Config = {
  dailyBudget: null,
  monthlyBudget: null,
  currency: 'USD',
  exchangeRate: null,
  showNudge: true,
  equivalentUnit: 'auto',
  customEquivalents: [],
  logSources: [],
  language: 'en',
};

export function loadConfig(): Config {
  try {
    const raw = readFileSync(CONFIG_PATH, 'utf-8');
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveConfig(config: Config): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

export function updateConfig(updates: Partial<Config>): Config {
  const config = loadConfig();
  Object.assign(config, updates);
  saveConfig(config);
  return config;
}

export function getBudgetStatus(cost: number, budget: number | null): BudgetStatus {
  if (!budget || budget <= 0) return { ratio: 0, status: 'ok', budget: null };

  const ratio = cost / budget;

  let status: BudgetStatus['status'] = 'ok';
  if (ratio >= 1) status = 'exceeded';
  else if (ratio >= 0.9) status = 'danger';
  else if (ratio >= 0.7) status = 'warning';

  return { ratio: Math.min(ratio, 1), status, budget, remaining: Math.max(0, budget - cost) };
}
