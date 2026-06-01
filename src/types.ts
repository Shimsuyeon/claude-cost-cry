export interface Usage {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  timestamp: string;
  sessionId?: string;
  cost?: number;
  prompt?: string | null;
}

export interface ModelPricing {
  input: number;
  output: number;
  cacheWrite?: number;
  cacheRead?: number;
  label: string;
}

export interface ModelPattern {
  pattern: RegExp;
  key: string;
}

export interface EquivalentItem {
  key?: string;
  name: string;
  price: number;
  emoji: string;
  unit: string;
}

export interface EquivalentResult extends EquivalentItem {
  count: number;
}

export interface Config {
  dailyBudget: number | null;
  monthlyBudget: number | null;
  currency: string;
  exchangeRate: number | null;
  showNudge: boolean;
  equivalentUnit: string;
  customEquivalents: EquivalentItem[];
  logSources: LogSourceConfig[];
  language: string;
}

export interface LogSourceConfig {
  provider: string;
  path?: string;
}

export interface LogSource {
  provider: string;
  path?: string;
  isApi?: boolean;
}

export interface ExchangeInfo {
  rate: number;
  symbol: string;
  currency: string;
  source: string;
  updatedAt?: string;
}

export interface BudgetStatus {
  ratio: number;
  status: 'ok' | 'warning' | 'danger' | 'exceeded';
  budget: number | null;
  remaining?: number;
}

export interface TopRequest {
  cost: number;
  inputCost?: number;
  outputCost?: number;
  model: string;
  provider?: string;
  providerEmoji?: string;
  inputTokens: number;
  outputTokens: number;
  time?: string;
  prompt?: string | null;
}

export interface PromptGroup {
  prompt: string | null;
  fullPrompt: string | null;
  totalCost: number;
  inputCost: number;
  outputCost: number;
  callCount: number;
  provider: string;
  providerEmoji: string;
  model: string;
  time: string;
  totalInputTokens: number;
  totalOutputTokens: number;
}

export interface SavingsNudge {
  model: string;
  cost: number;
  saving: number;
}

export interface DailyData {
  date: string;
  day: string;
  totalCost: number;
  callCount: number;
  models: Record<string, { cost: number; calls: number; provider: string }>;
  providers: Record<string, number>;
}

export interface DailyStats {
  totalCost: number;
  avgDaily: number;
  maxDay: DailyData | null;
  minDay: DailyData | null;
  totalCalls: number;
  daysActive: number;
}

export interface ModelSummaryItem {
  model: string;
  cost: number;
  calls: number;
  pct: number;
  provider: string;
  emoji: string;
}

export interface SavingsSimulationItem {
  from: string;
  to: string;
  saving: number;
}

export interface Provider {
  name: string;
  displayName: string;
  emoji: string;
  defaultLogDir: string | null;
  isApiProvider?: boolean;
  models: Record<string, ModelPricing>;
  modelPatterns?: ModelPattern[];
  resolveModel(modelName: string): ModelPricing;
  getModelLabel(modelName: string): string;
  parseLogLine(entry: unknown): Usage | null;
  extractUserText?(entry: unknown): string | null;
  calculateCost(usage: Usage): number;
  isAvailable?(): boolean;
  getSessionToken?(): string | null;
  clearTokenCache?(): void;
  fetchUsageEvents?(startMs: number, endMs: number, page?: number, pageSize?: number): Promise<unknown>;
  parseApiEvent?(event: unknown): Usage;
  scanToday?(): Promise<Usage[]>;
  startPolling?(onNewUsage: (usage: Usage) => void, interval?: number): { close(): void } | null;
}
