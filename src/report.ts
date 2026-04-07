import chalk from 'chalk';
import { formatCostShort, toEquivalent } from './calculator.js';
import { aggregateByDate, computeStats } from './history.js';
import { loadConfig } from './config.js';
import { getProvider, getProviderEmoji } from './providers/index.js';
import type { DailyData, DailyStats, ModelSummaryItem, SavingsSimulationItem } from './types.js';

const BAR_MAX_WIDTH = 30;

function renderBar(value: number, maxValue: number, width = BAR_MAX_WIDTH): string {
  if (maxValue <= 0) return '';
  const filled = Math.round((value / maxValue) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function getBarColor(cost: number, maxCost: number) {
  const ratio = maxCost > 0 ? cost / maxCost : 0;
  if (ratio >= 0.8) return chalk.red;
  if (ratio >= 0.5) return chalk.yellow;
  return chalk.green;
}

export async function showWeeklyReport() {
  const dailyData = await aggregateByDate(7);

  if (dailyData.length === 0) {
    console.log(chalk.gray('  데이터가 없습니다.'));
    return { dailyData: [], stats: null };
  }

  const stats = computeStats(dailyData);
  const maxCost = stats.maxDay?.totalCost || 1;

  console.log();
  console.log(chalk.bold('  📊 주간 비용 리포트'));
  console.log(chalk.gray('  ─'.repeat(28)));
  console.log();

  for (const day of dailyData) {
    const dateLabel = `${day.date.slice(5)} (${day.day})`;
    const bar = renderBar(day.totalCost, maxCost);
    const color = getBarColor(day.totalCost, maxCost);
    const costStr = day.totalCost > 0
      ? chalk.bold(formatCostShort(day.totalCost))
      : chalk.gray('─');

    console.log(`  ${chalk.white(dateLabel.padEnd(12))} ${color(bar)} ${costStr}`);
  }

  console.log();
  console.log(chalk.gray('  ─'.repeat(28)));
  printStats(stats);
  printModelBreakdown(dailyData);

  return { dailyData, stats };
}

export async function showMonthlyReport() {
  const dailyData = await aggregateByDate(30);

  if (dailyData.length === 0) {
    console.log(chalk.gray('  데이터가 없습니다.'));
    return { dailyData: [], stats: null };
  }

  const stats = computeStats(dailyData);
  const maxCost = stats.maxDay?.totalCost || 1;

  console.log();
  console.log(chalk.bold('  📊 월간 비용 리포트 (최근 30일)'));
  console.log(chalk.gray('  ─'.repeat(28)));
  console.log();

  for (const day of dailyData) {
    const dateLabel = `${day.date.slice(5)} ${day.day}`;
    const bar = renderBar(day.totalCost, maxCost, 20);
    const color = getBarColor(day.totalCost, maxCost);
    const costStr = day.totalCost > 0
      ? formatCostShort(day.totalCost)
      : chalk.gray('·');

    console.log(`  ${chalk.gray(dateLabel.padEnd(9))} ${color(bar)} ${costStr}`);
  }

  console.log();
  console.log(chalk.gray('  ─'.repeat(28)));
  printStats(stats);
  printModelBreakdown(dailyData);

  return { dailyData, stats };
}

function printStats(stats: DailyStats): void {
  const config = loadConfig();
  const equiv = toEquivalent(stats.totalCost, config);
  const equivStr = equiv ? ` (${equiv.emoji} ${equiv.name} ${equiv.count}${equiv.unit || '개'})` : '';

  console.log();
  console.log(`  💰 총 비용:     ${chalk.bold.yellow(formatCostShort(stats.totalCost))}${chalk.gray(equivStr)}`);
  console.log(`  📈 일 평균:     ${chalk.cyan(formatCostShort(stats.avgDaily))}`);
  console.log(`  🔥 최고 지출일: ${chalk.red(stats.maxDay!.date)} (${stats.maxDay!.day}) — ${formatCostShort(stats.maxDay!.totalCost)}`);

  if (stats.minDay && stats.minDay !== stats.maxDay) {
    console.log(`  🌿 최저 지출일: ${chalk.green(stats.minDay.date)} (${stats.minDay.day}) — ${formatCostShort(stats.minDay.totalCost)}`);
  }

  console.log(`  📞 총 호출:     ${stats.totalCalls}건 (${stats.daysActive}일 활동)`);
  console.log();
}

const MODEL_BAR_WIDTH = 20;

const PROVIDER_COLORS: Record<string, typeof chalk> = {
  claude: chalk.magenta,
  openai: chalk.hex('#74aa9c'),
  google: chalk.hex('#4285f4'),
  cursor: chalk.hex('#06b6d4'),
};

function printModelBreakdown(dailyData: DailyData[]): void {
  const summary = buildModelSummary(dailyData);
  if (summary.length === 0) return;

  const savings = computeSavingsSimulation(summary);
  const maxCost = summary[0]?.cost || 1;

  console.log(chalk.bold('  🏷️  모델별 비용'));
  console.log();

  for (const m of summary) {
    const filled = Math.round((m.cost / maxCost) * MODEL_BAR_WIDTH);
    const bar = '█'.repeat(filled) + '░'.repeat(MODEL_BAR_WIDTH - filled);
    const color = PROVIDER_COLORS[m.provider] || chalk.white;
    const pctStr = `(${String(m.pct).padStart(2)}%)`;

    console.log(
      `  ${m.emoji} ${color(m.model.padEnd(18))} ${color(bar)} ${chalk.bold(formatCostShort(m.cost).padStart(8))} ${chalk.gray(pctStr)}  ${chalk.gray(m.calls + '건')}`,
    );
  }

  if (savings.length > 0) {
    console.log();
    for (const s of savings.slice(0, 2)) {
      console.log(
        chalk.gray(`  💡 ${s.from} → ${s.to} 였다면 ${chalk.yellow(formatCostShort(s.saving))} 절약 가능`),
      );
    }
  }

  console.log();
}

function buildModelSummary(dailyData: DailyData[]): ModelSummaryItem[] {
  const agg: Record<string, { model: string; provider: string; cost: number; calls: number }> = {};

  for (const day of dailyData) {
    for (const [model, info] of Object.entries(day.models)) {
      if (!agg[model]) {
        agg[model] = { model, provider: info.provider || 'claude', cost: 0, calls: 0 };
      }
      agg[model].cost += info.cost;
      agg[model].calls += info.calls;
    }
  }

  const list = Object.values(agg).sort((a, b) => b.cost - a.cost);
  const totalCost = list.reduce((s, m) => s + m.cost, 0);

  return list.map(m => ({
    ...m,
    emoji: getProviderEmoji(m.provider),
    pct: totalCost > 0 ? Math.round((m.cost / totalCost) * 100) : 0,
  }));
}

function computeSavingsSimulation(modelSummary: ModelSummaryItem[]): SavingsSimulationItem[] {
  const results: SavingsSimulationItem[] = [];

  for (const item of modelSummary) {
    if (item.cost < 0.01) continue;
    const provider = getProvider(item.provider);
    if (!provider?.models) continue;

    const currentPricing = provider.resolveModel(item.model);
    const currentLabel = currentPricing.label?.toLowerCase();

    let cheapest: SavingsSimulationItem | null = null;

    for (const [, pricing] of Object.entries(provider.models)) {
      if (pricing.label.toLowerCase() === currentLabel) continue;
      const ratio = (pricing.input + pricing.output) / (currentPricing.input + currentPricing.output);
      if (ratio >= 1) continue;

      const saving = item.cost - item.cost * ratio;

      if (saving > 0.01 && (!cheapest || saving > cheapest.saving)) {
        cheapest = { from: item.model, to: pricing.label, saving };
      }
    }

    if (cheapest) results.push(cheapest);
  }

  return results.sort((a, b) => b.saving - a.saving);
}

interface ReportDataResult {
  dailyData: Array<{ date: string; day: string; cost: number; calls: number }>;
  stats: {
    totalCost: number;
    avgDaily: number;
    maxDay: string | null;
    maxDayCost: number;
    totalCalls: number;
    daysActive: number;
  } | null;
  modelSummary: ModelSummaryItem[];
  savingsSimulation: SavingsSimulationItem[];
}

const _reportCache = new Map<number, { data: ReportDataResult; ts: number }>();

function _buildReportResult(dailyData: DailyData[]): ReportDataResult {
  const stats = computeStats(dailyData);
  const modelSummary = buildModelSummary(dailyData);
  const savingsSimulation = computeSavingsSimulation(modelSummary);

  return {
    dailyData: dailyData.map(d => ({
      date: d.date.slice(5),
      day: d.day,
      cost: d.totalCost,
      calls: d.callCount,
    })),
    stats: stats.totalCost > 0 ? {
      totalCost: stats.totalCost,
      avgDaily: stats.avgDaily,
      maxDay: stats.maxDay ? `${stats.maxDay.date.slice(5)} (${stats.maxDay.day})` : null,
      maxDayCost: stats.maxDay?.totalCost || 0,
      totalCalls: stats.totalCalls,
      daysActive: stats.daysActive,
    } : null,
    modelSummary,
    savingsSimulation,
  };
}

export function getCachedReportData(daysBack = 7): ReportDataResult | null {
  const cached = _reportCache.get(daysBack);
  return cached?.data || null;
}

export async function getReportData(daysBack = 7): Promise<ReportDataResult> {
  const dailyData = await aggregateByDate(daysBack);
  const data = _buildReportResult(dailyData);
  _reportCache.set(daysBack, { data, ts: Date.now() });
  return data;
}
