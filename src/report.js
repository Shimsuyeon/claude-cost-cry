import chalk from 'chalk';
import { formatCostShort, toEquivalent } from './calculator.js';
import { aggregateByDate, computeStats } from './history.js';

const BAR_MAX_WIDTH = 30;

function renderBar(value, maxValue, width = BAR_MAX_WIDTH) {
  if (maxValue <= 0) return '';
  const filled = Math.round((value / maxValue) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function getBarColor(cost, maxCost) {
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

  return { dailyData, stats };
}

function printStats(stats) {
  const equiv = toEquivalent(stats.totalCost);
  const equivStr = equiv ? ` (${equiv.emoji} ${equiv.name} ${equiv.count}잔)` : '';

  console.log();
  console.log(`  💰 총 비용:     ${chalk.bold.yellow(formatCostShort(stats.totalCost))}${chalk.gray(equivStr)}`);
  console.log(`  📈 일 평균:     ${chalk.cyan(formatCostShort(stats.avgDaily))}`);
  console.log(`  🔥 최고 지출일: ${chalk.red(stats.maxDay.date)} (${stats.maxDay.day}) — ${formatCostShort(stats.maxDay.totalCost)}`);

  if (stats.minDay && stats.minDay !== stats.maxDay) {
    console.log(`  🌿 최저 지출일: ${chalk.green(stats.minDay.date)} (${stats.minDay.day}) — ${formatCostShort(stats.minDay.totalCost)}`);
  }

  console.log(`  📞 총 호출:     ${stats.totalCalls}건 (${stats.daysActive}일 활동)`);
  console.log();
}

/**
 * 오버레이용 리포트 데이터를 반환한다 (원시 데이터만, 스타일링 없이).
 */
export async function getReportData(daysBack = 7) {
  const dailyData = await aggregateByDate(daysBack);
  const stats = computeStats(dailyData);

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
  };
}
