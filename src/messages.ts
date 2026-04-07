interface MessageEntry {
  emoji: string;
  message: string;
}

interface MessageTier {
  threshold: number;
  emoji: string;
  messages: string[];
  tierClass: string;
}

const TIERS: MessageTier[] = [
  {
    threshold: 0,
    emoji: '😊',
    messages: [
      '아직 괜찮아요, 이 정도는 공기값이죠',
      '가벼운 산책 같은 비용이네요',
      '동전 하나 떨어진 수준',
    ],
    tierClass: 'peace',
  },
  {
    threshold: 1,
    emoji: '😅',
    messages: [
      '슬슬 자판기 커피값이 되어가네요...',
      '점심을 라면으로 바꿔야 할 수도...',
      '아직은... 괜찮다고... 믿고 싶어요',
      '동네 카페 아메리카노 한 잔 값이네요',
    ],
    tierClass: 'sweat',
  },
  {
    threshold: 5,
    emoji: '😰',
    messages: [
      '이거 진짜 괜찮은 건가요...?',
      '택시 한 번 타는 값이잖아요...',
      '치킨을 시킬 수 있었는데...',
      '배달 앱을 열었다가 API 비용 생각에 닫았어요',
    ],
    tierClass: 'worry',
  },
  {
    threshold: 15,
    emoji: '😱',
    messages: [
      '이 돈이면 고급 뷔페를 갈 수 있었는데...',
      '지갑이 울고 있어요 진짜로',
      '클로드한테 월급을 주는 건가...',
      '이 비용을 상사가 알면...',
      'API 키를 냉동실에 보관해야 할 것 같아요',
    ],
    tierClass: 'panic',
  },
  {
    threshold: 50,
    emoji: '💀',
    messages: [
      '💸 현금이 타는 냄새가 나요...',
      '은행 잔고가 비명을 지르고 있습니다',
      '이 비용으로 주말여행을 갈 수 있었어요...',
      '퇴사각인가요... API 비용이 월급을 넘을 것 같아요',
      '가계부 앱이 강제 종료됐습니다',
    ],
    tierClass: 'dead',
  },
  {
    threshold: 100,
    emoji: '🔥',
    messages: [
      '🚨 경고: 이 API 키는 불에 타고 있습니다 🚨',
      '카드사에서 전화가 올 수 있습니다',
      '이 비용은 당신의 미래에서 빌려온 겁니다',
      '클로드가 당신의 지갑을 학습 데이터로 사용 중...',
      '이걸로 비트코인을 살 수 있었는데...',
    ],
    tierClass: 'fire',
  },
];

function getTierIndex(cost: number): number {
  let idx = 0;
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (cost >= TIERS[i].threshold) {
      idx = i;
      break;
    }
  }
  return idx;
}

export function getMessage(cost: number): MessageEntry {
  const tier = TIERS[getTierIndex(cost)];
  const msg = tier.messages[Math.floor(Math.random() * tier.messages.length)];
  return { emoji: tier.emoji, message: msg };
}

export function getTier(cost: number): string {
  return TIERS[getTierIndex(cost)].tierClass;
}

export function getStartupMood(cost: number): string {
  if (cost < 1) return '☀️ 오늘은 아직 평화롭네요!';
  if (cost < 5) return '🌤️ 조금씩 쓰고 있네요...';
  if (cost < 15) return '⛅ 슬슬 긴장되는 금액이에요';
  if (cost < 50) return '🌧️ 지갑이 조금 아파하고 있어요...';
  return '⛈️ 폭풍 소비 중... 조심하세요!';
}

export function getEmoji(cost: number): string {
  return TIERS[getTierIndex(cost)].emoji;
}
