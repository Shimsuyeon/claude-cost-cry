import chalk from 'chalk';
import { formatCostShort, formatTokenCount, toEquivalent, getSavingsNudge, calculateCostBreakdown } from './calculator.js';
import { getMessage, getStartupMood } from './messages.js';
import { formatLocalCost } from './exchange.js';
import { getModelLabel as getProviderModelLabel, getProviderEmoji, getProviderDisplayName } from './providers/index.js';
import { t } from './i18n.js';
import type { Usage, Config, ExchangeInfo, BudgetStatus, TopRequest } from './types.js';

const VERSION = '0.3.0';

const DIVIDER = chalk.gray('─'.repeat(56));

function fc(cost: number, ex?: ExchangeInfo | null): string {
  return ex ? formatLocalCost(cost, ex) : formatCostShort(cost);
}

function resolveModelLabel(usage: Usage): string {
  if (usage.provider) return getProviderModelLabel(usage);
  return usage.model || 'Unknown';
}

function providerTag(providerName?: string): string {
  if (!providerName) return '';
  const emoji = getProviderEmoji(providerName);
  return `${emoji} `;
}

export function showBanner(): void {
  console.log();
  console.log(chalk.bold(`  🪙 claude-cost-cry v${VERSION}`));
  console.log(chalk.gray(`  ${t('display.tagline')}`));
  console.log();
}

export function showTodaySummary(
  totalCost: number,
  callCount: number,
  budgetStatus: BudgetStatus | null,
  config: Config,
  exchange: ExchangeInfo | null,
  costByProvider?: Record<string, number>,
): void {
  const mood = getStartupMood(totalCost);
  const equiv = toEquivalent(totalCost, config);
  const defaultUnit = t('display.defaultUnit');
  const equivText = equiv
    ? chalk.gray(` (${equiv.emoji} ${equiv.name} ${equiv.count}${equiv.unit || defaultUnit})`)
    : '';

  console.log(
    `  ${t('display.todayTotal')} ${chalk.bold.yellow(fc(totalCost, exchange))}${equivText}`
  );
  if (callCount > 0) {
    console.log(chalk.gray(`     ${t('display.apiCalls', { count: callCount })}`));
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
    const src = exchange.source === 'manual' ? t('display.exchangeManual') : exchange.updatedAt || '';
    console.log(chalk.gray(`     💱 1 USD = ${exchange.rate.toLocaleString()} ${exchange.currency} (${src})`));
  }

  if (budgetStatus?.budget) {
    console.log();
    showBudgetBar(totalCost, budgetStatus, exchange);
  }

  console.log();
  console.log(DIVIDER);
  console.log(chalk.gray(`  ${t('display.watching')}`));
  console.log(DIVIDER);
  console.log();
}

export function showBudgetBar(totalCost: number, budgetStatus: BudgetStatus, exchange: ExchangeInfo | null): void {
  const { ratio, status, budget, remaining } = budgetStatus;
  const barWidth = 30;
  const filled = Math.round(ratio * barWidth);
  const empty = barWidth - filled;

  let barColor: typeof chalk;
  let statusIcon: string;
  if (status === 'exceeded') { barColor = chalk.bgRed.white; statusIcon = '🚫'; }
  else if (status === 'danger') { barColor = chalk.bgRedBright.black; statusIcon = '🔴'; }
  else if (status === 'warning') { barColor = chalk.bgYellow.black; statusIcon = '🟡'; }
  else { barColor = chalk.bgGreen.black; statusIcon = '🟢'; }

  const bar = barColor('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
  const pct = Math.round(ratio * 100);

  console.log(`  ${statusIcon} ${t('display.budget')} ${bar} ${pct}%`);
  console.log(chalk.gray(`     ${fc(totalCost, exchange)} / ${fc(budget!, exchange)} (${t('display.budgetRemaining')} ${fc(remaining!, exchange)})`));

  if (status === 'exceeded') {
    console.log(chalk.red.bold(`     ${t('display.budgetExceeded')}`));
  } else if (status === 'danger') {
    console.log(chalk.red(`     ${t('display.budget90')}`));
  } else if (status === 'warning') {
    console.log(chalk.yellow(`     ${t('display.budget70')}`));
  }
}

export function showCostUpdate(usage: Usage, cost: number, totalCost: number, config: Config, exchange: ExchangeInfo | null): void {
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
  const defaultUnit = t('display.defaultUnit');
  const equivStr = equiv
    ? chalk.gray(` ${equiv.emoji} ${equiv.count}${equiv.unit || defaultUnit}`)
    : '';

  console.log(`  ${timeStr} ${modelStr}  ${tokenInfo}`);
  console.log(`  ${emoji} ${costDelta}  →  ${t('display.cumulative')} ${totalStr}${equivStr}`);
  console.log(chalk.italic.gray(`     "${message}"`));

  if (config?.showNudge && cost > 0.01) {
    const nudge = getSavingsNudge(usage, cost);
    if (nudge && nudge.saving > 0.005) {
      console.log(chalk.cyan(`     ${t('display.nudge', { model: nudge.model, cost: fc(nudge.cost, exchange), saving: fc(nudge.saving, exchange) })}`));
    }
  }

  console.log();
}

export function showBudgetAlert(budgetStatus: BudgetStatus, exchange: ExchangeInfo | null): void {
  const { status } = budgetStatus;
  if (status === 'exceeded') {
    console.log(chalk.bgRed.white.bold(`  ${t('display.budgetExceededBanner')}  `));
    console.log();
  } else if (status === 'danger') {
    console.log(chalk.red(`  ${t('display.budget90Alert', { remaining: fc(budgetStatus.remaining!, exchange) })}`));
    console.log();
  }
}

export function showTopExpensive(topRequests: TopRequest[], exchange: ExchangeInfo | null): void {
  if (!topRequests || topRequests.length === 0) return;

  console.log();
  console.log(`  🏆 ${chalk.bold(t('display.topExpensive'))}`);
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

    const inCost = req.inputCost || 0;
    const outCost = req.outputCost || 0;
    const total = inCost + outCost;
    if (total > 0) {
      const inPct = Math.round((inCost / total) * 100);
      const outPct = 100 - inPct;
      console.log(`     ${chalk.cyan(`📥 ${fc(inCost, exchange)}`)} ${chalk.gray(`(${inPct}%)`)}  ${chalk.hex('#ffb464')(`📤 ${fc(outCost, exchange)}`)} ${chalk.gray(`(${outPct}%)`)}`);
    } else {
      console.log(chalk.gray(`     📥 ${formatTokenCount(req.inputTokens)} 📤 ${formatTokenCount(req.outputTokens)}`));
    }
  });
}

export function showShutdown(
  sessionCost: number,
  totalCost: number,
  savingsTotal: number,
  topRequests: TopRequest[],
  config: Config,
  exchange: ExchangeInfo | null,
  costByProvider?: Record<string, number>,
): void {
  console.log();
  console.log(DIVIDER);

  const equiv = toEquivalent(sessionCost, config);
  const defaultUnit = t('display.defaultUnit');
  const equivText = equiv
    ? ` (${equiv.emoji} ${equiv.name} ${equiv.count}${equiv.unit || defaultUnit})`
    : '';

  console.log(`  ${t('display.sessionCost')} ${chalk.bold.yellow(fc(sessionCost, exchange))}${equivText}`);
  console.log(`  ${t('display.todayCost')} ${chalk.bold.yellow(fc(totalCost, exchange))}`);

  if (costByProvider && Object.keys(costByProvider).length > 1) {
    const breakdown = Object.entries(costByProvider)
      .sort((a, b) => b[1] - a[1])
      .map(([p, c]) => `${getProviderEmoji(p)} ${getProviderDisplayName(p)} ${fc(c, exchange)}`)
      .join('  ');
    console.log(chalk.gray(`     ${breakdown}`));
  }

  if (savingsTotal > 0.01) {
    console.log(chalk.cyan(`  ${t('display.potentialSavings', { amount: fc(savingsTotal, exchange) })}`));
  }

  showTopExpensive(topRequests, exchange);

  console.log();
  console.log(chalk.gray(`  ${t('display.goodbye')}`));
  console.log(DIVIDER);
  console.log();
}

export function showError(message: string): void {
  console.error(chalk.red(`  ❌ ${message}`));
}

export function showInfo(message: string): void {
  console.log(chalk.gray(`  ℹ️  ${message}`));
}

export function showConfigUpdate(key: string, value: string | number): void {
  console.log(chalk.green(`  ✅ ${key} = ${value}`));
}
