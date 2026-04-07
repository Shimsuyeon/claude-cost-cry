import { watch } from 'chokidar';
import { readFile, stat, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { getProvider } from './providers/index.js';
import claude from './providers/claude.js';

const CLAUDE_DIR = join(homedir(), '.claude', 'projects');

export function getClaudeProjectsDir() {
  return CLAUDE_DIR;
}

/**
 * 로그 소스 목록을 빌드한다.
 * Claude Code는 항상 자동 포함, logSources에 추가된 것들도 포함.
 * API 기반 프로바이더(예: Cursor)는 isApi: true 로 표시.
 */
export function buildLogSources(config) {
  const sources = [];

  // Claude Code는 항상 기본 포함
  if (existsSync(CLAUDE_DIR)) {
    sources.push({ provider: 'claude', path: CLAUDE_DIR });
  }

  // 사용자 설정 로그 소스 추가
  for (const src of (config?.logSources || [])) {
    if (!src.provider) continue;

    const provider = getProvider(src.provider);

    if (provider?.isApiProvider) {
      if (provider.isAvailable?.()) {
        sources.push({ provider: src.provider, isApi: true });
      }
      continue;
    }

    if (!src.path) continue;
    if (src.provider === 'claude' && src.path === CLAUDE_DIR) continue;
    if (existsSync(src.path)) {
      sources.push(src);
    }
  }

  return sources;
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

function parseWithProvider(content, provider) {
  const lines = content.split('\n');
  const usages = [];
  let lastUserText = null;

  for (const line of lines) {
    const entry = parseLine(line);
    if (!entry) continue;

    const userText = provider.extractUserText?.(entry);
    if (userText) lastUserText = userText;

    const usage = provider.parseLogLine(entry);
    if (usage) {
      usage.prompt = lastUserText;
      usages.push(usage);
    }
  }

  return usages;
}

export async function scanToday(config) {
  const sources = buildLogSources(config);
  if (sources.length === 0) {
    return { usages: [], fileOffsets: new Map() };
  }

  const usages = [];
  const fileOffsets = new Map();
  const todayStart = getTodayStart();

  for (const source of sources) {
    // API 기반 프로바이더 (예: Cursor) — 서버 API 폴링
    if (source.isApi) {
      const apiProvider = getProvider(source.provider);
      if (apiProvider?.scanToday) {
        try {
          const apiUsages = await apiProvider.scanToday();
          usages.push(...apiUsages);
        } catch {
          // API 불가 시 무시
        }
      }
      continue;
    }

    const provider = getProvider(source.provider);
    if (!provider) continue;

    const files = await findJsonlFiles(source.path);

    for (const filePath of files) {
      try {
        const content = await readFile(filePath, 'utf-8');
        const fileSize = Buffer.byteLength(content, 'utf-8');
        fileOffsets.set(filePath, fileSize);

        for (const usage of parseWithProvider(content, provider)) {
          const entryTime = new Date(usage.timestamp).getTime();
          if (entryTime >= todayStart) {
            usages.push(usage);
          }
        }
      } catch {
        // 읽을 수 없는 파일은 무시
      }
    }
  }

  return { usages, fileOffsets };
}

// 파일별로 마지막 사용자 프롬프트를 추적
const lastPromptByFile = new Map();
// 파일 → 프로바이더 매핑
const fileProviderMap = new Map();

export function startWatching(fileOffsets, onNewUsage, config) {
  const sources = buildLogSources(config);
  if (sources.length === 0) return null;

  const watchers = [];

  for (const source of sources) {
    // API 기반 프로바이더 — 주기적 폴링
    if (source.isApi) {
      const apiProvider = getProvider(source.provider);
      if (apiProvider?.startPolling) {
        const poller = apiProvider.startPolling(onNewUsage);
        if (poller) watchers.push(poller);
      }
      continue;
    }

    const provider = getProvider(source.provider);
    if (!provider || !existsSync(source.path)) continue;

    const watcher = watch(join(source.path, '**', '*.jsonl'), {
      persistent: true,
      ignoreInitial: true,
      usePolling: true,
      interval: 1000,
      binaryInterval: 1000,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 200,
      },
    });

    watcher.on('change', async (filePath) => {
      try {
        fileProviderMap.set(filePath, provider);
        const currentOffset = fileOffsets.get(filePath) || 0;
        const fileStat = await stat(filePath);
        const newSize = fileStat.size;

        if (newSize <= currentOffset) {
          fileOffsets.set(filePath, newSize);
          return;
        }

        const content = await readFile(filePath, 'utf-8');
        const fullBytes = Buffer.byteLength(content, 'utf-8');
        fileOffsets.set(filePath, fullBytes);

        const contentBuffer = Buffer.from(content, 'utf-8');
        const newContent = contentBuffer.slice(currentOffset).toString('utf-8');
        const lines = newContent.split('\n');

        for (const line of lines) {
          const entry = parseLine(line);
          if (!entry) continue;

          const userText = provider.extractUserText?.(entry);
          if (userText) lastPromptByFile.set(filePath, userText);

          const usage = provider.parseLogLine(entry);
          if (usage) {
            usage.prompt = lastPromptByFile.get(filePath) || null;
            onNewUsage(usage);
          }
        }
      } catch {
        // 무시
      }
    });

    watcher.on('add', async (filePath) => {
      try {
        const fileStat = await stat(filePath);
        fileOffsets.set(filePath, fileStat.size);
        fileProviderMap.set(filePath, provider);
      } catch {
        // 무시
      }
    });

    watchers.push(watcher);
  }

  // 복합 watcher — close()로 전부 닫기
  return {
    close() {
      for (const w of watchers) w.close();
    },
  };
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
      // 접근할 수 없는 디렉토리는 무시
    }
  }

  await walk(dir);
  return files;
}

function getTodayStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}
