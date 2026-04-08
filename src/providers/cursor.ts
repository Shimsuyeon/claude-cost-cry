import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { existsSync } from 'node:fs';
import type { Provider, Usage, ModelPricing } from '../types.js';

const STATE_DB_PATH = join(
  homedir(), 'Library', 'Application Support', 'Cursor',
  'User', 'globalStorage', 'state.vscdb',
);

interface CursorEvent {
  timestamp: number | string;
  model?: string;
  chargedCents?: number;
  usageBasedCosts?: string;
  tokenUsage?: {
    inputTokens?: number;
    outputTokens?: number;
    cacheWriteTokens?: number;
    cacheReadTokens?: number;
    totalCents?: number;
  };
}

interface CursorApiResponse {
  usageEventsDisplay?: CursorEvent[];
}

const provider: Provider & {
  _cachedToken: string | null;
  _cachedUserId: string | null;
  _sortedKeys: string[] | null;
  _lastPollTimestamp: number;
  _getSortedKeys(): string[];
} = {
  name: 'cursor',
  displayName: 'Cursor',
  emoji: '⚡',

  defaultLogDir: null,
  isApiProvider: true,

  models: {
    'claude-4.6-opus-high-thinking': { input: 5, output: 25, label: 'Claude 4.6 Opus' },
    'claude-4.5-sonnet': { input: 3, output: 15, label: 'Claude 4.5 Sonnet' },
    'claude-4.5-opus':   { input: 5, output: 25, label: 'Claude 4.5 Opus' },
    'claude-4-sonnet':   { input: 3, output: 15, label: 'Claude 4 Sonnet' },
    'claude-3.5-sonnet': { input: 3, output: 15, label: 'Claude 3.5 Sonnet' },
    'gpt-4o':            { input: 2.5, output: 10, label: 'GPT-4o' },
    'gpt-4o-mini':       { input: 0.15, output: 0.6, label: 'GPT-4o mini' },
    'gpt-4.1':           { input: 2, output: 8, label: 'GPT-4.1' },
    'gpt-4.1-mini':      { input: 0.4, output: 1.6, label: 'GPT-4.1 mini' },
    'gpt-4.1-nano':      { input: 0.1, output: 0.4, label: 'GPT-4.1 nano' },
    'o3':                { input: 10, output: 40, label: 'o3' },
    'o3-mini':           { input: 1.1, output: 4.4, label: 'o3 mini' },
    'o4-mini':           { input: 1.1, output: 4.4, label: 'o4-mini' },
    'gemini-2.5-pro':    { input: 1.25, output: 10, label: 'Gemini 2.5 Pro' },
    'gemini-2.0-flash':  { input: 0.1, output: 0.4, label: 'Gemini 2.0 Flash' },
  },

  _cachedToken: null,
  _cachedUserId: null,
  _sortedKeys: null,
  _lastPollTimestamp: 0,

  _getSortedKeys(): string[] {
    if (!this._sortedKeys) {
      this._sortedKeys = Object.keys(this.models).sort((a, b) => b.length - a.length);
    }
    return this._sortedKeys;
  },

  resolveModel(modelName: string): ModelPricing {
    const lower = (modelName || '').toLowerCase();
    for (const key of this._getSortedKeys()) {
      if (lower.includes(key)) return this.models[key];
    }
    if (/opus/i.test(lower)) return this.models['claude-4.5-opus'];
    if (/sonnet/i.test(lower)) return this.models['claude-4-sonnet'];
    if (/haiku/i.test(lower)) return { input: 0.8, output: 4, label: 'Haiku' };
    if (/gemini/i.test(lower)) return this.models['gemini-2.5-pro'];
    return { input: 3, output: 15, label: modelName || 'Unknown' };
  },

  getModelLabel(modelName: string): string {
    return this.resolveModel(modelName).label;
  },

  parseLogLine(): Usage | null { return null; },
  extractUserText(): string | null { return null; },

  calculateCost(usage: Usage): number {
    if (usage.cost != null && usage.cost > 0) return usage.cost;
    const pricing = this.resolveModel(usage.model);
    return (usage.inputTokens / 1e6) * pricing.input
         + (usage.outputTokens / 1e6) * pricing.output;
  },

  isAvailable(): boolean {
    return existsSync(STATE_DB_PATH);
  },

  getSessionToken(): string | null {
    if (this._cachedToken) return this._cachedToken;
    if (!this.isAvailable!()) return null;

    try {
      const jwt = execSync(
        `sqlite3 "${STATE_DB_PATH}" "SELECT value FROM ItemTable WHERE key = 'cursorAuth/accessToken'"`,
        { encoding: 'utf-8', timeout: 5000 },
      ).trim();

      if (!jwt) return null;

      const payloadB64 = jwt.split('.')[1];
      const payload = JSON.parse(
        Buffer.from(payloadB64, 'base64url').toString(),
      );
      const sub = (payload.sub || '') as string;
      const userId = sub.includes('|') ? sub.split('|')[1] : sub;

      this._cachedUserId = userId;
      this._cachedToken = `${userId}%3A%3A${jwt}`;
      return this._cachedToken;
    } catch {
      return null;
    }
  },

  clearTokenCache(): void {
    this._cachedToken = null;
    this._cachedUserId = null;
  },

  async fetchUsageEvents(startDateMs: number, endDateMs: number, page = 1, pageSize = 50): Promise<CursorApiResponse> {
    const token = this.getSessionToken!();
    if (!token) throw new Error('Cursor session token not available');

    const resp = await fetch(
      'https://cursor.com/api/dashboard/get-filtered-usage-events',
      {
        method: 'POST',
        headers: {
          'Cookie': `WorkosCursorSessionToken=${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          'Origin': 'https://cursor.com',
          'Referer': 'https://cursor.com/dashboard',
        },
        body: JSON.stringify({
          teamId: 0,
          startDate: String(startDateMs),
          endDate: String(endDateMs),
          page,
          pageSize,
        }),
      },
    );

    if (resp.status === 401 || resp.status === 403) {
      this.clearTokenCache!();
      throw new Error('Cursor auth token expired');
    }
    if (!resp.ok) {
      throw new Error(`Cursor API ${resp.status}`);
    }

    return resp.json() as Promise<CursorApiResponse>;
  },

  parseApiEvent(event: unknown): Usage {
    const ev = event as CursorEvent;
    const timestampMs = typeof ev.timestamp === 'number'
      ? ev.timestamp
      : parseInt(ev.timestamp as string, 10);

    const tu = ev.tokenUsage || {};
    const inputTokens  = tu.inputTokens || 0;
    const outputTokens = tu.outputTokens || 0;
    const cacheWrite   = tu.cacheWriteTokens || 0;
    const cacheRead    = tu.cacheReadTokens || 0;

    let cost = 0;
    if (ev.chargedCents && ev.chargedCents > 0) {
      cost = ev.chargedCents / 100;
    } else {
      const costStr = ev.usageBasedCosts;
      if (costStr && costStr !== '$0.00' && costStr !== '-') {
        cost = parseFloat(costStr.replace('$', '')) || 0;
      }
    }
    if (!cost && tu.totalCents && tu.totalCents > 0) {
      cost = tu.totalCents / 100;
    }

    return {
      provider: 'cursor',
      model: ev.model || 'unknown',
      inputTokens,
      outputTokens,
      cacheCreationTokens: cacheWrite,
      cacheReadTokens: cacheRead,
      cost,
      timestamp: new Date(timestampMs).toISOString(),
      prompt: null,
    };
  },

  async scanToday(): Promise<Usage[]> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const now = Date.now();
    const usages: Usage[] = [];
    let page = 1;

    while (true) {
      const data = await this.fetchUsageEvents!(
        todayStart.getTime(), now, page, 100,
      ) as CursorApiResponse;
      const events = data.usageEventsDisplay || [];
      for (const ev of events) {
        usages.push(this.parseApiEvent!(ev));
      }
      if (events.length < 100) break;
      page++;
    }

    if (usages.length > 0) {
      const maxTs = Math.max(
        ...usages.map(u => new Date(u.timestamp).getTime()),
      );
      this._lastPollTimestamp = maxTs;
    } else {
      this._lastPollTimestamp = now;
    }

    return usages;
  },

  startPolling(onNewUsage: (usage: Usage) => void, interval = 30_000): { close(): void } | null {
    if (!this.isAvailable!()) return null;

    let lastTs = this._lastPollTimestamp || Date.now();
    let consecutiveFailures = 0;

    const poll = async () => {
      const token = this.getSessionToken!();
      if (!token) {
        consecutiveFailures++;
        return;
      }

      try {
        const now = Date.now();
        const data = await this.fetchUsageEvents!(
          lastTs - 5000, now, 1, 50,
        ) as CursorApiResponse;
        const events = data.usageEventsDisplay || [];
        let maxTs = lastTs;

        for (const ev of events) {
          const usage = this.parseApiEvent!(ev);
          const ts = new Date(usage.timestamp).getTime();
          if (ts > lastTs) {
            onNewUsage(usage);
            if (ts > maxTs) maxTs = ts;
          }
        }
        lastTs = maxTs;
        consecutiveFailures = 0;
      } catch (err) {
        consecutiveFailures++;
        if (err instanceof Error && err.message?.includes('expired')) {
          this.clearTokenCache!();
        }
      }
    };

    const timer = setInterval(poll, interval);
    return { close() { clearInterval(timer); } };
  },
};

export default provider;
