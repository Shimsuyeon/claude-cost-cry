import chalk from 'chalk';
import { formatCostShort, formatTokenCount, toEquivalent, getSavingsNudge } from './calculator.js';
import { getMessage, getStartupMood } from './messages.js';
import { formatLocalCost } from './exchange.js';
import { getModelLabel as getProviderModelLabel, getProviderEmoji, getProviderDisplayName } from './providers/index.js';

const VERSION = '0.3.0';

const DIVIDER = chalk.gray('─'.repeat(56));

function fc(cost, ex) {
  return ex ? formatLocalCost(cost, ex) : formatCostShort(cost);
}

function resolveModelLabel(usage) {
  if (usage.provider) return getProviderModelLabel(usage);
  return usage.model || 'Unknown';
}

function providerTag(providerName) {
  if (!providerName) return '';
  const emoji = getProviderEmoji(providerName);
  return `${emoji} `;
}

export function showBanner() {
  console.log();
  console.log(chalk.bold(`  🪙 claude-cost-cry v${VERSION}`));
  console.log(chalk.gray('  당신의 API 비용을 감정적으로 체감시켜드립니다'));
  console.log();
}

export function showTodaySummary(totalCost, callCount, budgetStatus, config, exchange, costByProvider) {
  const mood = getStartupMood(totalCost);
  const equiv = toEquivalent(totalCost, config);
  const equivText = equiv
    ? chalk.gray(` (${equiv.emoji} ${equiv.name} ${equiv.count}${equiv.unit || '개'})`)
    : '';

  console.log(
    `  📊 오늘 누적: ${chalk.bold.yellow(fc(totalCost, exchange))}${equivText}`
  );
  if (callCount > 0) {
    console.log(chalk.gray(`     API 호출 ${callCount}건`));
  }

  if (costByProvider && Object.keys(costByProvider).length > 1) {
    const breakdown = Object.entries(costByProvider)
      .sort((a, b) => b[1] - a[1])
      .map(([p, c]) => `${getProviderEmoji(p)} ${getProviderDisplayName(p)} ${fc(c, exchange)}`)
      .join('  ');
    console.log(chalk.gray(`     ${breakdown}`));
  }

  console.log(chalk.gray(`     ${mood}`));

  if (exchange && exchange.currency !== 'USD') {
    const src = exchange.source === 'manual' ? '수동' : exchange.updatedAt || '';
    console.log(chalk.gray(`     💱 1 USD = ${exchange.rate.toLocaleString()} ${exchange.currency} (${src})`));
  }

  if (budgetStatus?.budget) {
    console.log();
    showBudgetBar(totalCost, budgetStatus, exchange);
  }

  console.log();
  console.log(DIVIDER);
  console.log(chalk.gray('  감시 중... (Ctrl+C로 종료)'));
  console.log(DIVIDER);
  console.log();
}

export function showBudgetBar(totalCost, budgetStatus, exchange) {
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
  console.log(chalk.gray(`     ${fc(totalCost, exchange)} / ${fc(budget, exchange)} (잔여: ${fc(remaining, exchange)})`));

  if (status === 'exceeded') {
    console.log(chalk.red.bold(`     🚫 일일 예산을 초과했습니다!`));
  } else if (status === 'danger') {
    console.log(chalk.red(`     ⚠️  예산의 90%를 사용했습니다!`));
  } else if (status === 'warning') {
    console.log(chalk.yellow(`     💡 예산의 70%를 사용했습니다.`));
  }
}

export function showCostUpdate(usage, cost, totalCost, config, exchange) {
  const now = new Date();
  const timeStr = chalk.gray(
    `[${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}]`
  );

  const modelLabel = resolveModelLabel(usage);
  const pEmoji = providerTag(usage.provider);
  const isCursor = usage.provider === 'cursor';
  const modelColor = isCursor ? chalk.hex('#06b6d4')
    : /opus/i.test(modelLabel) ? chalk.magenta
    : /haiku/i.test(modelLabel) ? chalk.green
    : /gpt/i.test(modelLabel) ? chalk.hex('#74aa9c')
    : /gemini/i.test(modelLabel) ? chalk.hex('#4285f4')
    : chalk.blue;
  const modelStr = modelColor(`${pEmoji}${modelLabel}`);

  const totalInputTokens = usage.inputTokens + usage.cacheCreationTokens + usage.cacheReadTokens;
  const tokenInfo = chalk.gray(
    `📥 ${formatTokenCount(totalInputTokens)} 📤 ${formatTokenCount(usage.outputTokens)}`
  );

  const { emoji, message } = getMessage(totalCost);

  const costDelta = cost >= 0.01
    ? chalk.red(`+${fc(cost, exchange)}`)
    : chalk.yellow(`+${fc(cost, exchange)}`);

  const totalStr = chalk.bold.yellow(fc(totalCost, exchange));

  const equiv = toEquivalent(totalCost, config);
  const equivStr = equiv
    ? chalk.gray(` ${equiv.emoji} ${equiv.count}${equiv.unit || '개'}`)
    : '';

  console.log(`  ${timeStr} ${modelStr}  ${tokenInfo}`);
  console.log(`  ${emoji} ${costDelta}  →  누적: ${totalStr}${equivStr}`);
  console.log(chalk.italic.gray(`     "${message}"`));

  if (config?.showNudge && cost > 0.01) {
    const nudge = getSavingsNudge(usage, cost);
    if (nudge && nudge.saving > 0.005) {
      console.log(chalk.cyan(`     💡 ${nudge.model}로 했으면 ${fc(nudge.cost, exchange)} (${fc(nudge.saving, exchange)} 절약)`));
    }
  }

  console.log();
}

export function showBudgetAlert(budgetStatus, exchange) {
  const { status } = budgetStatus;
  if (status === 'exceeded') {
    console.log(chalk.bgRed.white.bold('  🚫 일일 예산 초과! 🚫  '));
    console.log();
  } else if (status === 'danger') {
    console.log(chalk.red(`  🔴 예산 90% 도달 — 남은 예산: ${fc(budgetStatus.remaining, exchange)}`));
    console.log();
  }
}

export function showTopExpensive(topRequests, exchange) {
  if (!topRequests || topRequests.length === 0) return;

  console.log();
  console.log(`  🏆 ${chalk.bold('오늘의 가장 비싼 요청 TOP 3')}`);
  console.log();

  topRequests.forEach((req, i) => {
    const medal = ['🥇', '🥈', '🥉'][i];
    const pEmoji = req.providerEmoji ? `${req.providerEmoji} ` : '';
    const modelColor = req.provider === 'cursor' ? chalk.hex('#06b6d4')
      : /opus/i.test(req.model) ? chalk.magenta
      : /haiku/i.test(req.model) ? chalk.green
      : /gpt/i.test(req.model) ? chalk.hex('#74aa9c')
      : /gemini/i.test(req.model) ? chalk.hex('#4285f4')
      : chalk.blue;
    const timeStr = req.time || '';

    console.log(`  ${medal} ${chalk.bold.yellow(fc(req.cost, exchange))}  ${pEmoji}${modelColor(req.model)}  ${chalk.gray(timeStr)}`);

    if (req.prompt) {
      console.log(chalk.white(`     💬 "${req.prompt}"`));
    }

    console.log(chalk.gray(`     📥 ${formatTokenCount(req.inputTokens)} 📤 ${formatTokenCount(req.outputTokens)}`));
  });
}

export function showShutdown(sessionCost, totalCost, savingsTotal, topRequests, config, exchange, costByProvider) {
  console.log();
  console.log(DIVIDER);

  const equiv = toEquivalent(sessionCost, config);
  const equivText = equiv
    ? ` (${equiv.emoji} ${equiv.name} ${equiv.count}${equiv.unit || '개'})`
    : '';

  console.log(`  📋 이번 세션 비용: ${chalk.bold.yellow(fc(sessionCost, exchange))}${equivText}`);
  console.log(`  📊 오늘 총 비용: ${chalk.bold.yellow(fc(totalCost, exchange))}`);

  if (costByProvider && Object.keys(costByProvider).length > 1) {
    const breakdown = Object.entries(costByProvider)
      .sort((a, b) => b[1] - a[1])
      .map(([p, c]) => `${getProviderEmoji(p)} ${getProviderDisplayName(p)} ${fc(c, exchange)}`)
      .join('  ');
    console.log(chalk.gray(`     ${breakdown}`));
  }

  if (savingsTotal > 0.01) {
    console.log(chalk.cyan(`  💡 절약 가능했던 금액: ${fc(savingsTotal, exchange)} (최저가 모델 기준)`));
  }

  showTopExpensive(topRequests, exchange);

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
