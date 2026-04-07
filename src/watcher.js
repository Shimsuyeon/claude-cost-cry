import { watch } from 'chokidar';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { parseLine, extractUsage, extractUserText } from './parser.js';

const CLAUDE_DIR = join(homedir(), '.claude', 'projects');

export function getClaudeProjectsDir() {
  return CLAUDE_DIR;
}

/**
 * 파일 내용의 모든 라인을 파싱하면서, 각 assistant usage에
 * 직전 사용자 프롬프트(tool_result는 건너뜀)를 붙인다.
 */
function parseWithPrompts(content) {
  const lines = content.split('\n');
  const usages = [];
  let lastUserText = null;

  for (const line of lines) {
    const entry = parseLine(line);
    if (!entry) continue;

    const userText = extractUserText(entry);
    if (userText) lastUserText = userText;

    const usage = extractUsage(entry);
    if (usage) {
      usage.prompt = lastUserText;
      usages.push(usage);
    }
  }

  return usages;
}

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

      for (const usage of parseWithPrompts(content)) {
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

// 파일별로 마지막 사용자 프롬프트를 추적
const lastPromptByFile = new Map();

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

      const contentBuffer = Buffer.from(content, 'utf-8');
      const newContent = contentBuffer.slice(currentOffset).toString('utf-8');
      const lines = newContent.split('\n');

      for (const line of lines) {
        const entry = parseLine(line);
        if (!entry) continue;

        const userText = extractUserText(entry);
        if (userText) lastPromptByFile.set(filePath, userText);

        const usage = extractUsage(entry);
        if (usage) {
          usage.prompt = lastPromptByFile.get(filePath) || null;
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
