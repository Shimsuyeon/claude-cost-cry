# 🪙 claude-cost-cry

[![npm version](https://img.shields.io/npm/v/claude-cost-cry.svg)](https://www.npmjs.com/package/claude-cost-cry)
[![license](https://img.shields.io/npm/l/claude-cost-cry.svg)](LICENSE)

> Your wallet cries every time you call Claude. Watch it happen in real-time.
> AI 비용으로 얇아지는 내 지갑을 실시간으로 살펴보세요 (ㅠㅠ)

[한국어](README.ko.md)

## What is this?

A real-time cost tracker for Claude Code (and other LLM providers) that makes you *feel* every dollar leaving your wallet — with emotional messages, everyday equivalents, and a floating desktop widget.

```
$ cost-cry

  🪙 claude-cost-cry v0.3.0
  Emotionally experience your API costs

  📊 Today's total: $2.41 (☕ Iced Americano 0.5)
     12 API calls
     🌤️ Starting to spend a bit...

  ────────────────────────────────────────────────────────
  Watching... (Ctrl+C to exit)
  ────────────────────────────────────────────────────────

  [14:32:15] Opus  📥 15.2K 📤 1.2K
  🔥 +$0.38  →  Total: $8.73  🍗 0.5
     "Could've gone to a fancy buffet with this money..."

  [14:35:22] Sonnet  📥 8.3K 📤 2.1K
  💸 +$0.06  →  Total: $8.79  🍗 0.5
     "Your wallet is literally crying"
```

## Emotional Cost Tiers

| Cost Range | Emoji | Mood | Example Message |
|-----------|-------|------|-----------------|
| $0 – $1 | 🪙 | Peace | "No worries, this is practically free" |
| $1 – $5 | 💸 | Uneasy | "Starting to cost as much as vending machine coffee..." |
| $5 – $10 | 🔥 | Worry | "Is this really okay...?" |
| $10 – $30 | 🚨 | Alert | "Am I paying Claude a salary...?" |
| $30 – $100 | 💀 | Danger | "The bank account is screaming" |
| $100+ | ⚰️ | Funeral | "🚨 WARNING: This API key is on fire 🚨" |

## Installation

```bash
npm install -g claude-cost-cry
```

> **[npm package](https://www.npmjs.com/package/claude-cost-cry)** · Requires Node.js >= 18

## Usage

### Overlay Mode (Floating Widget) — Default

```bash
cost-cry
```

Launches a floating desktop widget (top-right corner) that tracks costs in real time:
- Emoji and color change based on cost tier
- Bounce animation + cost flash on new API calls
- Widget shakes when cost exceeds $30
- Toggle from system tray
- Drag to reposition
- Expandable panels: daily chart, model breakdown, top 3 expensive requests, settings

> On macOS, you may need to run `xattr -cr node_modules/electron/dist/Electron.app` on first launch.

### CLI Mode (Terminal)

```bash
cost-cry cli
```

Real-time tracking in your terminal:
1. Scans today's accumulated cost
2. Watches for new Claude Code API calls in real time
3. Displays cost + emotional message on each call
4. Shows session summary on `Ctrl+C` exit

### Reports

```bash
cost-cry report            # Weekly report
cost-cry report --monthly  # Monthly report
```

ASCII bar charts with per-day costs, model breakdown, and savings simulation.

### Configuration

```bash
cost-cry config                     # View current settings
cost-cry config --daily-budget 10   # Set daily budget ($10)
cost-cry config --daily-budget off  # Remove budget
cost-cry config --currency KRW      # Switch display currency
cost-cry config --nudge off         # Disable savings nudge
cost-cry config --language ko       # Switch to Korean
cost-cry config --add-source cursor # Track Cursor IDE usage
```

#### Budget Alerts

When a budget is set:
- 70% → 💡 warning, 90% → ⚠️ warning, 100% → 🚫 exceeded
- Displayed in both CLI and overlay widget

#### Savings Nudge

Shows how much you could save using a cheaper model — in real time:

```
  [14:32:15] Opus  📥 15.2K 📤 1.2K
  🔥 +$0.38  →  Total: $8.73
     💡 Would be $0.02 with Haiku (save $0.36)
```

#### Multi-Provider Support

Track costs across multiple LLM providers:
- 🟣 **Claude Code** — automatic (local JSONL logs)
- ⚡ **Cursor IDE** — API polling (`cost-cry config --add-source cursor`)
- 🟢 **OpenAI** — local logs (`cost-cry config --add-source openai:/path/to/logs`)
- 🔵 **Google Gemini** — local logs (`cost-cry config --add-source google:/path/to/logs`)

#### Language

Default language is **English**. Switch to Korean:

```bash
cost-cry config --language ko
```

Also available in the overlay settings panel.

## How It Works

Claude Code saves all API call logs as JSONL files under `~/.claude/projects/`. cost-cry watches these files in real time:

1. Extracts token usage from the `usage` field of assistant responses
2. Calculates cost based on official model pricing
3. Displays emotional messages based on cost tier

**No proxy or API key required.** Only reads local log files (or polls Cursor's internal API).

## Supported Models & Pricing

| Model | Input ($/1M) | Output ($/1M) |
|-------|-------------|---------------|
| Claude Opus | $15.00 | $75.00 |
| Claude Sonnet | $3.00 | $15.00 |
| Claude Haiku | $0.80 | $4.00 |
| GPT-4o | $2.50 | $10.00 |
| GPT-4o mini | $0.15 | $0.60 |
| Gemini 2.5 Pro | $1.25 | $10.00 |
| Gemini Flash | $0.075 | $0.30 |

Cache tokens are automatically reflected (write: 1.25x, read: 0.1x).

## Requirements

- Node.js >= 18
- Claude Code installed (`~/.claude/` directory) or another supported provider

## Disclaimer

Cost calculations are **estimates for reference**. For exact billing, check the [Anthropic Dashboard](https://console.anthropic.com/).

## License

MIT

