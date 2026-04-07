import { existsSync } from 'node:fs';
import { calculateCost, getSavingsNudge } from './calculator.js';
import { loadConfig, getBudgetStatus } from './config.js';
import { showBanner, showTodaySummary, showCostUpdate, showBudgetAlert, showShutdown, showError, showInfo } from './display.js';
import { scanToday, startWatching, getClaudeProjectsDir } from './watcher.js';
import { getModelLabel } from './pricing.js';
import { getExchangeRate } from './exchange.js';

function truncatePrompt(text, maxLen = 30) {
  if (!text) return null;
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  return clean.slice(0, maxLen - 1) + '…';
}

function recordRequest(topRequests, usage, cost) {
  const totalInput = usage.inputTokens + usage.cacheCreationTokens + usage.cacheReadTokens;
  const time = usage.timestamp
    ? new Date(usage.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    : '';

  topRequests.push({
    cost,
    model: getModelLabel(usage.model),
    time,
    inputTokens: totalInput,
    outputTokens: usage.outputTokens,
    prompt: truncatePrompt(usage.prompt),
  });

  topRequests.sort((a, b) => b.cost - a.cost);
  if (topRequests.length > 3) topRequests.length = 3;
}

export async function main() {
  showBanner();

  const claudeDir = getClaudeProjectsDir();
  if (!existsSync(claudeDir)) {
    showError(`Claude Code 로그 디렉토리를 찾을 수 없습니다: ${claudeDir}`);
    showInfo('Claude Code를 먼저 사용해야 로그가 생성됩니다.');
    process.exit(1);
  }

  const config = loadConfig();

  showInfo('오늘의 사용량을 스캔하는 중...');

  const exchange = await getExchangeRate(config);

  const { usages: todayUsages, fileOffsets } = await scanToday();

  let totalCost = 0;
  let callCount = todayUsages.length;
  let totalPotentialSavings = 0;
  const topRequests = [];

  for (const usage of todayUsages) {
    const cost = calculateCost(usage);
    totalCost += cost;
    recordRequest(topRequests, usage, cost);
    const nudge = getSavingsNudge(usage, cost);
    if (nudge) totalPotentialSavings += nudge.saving;
  }

  if (process.stdout.isTTY) {
    process.stdout.write('\x1B[1A\x1B[2K');
  }

  const budgetStatus = getBudgetStatus(totalCost, config.dailyBudget);
  showTodaySummary(totalCost, callCount, budgetStatus, config, exchange);

  const sessionStartCost = totalCost;
  let lastBudgetStatus = budgetStatus.status;

  const watcher = startWatching(fileOffsets, (usage) => {
    const cost = calculateCost(usage);
    totalCost += cost;
    callCount++;

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
  });

  if (!watcher) {
    showError('파일 감시를 시작할 수 없습니다.');
    process.exit(1);
  }

  const shutdown = () => {
    const sessionCost = totalCost - sessionStartCost;
    showShutdown(sessionCost, totalCost, totalPotentialSavings, topRequests, config, exchange);
    watcher.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
