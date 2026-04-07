import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { calculateCost } from './calculator.js';
import { loadConfig } from './config.js';
import { buildLogSources } from './watcher.js';
import { getProvider } from './providers/index.js';

function toDateKey(timestamp) {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getDayOfWeek(dateKey) {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return days[new Date(dateKey).getDay()];
}

function parseLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

export async function aggregateByDate(daysBack = 30) {
  const config = loadConfig();
  const sources = buildLogSources(config);
  if (sources.length === 0) return [];

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);
  cutoff.setHours(0, 0, 0, 0);
  const cutoffMs = cutoff.getTime();

  const dailyMap = new Map();

  for (const source of sources) {
    if (source.isApi) continue; // API 기반 프로바이더는 로컬 파일이 없으므로 건너뜀

    const provider = getProvider(source.provider);
    if (!provider) continue;

    const files = await findJsonlFiles(source.path);

    for (const filePath of files) {
      try {
        const content = await readFile(filePath, 'utf-8');
        const lines = content.split('\n');

        for (const line of lines) {
          const entry = parseLine(line);
          if (!entry) continue;

          const usage = provider.parseLogLine(entry);
          if (!usage) continue;

          const entryTime = new Date(usage.timestamp).getTime();
          if (entryTime < cutoffMs) continue;

          const cost = calculateCost(usage);
          const dateKey = toDateKey(usage.timestamp);
          const modelLabel = provider.getModelLabel(usage.model);

          if (!dailyMap.has(dateKey)) {
            dailyMap.set(dateKey, {
              date: dateKey,
              day: getDayOfWeek(dateKey),
              totalCost: 0,
              callCount: 0,
              models: {},
              providers: {},
            });
          }

          const day = dailyMap.get(dateKey);
          day.totalCost += cost;
          day.callCount++;
          day.models[modelLabel] = (day.models[modelLabel] || 0) + cost;
          day.providers[source.provider] = (day.providers[source.provider] || 0) + cost;
        }
      } catch {
        // skip
      }
    }
  }

  const days = Array.from(dailyMap.values());
  days.sort((a, b) => a.date.localeCompare(b.date));

  const result = [];
  if (days.length > 0) {
    const startDate = new Date(days[0].date);
    const endDate = new Date(days[days.length - 1].date);
    const dayMap = new Map(days.map(d => [d.date, d]));

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const key = toDateKey(d.toISOString());
      result.push(dayMap.get(key) || {
        date: key,
        day: getDayOfWeek(key),
        totalCost: 0,
        callCount: 0,
        models: {},
        providers: {},
      });
    }
  }

  return result;
}

export function computeStats(dailyData) {
  if (dailyData.length === 0) {
    return { totalCost: 0, avgDaily: 0, maxDay: null, minDay: null, totalCalls: 0, daysActive: 0 };
  }

  let totalCost = 0;
  let totalCalls = 0;
  let maxDay = dailyData[0];
  let minDay = null;
  let daysActive = 0;

  for (const day of dailyData) {
    totalCost += day.totalCost;
    totalCalls += day.callCount;
    if (day.totalCost > maxDay.totalCost) maxDay = day;
    if (day.callCount > 0) {
      daysActive++;
      if (!minDay || day.totalCost < minDay.totalCost) minDay = day;
    }
  }

  return { totalCost, avgDaily: daysActive > 0 ? totalCost / daysActive : 0, maxDay, minDay, totalCalls, daysActive };
}

async function findJsonlFiles(dir) {
  const files = [];

  async function walk(currentDir) {
    try {
      const entries = await readdir(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(currentDir, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.name.endsWith('.jsonl')) {
          files.push(fullPath);
        }
      }
    } catch {
      // skip
    }
  }

  await walk(dir);
  return files;
}
