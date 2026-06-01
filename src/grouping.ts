import type { PromptGroup } from './types.js';

export interface RequestRecord {
  cost: number;
  inputCost: number;
  outputCost: number;
  provider: string;
  providerEmoji: string;
  model: string;
  time: string;
  inputTokens: number;
  outputTokens: number;
  prompt: string | null;
  fullPrompt: string | null;
  timestampMs: number;
}

const GROUP_TIME_WINDOW_MS = 60_000;

function normalizePrompt(text: string | null | undefined): string {
  if (!text) return '';
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

export function groupRequests(records: RequestRecord[], limit = 5): PromptGroup[] {
  interface WorkingGroup extends PromptGroup {
    lastTimestampMs: number;
    maxCallCost: number;
  }

  const groups: WorkingGroup[] = [];
  const sorted = [...records].sort((a, b) => a.timestampMs - b.timestampMs);

  for (const rec of sorted) {
    const norm = normalizePrompt(rec.fullPrompt);

    let matched: WorkingGroup | undefined;
    if (norm) {
      for (const g of groups) {
        if (normalizePrompt(g.fullPrompt) === norm &&
            rec.timestampMs - g.lastTimestampMs <= GROUP_TIME_WINDOW_MS) {
          matched = g;
          break;
        }
      }
    }

    if (matched) {
      matched.totalCost += rec.cost;
      matched.inputCost += rec.inputCost;
      matched.outputCost += rec.outputCost;
      matched.callCount++;
      matched.totalInputTokens += rec.inputTokens;
      matched.totalOutputTokens += rec.outputTokens;
      matched.lastTimestampMs = rec.timestampMs;
      if (rec.cost > matched.maxCallCost) {
        matched.maxCallCost = rec.cost;
        matched.model = rec.model;
        matched.provider = rec.provider;
        matched.providerEmoji = rec.providerEmoji;
      }
    } else {
      groups.push({
        prompt: rec.prompt,
        fullPrompt: rec.fullPrompt,
        totalCost: rec.cost,
        inputCost: rec.inputCost,
        outputCost: rec.outputCost,
        callCount: 1,
        provider: rec.provider,
        providerEmoji: rec.providerEmoji,
        model: rec.model,
        time: rec.time,
        totalInputTokens: rec.inputTokens,
        totalOutputTokens: rec.outputTokens,
        lastTimestampMs: rec.timestampMs,
        maxCallCost: rec.cost,
      });
    }
  }

  groups.sort((a, b) => b.totalCost - a.totalCost);

  return groups.slice(0, limit).map(
    ({ lastTimestampMs, maxCallCost, ...rest }) => rest
  );
}
