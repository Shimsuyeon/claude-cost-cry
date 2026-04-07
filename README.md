# 🪙 claude-cost-cry

[![npm version](https://img.shields.io/npm/v/claude-cost-cry.svg)](https://www.npmjs.com/package/claude-cost-cry)
[![license](https://img.shields.io/npm/l/claude-cost-cry.svg)](LICENSE)
[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-ffdd00?style=flat&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/shimsuyeon)

> Your wallet cries every time you call Claude. Watch it happen in real-time.

[한국어](README.ko.md)

```bash
npm install -g claude-cost-cry
```

<div align="center">
<img width="320" alt="overlay" src="https://github.com/user-attachments/assets/fd8da839-cad9-4b15-998a-7b5eb4a93b9b" />
</div>

A floating desktop widget that makes you _feel_ every dollar leaving your wallet — with emotional messages, everyday equivalents, and real-time cost tracking.

## Quick Start

```bash
cost-cry          # Launch floating overlay widget
```

That's it. The widget appears in the top-right corner and starts tracking immediately.

> On macOS, you may need to run `xattr -cr node_modules/electron/dist/Electron.app` on first launch.

## Features

### Floating Overlay Widget

<div>
<img width="300" alt="panels" src="https://github.com/user-attachments/assets/ffd41048-6576-4a68-854a-0642b89acee5" />
<img width="300" alt="panels" src="https://github.com/user-attachments/assets/5d84231b-27eb-45a4-80a5-2da6de4162ae" />
</div>

- Emoji and color change based on cost tier
- Bounce animation + cost flash on new API calls
- Widget shakes when cost exceeds $30
- Drag to reposition, toggle from system tray
- Expandable panels: daily chart, model breakdown, top 3 expensive requests
- Settings panel: budget, currency, language, equivalent unit, one-click update

### Emotional Cost Tiers

| Cost Range | Emoji | Mood    | Example Message                                         |
| ---------- | ----- | ------- | ------------------------------------------------------- |
| $0 – $1    | 🪙    | Peace   | "No worries, this is practically free"                  |
| $1 – $5    | 💸    | Uneasy  | "Starting to cost as much as vending machine coffee..." |
| $5 – $10   | 🔥    | Worry   | "Is this really okay...?"                               |
| $10 – $30  | 🚨    | Alert   | "Am I paying Claude a salary...?"                       |
| $30 – $100 | 💀    | Danger  | "The bank account is screaming"                         |
| $100+      | ⚰️    | Funeral | "🚨 WARNING: This API key is on fire 🚨"                |

### Multi-Provider Support

Track costs across multiple LLM providers:

- 🟣 **Claude Code** — automatic (local JSONL logs)
- ⚡ **Cursor IDE** — API polling (`cost-cry config --add-source cursor`)
- 🟢 **OpenAI** — local logs (`cost-cry config --add-source openai:/path/to/logs`)
- 🔵 **Google Gemini** — local logs (`cost-cry config --add-source google:/path/to/logs`)

### Everyday Equivalents

Your cost is converted into relatable items — because "$3.50" means nothing, but "🍲 Gukbap 0.6" hurts:

☕ Iced Americano · 🍢 Tteokbokki · 🍲 Gukbap · 🍱 Lunch · 🍗 Fried Chicken · 📺 Netflix · 🥤 Frappuccino

Customizable via CLI or overlay settings. Add your own units too.

## CLI

```bash
cost-cry cli                       # Real-time terminal tracking
cost-cry report                    # Weekly report
cost-cry report --monthly          # Monthly report
cost-cry config                    # View current settings
cost-cry config --daily-budget 10  # Set daily budget ($10)
cost-cry config --currency KRW     # Switch display currency
cost-cry config --language ko      # Switch to Korean
cost-cry config --nudge off        # Disable savings nudge
```

<details>
<summary>CLI output example</summary>

```
$ cost-cry cli

  🪙 claude-cost-cry v0.3.3
  Emotionally experience your API costs

  📊 Today's total: $2.41 (☕ Iced Americano 0.8)
     12 API calls

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

</details>

### Budget Alerts

When a budget is set:

- 70% → 💡 warning, 90% → ⚠️ warning, 100% → 🚫 exceeded

### Savings Nudge

Shows how much you could save using a cheaper model — in real time:

```
  💡 Would be $0.02 with Haiku (save $0.36)
```

## How It Works

Claude Code saves API call logs as JSONL files under `~/.claude/projects/`. cost-cry watches these files in real time, extracts token usage, and calculates cost based on official pricing.

**No proxy or API key required.** Only reads local log files (or polls Cursor's internal API).

## Supported Models & Pricing

| Model          | Input ($/1M) | Output ($/1M) |
| -------------- | ------------ | ------------- |
| Claude Opus    | $15.00       | $75.00        |
| Claude Sonnet  | $3.00        | $15.00        |
| Claude Haiku   | $0.80        | $4.00         |
| GPT-4o         | $2.50        | $10.00        |
| GPT-4o mini    | $0.15        | $0.60         |
| Gemini 2.5 Pro | $1.25        | $10.00        |
| Gemini Flash   | $0.075       | $0.30         |

Cache tokens are automatically reflected (write: 1.25x, read: 0.1x).

## Requirements

- Node.js >= 18
- Claude Code installed (`~/.claude/` directory) or another supported provider

## Disclaimer

Cost calculations are **estimates for reference**. For exact billing, check the [Anthropic Dashboard](https://console.anthropic.com/).

## Support

If this tool saved you from a heart attack, consider buying me a coffee:

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-ffdd00?style=flat&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/shimsuyeon)

## License

MIT
