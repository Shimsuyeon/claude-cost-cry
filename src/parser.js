/**
 * Claude Code JSONL 로그 파서
 * ~/.claude/projects/ 아래의 JSONL 파일에서 토큰 사용량을 추출한다.
 */

export function parseLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

/**
 * assistant 타입 메시지에서 usage 데이터를 추출한다.
 * 중복 방지: 같은 requestId의 마지막 엔트리만 사용해야 하므로
 * 스트리밍 중간 엔트리(stop_reason이 null)는 건너뛴다.
 */
export function extractUsage(entry) {
  if (entry?.type !== 'assistant') return null;

  const message = entry.message;
  if (!message?.usage) return null;

  // 스트리밍 중간 엔트리는 건너뛴다 (최종 응답만 사용)
  if (message.stop_reason === null || message.stop_reason === undefined) {
    return null;
  }

  const usage = message.usage;

  return {
    model: message.model || 'unknown',
    inputTokens: usage.input_tokens || 0,
    outputTokens: usage.output_tokens || 0,
    cacheCreationTokens: usage.cache_creation_input_tokens || 0,
    cacheReadTokens: usage.cache_read_input_tokens || 0,
    timestamp: entry.timestamp || new Date().toISOString(),
    sessionId: entry.sessionId || 'unknown',
  };
}

export function parseAndExtract(line) {
  const entry = parseLine(line);
  if (!entry) return null;
  return extractUsage(entry);
}
