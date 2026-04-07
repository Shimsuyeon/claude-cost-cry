# 🪙 claude-cost-cry

[![npm version](https://img.shields.io/npm/v/claude-cost-cry.svg)](https://www.npmjs.com/package/claude-cost-cry)
[![license](https://img.shields.io/npm/l/claude-cost-cry.svg)](LICENSE)
[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-ffdd00?style=flat&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/shimsuyeon)

> AI 비용으로 얇아지는 내 지갑을 실시간으로 살펴보세요 (ㅠㅠ)

숫자로 보면 무감각한 API 비용을, **아이스 아메리카노와 치킨으로 환산하면 아프다.**

[English](README.md)

```bash
npm install -g claude-cost-cry
```

<div align="center">
<img width="320" alt="overlay" src="https://github.com/user-attachments/assets/fd8da839-cad9-4b15-998a-7b5eb4a93b9b" />
</div>

API 비용이 날아가는 순간을 감정 메시지, 일상 환산, 플로팅 위젯으로 체감시켜줍니다.

## 빠른 시작

```bash
cost-cry          # 플로팅 오버레이 위젯 실행
```

이게 끝입니다. 화면 오른쪽 위에 위젯이 뜨고 바로 추적을 시작합니다.

> macOS에서 처음 실행 시 `xattr -cr node_modules/electron/dist/Electron.app` 실행이 필요할 수 있습니다.

## 기능

### 플로팅 오버레이 위젯

<div>
<img width="300" alt="panels" src="https://github.com/user-attachments/assets/ffd41048-6576-4a68-854a-0642b89acee5" />
<img width="300" alt="panels" src="https://github.com/user-attachments/assets/5d84231b-27eb-45a4-80a5-2da6de4162ae" />
</div>

- 비용 구간에 따라 이모지와 글자 색상 변경
- 새 API 호출 시 바운스 애니메이션 + 비용 플래시
- $30 이상이면 위젯이 흔들림
- 드래그로 위치 이동, 시스템 트레이에서 열기/닫기
- 확장 패널: 일별 차트, 모델별 비용, TOP 3 비싼 요청
- 설정 패널: 예산, 통화, 언어, 환산 단위, 원클릭 업데이트

### 비용 구간별 감정 이펙트

| 비용 구간 | 이모지 | 기분 | 메시지 예시 |
|-----------|-------|------|------------|
| $0 ~ $1 | 🪙 | 평화 | "아직 괜찮아요, 이 정도는 공기값이죠" |
| $1 ~ $5 | 💸 | 불안 | "슬슬 자판기 커피값이 되어가네요..." |
| $5 ~ $10 | 🔥 | 걱정 | "이거 진짜 괜찮은 건가요...?" |
| $10 ~ $30 | 🚨 | 경고 | "클로드한테 월급을 주는 건가..." |
| $30 ~ $100 | 💀 | 공포 | "은행 잔고가 비명을 지르고 있습니다" |
| $100+ | ⚰️ | 장례식 | "🚨 경고: 이 API 키는 불에 타고 있습니다 🚨" |

### 멀티 프로바이더 지원

여러 LLM 프로바이더의 비용을 함께 추적합니다:
- 🟣 **Claude Code** — 자동 (로컬 JSONL 로그)
- ⚡ **Cursor IDE** — API 폴링 (`cost-cry config --add-source cursor`)
- 🟢 **OpenAI** — 로컬 로그 (`cost-cry config --add-source openai:/path/to/logs`)
- 🔵 **Google Gemini** — 로컬 로그 (`cost-cry config --add-source google:/path/to/logs`)

### 일상 환산

비용을 일상적인 단위로 환산합니다 — "$3.50"은 아무 감흥 없지만, "🍲 뜨끈한 국밥 0.6그릇"은 아프니까:

☕ 아이스 아메리카노 · 🍢 떡볶이 · 🍲 뜨끈한 국밥 · 🍱 점심 한 끼 · 🍗 치킨 · 📺 넷플릭스 · 🥤 프라푸치노

CLI 또는 오버레이 설정에서 변경 가능. 커스텀 단위도 추가할 수 있습니다.

## CLI

```bash
cost-cry cli                       # 터미널 실시간 추적
cost-cry report                    # 주간 리포트
cost-cry report --monthly          # 월간 리포트
cost-cry config                    # 현재 설정 보기
cost-cry config --daily-budget 10  # 일일 예산 $10 설정
cost-cry config --currency KRW     # 표시 통화 변경
cost-cry config --language ko      # 한국어로 전환
cost-cry config --nudge off        # 절약 넛지 끄기
```

<details>
<summary>CLI 출력 예시</summary>

```
$ cost-cry cli

  🪙 claude-cost-cry v0.3.3
  당신의 API 비용을 감정적으로 체감시켜드립니다

  📊 오늘 누적: $2.41 (☕ 아이스 아메리카노 0.8잔)
     API 호출 12건

  ────────────────────────────────────────────────────────
  감시 중... (Ctrl+C로 종료)
  ────────────────────────────────────────────────────────

  [14:32:15] Opus  📥 15.2K 📤 1.2K
  🔥 +$0.38  →  누적: $8.73  🍗 0.5마리
     "이 돈이면 고급 뷔페를 갈 수 있었는데..."

  [14:35:22] Sonnet  📥 8.3K 📤 2.1K
  💸 +$0.06  →  누적: $8.79  🍗 0.5마리
     "지갑이 울고 있어요 진짜로"
```

</details>

### 예산 알림

예산을 설정하면:
- 70% 도달 시 💡 경고, 90% 시 ⚠️ 경고, 100% 초과 시 🚫 경고

### 절약 넛지

API 호출 시 더 저렴한 모델을 썼으면 얼마를 아낄 수 있었는지 실시간으로 보여줍니다:

```
  💡 Haiku로 했으면 $0.02 ($0.36 절약)
```

## 작동 원리

Claude Code는 API 호출 로그를 `~/.claude/projects/` 아래에 JSONL 파일로 저장합니다. cost-cry는 이 로그 파일을 실시간으로 감시하며 토큰 사용량을 추출하고 공식 가격표를 기반으로 비용을 계산합니다.

**프록시나 API 키가 필요 없습니다.** 로컬 로그 파일만 읽습니다 (또는 Cursor 내부 API 폴링).

## 지원 모델 & 가격

| 모델 | 입력 ($/1M) | 출력 ($/1M) |
|------|-----------|-----------|
| Claude Opus | $15.00 | $75.00 |
| Claude Sonnet | $3.00 | $15.00 |
| Claude Haiku | $0.80 | $4.00 |
| GPT-4o | $2.50 | $10.00 |
| GPT-4o mini | $0.15 | $0.60 |
| Gemini 2.5 Pro | $1.25 | $10.00 |
| Gemini Flash | $0.075 | $0.30 |

캐시 토큰도 자동 반영됩니다 (쓰기: 1.25x, 읽기: 0.1x).

## 요구 사항

- Node.js >= 18
- Claude Code 설치 (`~/.claude/` 디렉토리) 또는 기타 지원 프로바이더

## 면책 조항

이 도구의 비용 계산은 **참고용**입니다. 정확한 과금 금액은 [Anthropic 대시보드](https://console.anthropic.com/)에서 확인하세요.

## 후원

이 도구가 심장마비를 막아줬다면, 커피 한 잔 사주세요:

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-ffdd00?style=flat&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/shimsuyeon)

## 라이선스

MIT
