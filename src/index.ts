import { calculateCost, calculateCostBreakdown, getSavingsNudge } from './calculator.js';
import { loadConfig, getBudgetStatus } from './config.js';
import { showBanner, showTodaySummary, showCostUpdate, showBudgetAlert, showShutdown, showError, showInfo } from './display.js';
import { scanToday, startWatching, getClaudeProjectsDir, buildLogSources } from './watcher.js';
import { getExchangeRate } from './exchange.js';
import { getModelLabel, getProviderEmoji, getProviderDisplayName, getProvider } from './providers/index.js';
import { t } from './i18n.js';
import type { Usage, TopRequest, BudgetStatus } from './types.js';

function truncatePrompt(text: string | null | undefined, maxLen = 30): string | null {
  if (!text) return null;
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  return clean.slice(0, maxLen - 1) + '…';
}

function recordRequest(topRequests: TopRequest[], usage: Usage, cost: number): void {
  const totalInput = usage.inputTokens + usage.cacheCreationTokens + usage.cacheReadTokens;
  const locale = (loadConfig().language || 'en') === 'ko' ? 'ko-KR' : 'en-US';
  const time = usage.timestamp
    ? new Date(usage.timestamp).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    : '';
  const breakdown = calculateCostBreakdown(usage);

  topRequests.push({
    cost,
    inputCost: breakdown.inputCost,
    outputCost: breakdown.outputCost,
    provider: usage.provider,
    providerEmoji: getProviderEmoji(usage.provider),
    model: getModelLabel(usage),
    time,
    inputTokens: totalInput,
    outputTokens: usage.outputTokens,
    prompt: truncatePrompt(usage.prompt),
  });

  topRequests.sort((a, b) => b.cost - a.cost);
  if (topRequests.length > 5) topRequests.length = 5;
}

export async function main(): Promise<void> {
  showBanner();

  const config = loadConfig();
  const sources = buildLogSources(config);

  if (sources.length === 0) {
    const claudeDir = getClaudeProjectsDir();
    showError(t('index.noLogDir', { path: claudeDir }));
    showInfo(t('index.addSource'));
    showInfo('  cost-cry config --add-source openai:/path/to/logs');
    process.exit(1);
  }

  const providerNames = [...new Set(sources.map(s => s.provider))];
  const sourceInfo = providerNames
    .map(p => `${getProviderEmoji(p)} ${getProviderDisplayName(p)}`)
    .join(' + ');
  showInfo(t('index.tracking', { sources: sourceInfo }));

  const cursorProvider = getProvider('cursor');
  if (cursorProvider?.isAvailable?.() && !providerNames.includes('cursor')) {
    showInfo(t('index.cursorHint'));
  }

  showInfo(t('index.scanning'));

  const exchange = await getExchangeRate(config);

  const { usages: todayUsages, fileOffsets } = await scanToday(config);

  let totalCost = 0;
  let callCount = todayUsages.length;
  let totalPotentialSavings = 0;
  const topRequests: TopRequest[] = [];
  const costByProvider: Record<string, number> = {};

  for (const usage of todayUsages) {
    const cost = calculateCost(usage);
    totalCost += cost;
    costByProvider[usage.provider] = (costByProvider[usage.provider] || 0) + cost;
    recordRequest(topRequests, usage, cost);
    const nudge = getSavingsNudge(usage, cost);
    if (nudge) totalPotentialSavings += nudge.saving;
  }

  if (process.stdout.isTTY) {
    process.stdout.write('\x1B[1A\x1B[2K');
  }

  const budgetStatus = getBudgetStatus(totalCost, config.dailyBudget);
  showTodaySummary(totalCost, callCount, budgetStatus, config, exchange, costByProvider);

  const sessionStartCost = totalCost;
  let lastBudgetStatus: BudgetStatus['status'] = budgetStatus.status;

  const watcher = startWatching(fileOffsets, (usage: Usage) => {
    const cost = calculateCost(usage);
    totalCost += cost;
    callCount++;
    costByProvider[usage.provider] = (costByProvider[usage.provider] || 0) + cost;

    recordRequest(topRequests, usage, cost);

    const nudge = getSavingsNudge(usage, cost);
    if (nudge) totalPotentialSavings += nudge.saving;

    showCostUpdate(usage, cost, totalCost, config, exchange);

    if (config.dailyBudget) {
      const newBudgetStatus = getBudgetStatus(totalCost, config.dailyBudget);
      if (newBudgetStatus.status !== lastBudgetStatus &&
          (newBudgetStatus.status === 'danger' || newBudgetStatus.status === 'exceeded')) {
        showBudgetAlert(newBudgetStatus, exchange);
      }
      lastBudgetStatus = newBudgetStatus.status;
    }
  }, config);

  if (!watcher) {
    showError(t('index.watchFail'));
    process.exit(1);
  }

  const shutdown = () => {
    const sessionCost = totalCost - sessionStartCost;
    showShutdown(sessionCost, totalCost, totalPotentialSavings, topRequests, config, exchange, costByProvider);
    watcher!.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
