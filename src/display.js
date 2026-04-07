import chalk from 'chalk';
import { formatCostShort, formatTokenCount, toEquivalent, getSavingsNudge } from './calculator.js';
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

export function showTodaySummary(totalCost, callCount, budgetStatus) {
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

  if (budgetStatus?.budget) {
    console.log();
    showBudgetBar(totalCost, budgetStatus);
  }

  console.log();
  console.log(DIVIDER);
  console.log(chalk.gray('  감시 중... (Ctrl+C로 종료)'));
  console.log(DIVIDER);
  console.log();
}

export function showBudgetBar(totalCost, budgetStatus) {
  const { ratio, status, budget, remaining } = budgetStatus;
  const barWidth = 30;
  const filled = Math.round(ratio * barWidth);
  const empty = barWidth - filled;

  let barColor;
  let statusIcon;
  if (status === 'exceeded') {
    barColor = chalk.bgRed.white;
    statusIcon = '🚫';
  } else if (status === 'danger') {
    barColor = chalk.bgRedBright.black;
    statusIcon = '🔴';
  } else if (status === 'warning') {
    barColor = chalk.bgYellow.black;
    statusIcon = '🟡';
  } else {
    barColor = chalk.bgGreen.black;
    statusIcon = '🟢';
  }

  const bar = barColor('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
  const pct = Math.round(ratio * 100);

  console.log(`  ${statusIcon} 예산: ${bar} ${pct}%`);
  console.log(chalk.gray(`     ${formatCostShort(totalCost)} / ${formatCostShort(budget)} (잔여: ${formatCostShort(remaining)})`));

  if (status === 'exceeded') {
    console.log(chalk.red.bold(`     🚫 일일 예산을 초과했습니다!`));
  } else if (status === 'danger') {
    console.log(chalk.red(`     ⚠️  예산의 90%를 사용했습니다!`));
  } else if (status === 'warning') {
    console.log(chalk.yellow(`     💡 예산의 70%를 사용했습니다.`));
  }
}

export function showCostUpdate(usage, cost, totalCost, config) {
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

  // 절약 넛지
  if (config?.showNudge && cost > 0.01) {
    const nudge = getSavingsNudge(usage, cost);
    if (nudge && nudge.saving > 0.005) {
      console.log(chalk.cyan(`     💡 ${nudge.model}로 했으면 ${formatCostShort(nudge.cost)} (${formatCostShort(nudge.saving)} 절약)`));
    }
  }

  console.log();
}

export function showBudgetAlert(budgetStatus) {
  const { status } = budgetStatus;
  if (status === 'exceeded') {
    console.log(chalk.bgRed.white.bold('  🚫 일일 예산 초과! 🚫  '));
    console.log();
  } else if (status === 'danger') {
    console.log(chalk.red(`  🔴 예산 90% 도달 — 남은 예산: ${formatCostShort(budgetStatus.remaining)}`));
    console.log();
  }
}

export function showTopExpensive(topRequests) {
  if (!topRequests || topRequests.length === 0) return;

  console.log();
  console.log(`  🏆 ${chalk.bold('오늘의 가장 비싼 요청 TOP 3')}`);
  console.log();

  topRequests.forEach((req, i) => {
    const medal = ['🥇', '🥈', '🥉'][i];
    const modelColor = req.model === 'Opus' ? chalk.magenta
      : req.model === 'Haiku' ? chalk.green : chalk.blue;
    const timeStr = req.time || '';

    console.log(`  ${medal} ${chalk.bold.yellow(formatCostShort(req.cost))}  ${modelColor(req.model)}  ${chalk.gray(timeStr)}`);

    if (req.prompt) {
      console.log(chalk.white(`     💬 "${req.prompt}"`));
    }

    console.log(chalk.gray(`     📥 ${formatTokenCount(req.inputTokens)} 📤 ${formatTokenCount(req.outputTokens)}`));
  });
}

export function showShutdown(sessionCost, totalCost, savingsTotal, topRequests) {
  console.log();
  console.log(DIVIDER);

  const equiv = toEquivalent(sessionCost);
  const equivText = equiv
    ? ` (${equiv.emoji} ${equiv.name} ${equiv.count}잔)`
    : '';

  console.log(`  📋 이번 세션 비용: ${chalk.bold.yellow(formatCostShort(sessionCost))}${equivText}`);
  console.log(`  📊 오늘 총 비용: ${chalk.bold.yellow(formatCostShort(totalCost))}`);

  if (savingsTotal > 0.01) {
    console.log(chalk.cyan(`  💡 절약 가능했던 금액: ${formatCostShort(savingsTotal)} (최저가 모델 기준)`));
  }

  showTopExpensive(topRequests);

  console.log();
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

export function showConfigUpdate(key, value) {
  console.log(chalk.green(`  ✅ ${key} = ${value}`));
}
