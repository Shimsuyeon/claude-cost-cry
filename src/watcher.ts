import { watch } from 'chokidar';
import { readFile, stat, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { getProvider } from './providers/index.js';
import type { Config, Usage, LogSource, Provider } from './types.js';

const CLAUDE_DIR = join(homedir(), '.claude', 'projects');

export function getClaudeProjectsDir(): string {
  return CLAUDE_DIR;
}

export function buildLogSources(config: Config): LogSource[] {
  const sources: LogSource[] = [];

  if (existsSync(CLAUDE_DIR)) {
    sources.push({ provider: 'claude', path: CLAUDE_DIR });
  }

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

function parseLine(line: string): Record<string, unknown> | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function parseWithProvider(content: string, provider: Provider): Usage[] {
  const lines = content.split('\n');
  const usages: Usage[] = [];
  let lastUserText: string | null = null;

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

export async function scanToday(config: Config): Promise<{ usages: Usage[]; fileOffsets: Map<string, number> }> {
  const sources = buildLogSources(config);
  if (sources.length === 0) {
    return { usages: [], fileOffsets: new Map() };
  }

  const usages: Usage[] = [];
  const fileOffsets = new Map<string, number>();
  const todayStart = getTodayStart();

  for (const source of sources) {
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

    const files = await findJsonlFiles(source.path!);

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
        // skip
      }
    }
  }

  return { usages, fileOffsets };
}

const lastPromptByFile = new Map<string, string>();
const fileProviderMap = new Map<string, Provider>();

interface Closeable {
  close(): void;
}

export function startWatching(
  fileOffsets: Map<string, number>,
  onNewUsage: (usage: Usage) => void,
  config?: Config,
): Closeable | null {
  const sources = buildLogSources(config!);
  if (sources.length === 0) return null;

  const watchers: Closeable[] = [];

  for (const source of sources) {
    if (source.isApi) {
      const apiProvider = getProvider(source.provider);
      if (apiProvider?.startPolling) {
        const poller = apiProvider.startPolling(onNewUsage);
        if (poller) watchers.push(poller);
      }
      continue;
    }

    const provider = getProvider(source.provider);
    if (!provider || !existsSync(source.path!)) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const watcher: any = watch(join(source.path!, '**', '*.jsonl'), {
      persistent: true,
      ignoreInitial: true,
      usePolling: true,
      interval: 1000,
      binaryInterval: 1000,
      ignored: /\/subagents\//,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 200,
      },
    });

    watcher.on('change', async (filePath: string) => {
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
        const newContent = contentBuffer.subarray(currentOffset).toString('utf-8');
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
        // ignore
      }
    });

    watcher.on('add', async (filePath: string) => {
      try {
        const fileStat = await stat(filePath);
        fileOffsets.set(filePath, fileStat.size);
        fileProviderMap.set(filePath, provider);
      } catch {
        // ignore
      }
    });

    watchers.push(watcher);
  }

  return {
    close() {
      for (const w of watchers) w.close();
    },
  };
}

export async function findJsonlFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(currentDir: string): Promise<void> {
    try {
      const entries = await readdir(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(currentDir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'subagents') continue;
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

function getTodayStart(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}
