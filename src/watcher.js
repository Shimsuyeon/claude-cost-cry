import { watch } from 'chokidar';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { parseAndExtract } from './parser.js';

const CLAUDE_DIR = join(homedir(), '.claude', 'projects');

export function getClaudeProjectsDir() {
  return CLAUDE_DIR;
}

/**
 * 기존 JSONL 로그에서 오늘의 사용량을 스캔한다.
 * 오늘 자정(UTC 기준) 이후의 엔트리만 추출.
 */
export async function scanToday() {
  if (!existsSync(CLAUDE_DIR)) {
    return { usages: [], fileOffsets: new Map() };
  }

  const usages = [];
  const fileOffsets = new Map();
  const todayStart = getTodayStart();

  const files = await findJsonlFiles(CLAUDE_DIR);

  for (const filePath of files) {
    try {
      const content = await readFile(filePath, 'utf-8');
      const fileSize = Buffer.byteLength(content, 'utf-8');
      fileOffsets.set(filePath, fileSize);

      const lines = content.split('\n');
      for (const line of lines) {
        const usage = parseAndExtract(line);
        if (!usage) continue;

        const entryTime = new Date(usage.timestamp).getTime();
        if (entryTime >= todayStart) {
          usages.push(usage);
        }
      }
    } catch {
      // 읽을 수 없는 파일은 무시
    }
  }

  return { usages, fileOffsets };
}

/**
 * JSONL 파일들을 실시간으로 감시한다.
 * 새 로그가 추가되면 콜백을 호출한다.
 */
export function startWatching(fileOffsets, onNewUsage) {
  if (!existsSync(CLAUDE_DIR)) {
    return null;
  }

  const watcher = watch(join(CLAUDE_DIR, '**', '*.jsonl'), {
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

      // 바이트 오프셋 기준으로 새 부분만 추출
      const contentBuffer = Buffer.from(content, 'utf-8');
      const newContent = contentBuffer.slice(currentOffset).toString('utf-8');
      const lines = newContent.split('\n');

      for (const line of lines) {
        const usage = parseAndExtract(line);
        if (usage) {
          onNewUsage(usage);
        }
      }
    } catch {
      // 파일 변경 처리 중 오류는 무시
    }
  });

  watcher.on('add', async (filePath) => {
    try {
      const fileStat = await stat(filePath);
      fileOffsets.set(filePath, fileStat.size);
    } catch {
      // 무시
    }
  });

  return watcher;
}

async function findJsonlFiles(dir) {
  const { readdir } = await import('node:fs/promises');
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
