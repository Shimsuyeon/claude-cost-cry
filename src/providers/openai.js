export default {
  name: 'openai',
  displayName: 'OpenAI',
  emoji: '🟢',

  defaultLogDir: null, // 자동 감지 경로 없음 — 사용자가 설정

  models: {
    'gpt-4.1':      { input: 2,    output: 8,    label: 'GPT-4.1' },
    'gpt-4.1-mini': { input: 0.4,  output: 1.6,  label: 'GPT-4.1 mini' },
    'gpt-4.1-nano': { input: 0.1,  output: 0.4,  label: 'GPT-4.1 nano' },
    'gpt-4o':       { input: 2.5,  output: 10,   label: 'GPT-4o' },
    'gpt-4o-mini':  { input: 0.15, output: 0.6,  label: 'GPT-4o mini' },
    'o3':           { input: 2,    output: 8,     label: 'o3' },
    'o3-mini':      { input: 1.1,  output: 4.4,   label: 'o3 mini' },
    'o4-mini':      { input: 1.1,  output: 4.4,   label: 'o4-mini' },
    'o1':           { input: 15,   output: 60,    label: 'o1' },
    'o1-mini':      { input: 1.1,  output: 4.4,   label: 'o1 mini' },
    'gpt-4-turbo':  { input: 10,   output: 30,    label: 'GPT-4 Turbo' },
    'gpt-4':        { input: 30,   output: 60,    label: 'GPT-4' },
    'gpt-3.5-turbo':{ input: 0.5,  output: 1.5,   label: 'GPT-3.5' },
  },

  modelPatterns: [
    { pattern: /gpt-4\.1-nano/i, key: 'gpt-4.1-nano' },
    { pattern: /gpt-4\.1-mini/i, key: 'gpt-4.1-mini' },
    { pattern: /gpt-4\.1/i,      key: 'gpt-4.1' },
    { pattern: /gpt-4o-mini/i,  key: 'gpt-4o-mini' },
    { pattern: /gpt-4o/i,       key: 'gpt-4o' },
    { pattern: /o4-mini/i,      key: 'o4-mini' },
    { pattern: /o3-mini/i,      key: 'o3-mini' },
    { pattern: /o3/i,           key: 'o3' },
    { pattern: /o1-mini/i,      key: 'o1-mini' },
    { pattern: /o1/i,           key: 'o1' },
    { pattern: /gpt-4-turbo/i,  key: 'gpt-4-turbo' },
    { pattern: /gpt-4/i,        key: 'gpt-4' },
    { pattern: /gpt-3\.5/i,     key: 'gpt-3.5-turbo' },
  ],

  resolveModel(modelName) {
    for (const { pattern, key } of this.modelPatterns) {
      if (pattern.test(modelName)) return this.models[key];
    }
    return this.models['gpt-4o'];
  },

  getModelLabel(modelName) {
    return this.resolveModel(modelName).label;
  },

  /**
   * OpenAI API 응답 형식의 JSONL에서 usage를 추출한다.
   * 지원 형식:
   *   1) OpenAI Chat Completion 응답 ({ object: "chat.completion", usage: { ... } })
   *   2) litellm/aider 스타일 로그 ({ model, usage: { prompt_tokens, completion_tokens } })
   */
  parseLogLine(entry) {
    const usage = entry?.usage || entry?.response?.usage;
    if (!usage) return null;

    const model = entry.model || entry.response?.model || 'unknown';

    // OpenAI 모델인지 확인
    const isOpenAI = /gpt|o[1-4]|davinci|turbo/i.test(model);
    if (!isOpenAI) return null;

    return {
      provider: 'openai',
      model,
      inputTokens: usage.prompt_tokens || usage.input_tokens || 0,
      outputTokens: usage.completion_tokens || usage.output_tokens || 0,
      cacheCreationTokens: 0,
      cacheReadTokens: usage.cached_tokens || 0,
      timestamp: entry.timestamp || entry.created
        ? new Date((entry.created || 0) * 1000).toISOString()
        : new Date().toISOString(),
      sessionId: entry.id || 'unknown',
    };
  },

  extractUserText(entry) {
    // OpenAI 로그에서 사용자 메시지 추출 시도
    const messages = entry?.messages || entry?.request?.messages;
    if (!Array.isArray(messages)) return null;

    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        const content = messages[i].content;
        if (typeof content === 'string' && content.length > 3) return content;
      }
    }
    return null;
  },

  calculateCost(usage) {
    const pricing = this.resolveModel(usage.model);
    return (usage.inputTokens / 1e6) * pricing.input
         + (usage.outputTokens / 1e6) * pricing.output;
  },
};
