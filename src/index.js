import { existsSync } from 'node:fs';
import { calculateCost } from './calculator.js';
import { showBanner, showTodaySummary, showCostUpdate, showShutdown, showError, showInfo } from './display.js';
import { scanToday, startWatching, getClaudeProjectsDir } from './watcher.js';

export async function main() {
  showBanner();

  const claudeDir = getClaudeProjectsDir();
  if (!existsSync(claudeDir)) {
    showError(`Claude Code 로그 디렉토리를 찾을 수 없습니다: ${claudeDir}`);
    showInfo('Claude Code를 먼저 사용해야 로그가 생성됩니다.');
    process.exit(1);
  }

  showInfo('오늘의 사용량을 스캔하는 중...');

  const { usages: todayUsages, fileOffsets } = await scanToday();

  let totalCost = 0;
  let callCount = todayUsages.length;

  for (const usage of todayUsages) {
    totalCost += calculateCost(usage);
  }

  if (process.stdout.isTTY) {
    process.stdout.write('\x1B[1A\x1B[2K');
  }

  showTodaySummary(totalCost, callCount);

  // 실시간 감시 시작
  const sessionStartCost = totalCost;
  const watcher = startWatching(fileOffsets, (usage) => {
    const cost = calculateCost(usage);
    totalCost += cost;
    callCount++;
    showCostUpdate(usage, cost, totalCost);
  });

  if (!watcher) {
    showError('파일 감시를 시작할 수 없습니다.');
    process.exit(1);
  }

  const shutdown = () => {
    const sessionCost = totalCost - sessionStartCost;
    showShutdown(sessionCost);
    watcher.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
