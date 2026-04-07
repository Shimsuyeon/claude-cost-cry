# 🪙 claude-cost-cry

[![npm version](https://img.shields.io/npm/v/claude-cost-cry.svg)](https://www.npmjs.com/package/claude-cost-cry)
[![license](https://img.shields.io/npm/l/claude-cost-cry.svg)](LICENSE)

> AI 비용으로 얇아지는 내 지갑을 실시간으로 살펴보세요 (ㅠㅠ)

숫자로 보면 무감각한 API 비용을, **아이스 아메리카노와 치킨으로 환산하면 아프다.**

[English](README.md)

## 뭐하는 도구인가요?

Claude Code(및 기타 LLM 프로바이더) 사용 시 실시간으로 비용을 추적하면서, 돈이 날아가는 순간을 감정 메시지, 일상 환산, 플로팅 위젯으로 체감시켜줍니다.


<img width="268" height="132" alt="image" src="https://github.com/user-attachments/assets/73b7a9c8-593c-407c-8c41-a12a1c92cda1" />


```
$ cost-cry

  🪙 claude-cost-cry v0.3.0
  당신의 API 비용을 감정적으로 체감시켜드립니다

  📊 오늘 누적: $2.41 (☕ 아이스 아메리카노 0.5잔)
     API 호출 12건
     🌤️ 조금씩 쓰고 있네요...

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
<div>
<img width="250" alt="image" src="https://github.com/user-attachments/assets/b69e48e0-a212-49c8-b995-19a04a9e0205" />
<img width="250" alt="image" src="https://github.com/user-attachments/assets/ad47eef6-361f-43d9-aa1d-01b4a4e1489d" />
</div>

## 비용 구간별 감정 이펙트

| 비용 구간 | 이모지 | 기분 | 메시지 예시 |
|-----------|-------|------|------------|
| $0 ~ $1 | 🪙 | 평화 | "아직 괜찮아요, 이 정도는 공기값이죠" |
| $1 ~ $5 | 💸 | 불안 | "슬슬 자판기 커피값이 되어가네요..." |
| $5 ~ $10 | 🔥 | 걱정 | "이거 진짜 괜찮은 건가요...?" |
| $10 ~ $30 | 🚨 | 경고 | "클로드한테 월급을 주는 건가..." |
| $30 ~ $100 | 💀 | 공포 | "은행 잔고가 비명을 지르고 있습니다" |
| $100+ | ⚰️ | 장례식 | "🚨 경고: 이 API 키는 불에 타고 있습니다 🚨" |

## 설치

```bash
npm install -g claude-cost-cry
```

> **[npm 패키지](https://www.npmjs.com/package/claude-cost-cry)** · Node.js 18 이상 필요

## 사용법

### 오버레이 모드 (플로팅 위젯) — 기본

```bash
cost-cry
```

화면 오른쪽 위에 떠 있는 위젯으로 실시간 비용을 확인합니다:
- 비용 구간에 따라 이모지와 글자 색상이 변합니다
- 새 API 호출 시 바운스 애니메이션 + 비용 플래시
- $30 이상이면 위젯이 흔들립니다
- 시스템 트레이에서 위젯 열기/닫기 가능
- 드래그로 위치 이동 가능
- 확장 패널: 일별 차트, 모델별 비용, TOP 3 비싼 요청, 설정

> macOS에서 처음 실행 시 `xattr -cr node_modules/electron/dist/Electron.app` 실행이 필요할 수 있습니다.

### CLI 모드 (터미널)

```bash
cost-cry cli
```

터미널에서 실시간 추적:
1. 오늘의 누적 비용을 스캔하여 보여줍니다
2. Claude Code 사용을 실시간으로 감시합니다
3. API 호출이 감지될 때마다 비용과 감정 메시지를 표시합니다
4. `Ctrl+C`로 종료하면 세션 요약을 보여줍니다

### 리포트

```bash
cost-cry report            # 주간 리포트
cost-cry report --monthly  # 월간 리포트
```

일별 비용 ASCII 차트, 모델별 비용 분석, 절약 시뮬레이션을 제공합니다.

### 설정

```bash
cost-cry config                     # 현재 설정 보기
cost-cry config --daily-budget 10   # 일일 예산 $10 설정
cost-cry config --daily-budget off  # 예산 해제
cost-cry config --currency KRW      # 표시 통화 변경
cost-cry config --nudge off         # 절약 넛지 끄기
cost-cry config --language en       # 영어로 전환
cost-cry config --add-source cursor # Cursor IDE 추적
```

#### 예산 알림

예산을 설정하면:
- 70% 도달 시 💡 경고, 90% 시 ⚠️ 경고, 100% 초과 시 🚫 경고
- CLI와 오버레이 위젯 모두에서 표시됩니다

#### 절약 넛지

API 호출 시 더 저렴한 모델을 썼으면 얼마를 아낄 수 있었는지 실시간으로 보여줍니다:

```
  [14:32:15] Opus  📥 15.2K 📤 1.2K
  🔥 +$0.38  →  누적: $8.73
     💡 Haiku로 했으면 $0.02 ($0.36 절약)
```

#### 멀티 프로바이더 지원

여러 LLM 프로바이더의 비용을 함께 추적합니다:
- 🟣 **Claude Code** — 자동 (로컬 JSONL 로그)
- ⚡ **Cursor IDE** — API 폴링 (`cost-cry config --add-source cursor`)
- 🟢 **OpenAI** — 로컬 로그 (`cost-cry config --add-source openai:/path/to/logs`)
- 🔵 **Google Gemini** — 로컬 로그 (`cost-cry config --add-source google:/path/to/logs`)

#### 언어

기본 언어는 **영어**입니다. 한국어로 전환:

```bash
cost-cry config --language ko
```

오버레이 설정 패널에서도 변경 가능합니다.

## 작동 원리

Claude Code는 모든 API 호출 로그를 `~/.claude/projects/` 아래에 JSONL 파일로 저장합니다. cost-cry는 이 로그 파일을 실시간으로 감시하며:

1. 새로운 assistant 응답의 `usage` 필드에서 토큰 사용량을 추출
2. 모델별 공식 가격표를 기반으로 비용을 계산
3. 비용 구간에 맞는 감정 메시지를 표시

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

## 라이선스

MIT
