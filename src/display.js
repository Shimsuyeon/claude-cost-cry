import chalk from 'chalk';
import { formatCostShort, formatTokenCount, toEquivalent } from './calculator.js';
import { getMessage, getStartupMood } from './messages.js';
import { getModelLabel } from './pricing.js';

const VERSION = '0.1.0';

const DIVIDER = chalk.gray('─'.repeat(56));

export function showBanner() {
  console.log();
  console.log(chalk.bold(`  🪙 claude-cost-cry v${VERSION}`));
  console.log(chalk.gray('  당신의 API 비용을 감정적으로 체감시켜드립니다'));
  console.log();
}

export function showTodaySummary(totalCost, callCount) {
  const mood = getStartupMood(totalCost);
  const equiv = toEquivalent(totalCost);
  const equivText = equiv
    ? chalk.gray(` (${equiv.emoji} ${equiv.name} ${equiv.count}잔)`)
    : '';

  console.log(
    `  📊 오늘 누적: ${chalk.bold.yellow(formatCostShort(totalCost))}${equivText}`
  );
  if (callCount > 0) {
    console.log(chalk.gray(`     API 호출 ${callCount}건`));
  }
  console.log(chalk.gray(`     ${mood}`));
  console.log();
  console.log(DIVIDER);
  console.log(chalk.gray('  감시 중... (Ctrl+C로 종료)'));
  console.log(DIVIDER);
  console.log();
}

export function showCostUpdate(usage, cost, totalCost) {
  const now = new Date();
  const timeStr = chalk.gray(
    `[${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}]`
  );

  const modelLabel = getModelLabel(usage.model);
  const modelColor = modelLabel === 'Opus' ? chalk.magenta : modelLabel === 'Haiku' ? chalk.green : chalk.blue;
  const modelStr = modelColor(modelLabel);

  const totalInputTokens = usage.inputTokens + usage.cacheCreationTokens + usage.cacheReadTokens;
  const tokenInfo = chalk.gray(
    `📥 ${formatTokenCount(totalInputTokens)} 📤 ${formatTokenCount(usage.outputTokens)}`
  );

  const { emoji, message } = getMessage(totalCost);

  const costDelta = cost >= 0.01
    ? chalk.red(`+${formatCostShort(cost)}`)
    : chalk.yellow(`+${formatCostShort(cost)}`);

  const totalStr = chalk.bold.yellow(formatCostShort(totalCost));

  const equiv = toEquivalent(totalCost);
  const equivStr = equiv
    ? chalk.gray(` ${equiv.emoji} ${equiv.count}잔`)
    : '';

  console.log(`  ${timeStr} ${modelStr}  ${tokenInfo}`);
  console.log(`  ${emoji} ${costDelta}  →  누적: ${totalStr}${equivStr}`);
  console.log(chalk.italic.gray(`     "${message}"`));
  console.log();
}

export function showShutdown(totalCost) {
  console.log();
  console.log(DIVIDER);

  const equiv = toEquivalent(totalCost);
  const equivText = equiv
    ? ` (${equiv.emoji} ${equiv.name} ${equiv.count}잔)`
    : '';

  console.log(`  📋 이번 세션 총 비용: ${chalk.bold.yellow(formatCostShort(totalCost))}${equivText}`);
  console.log(chalk.gray('  다음에 또 울러 오세요... 👋'));
  console.log(DIVIDER);
  console.log();
}

export function showError(message) {
  console.error(chalk.red(`  ❌ ${message}`));
}

export function showInfo(message) {
  console.log(chalk.gray(`  ℹ️  ${message}`));
}
