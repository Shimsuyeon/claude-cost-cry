/**
 * 비용 구간별 감정 이펙트 메시지 시스템
 *
 * | 구간       | 감정       |
 * |-----------|-----------|
 * | $0 ~ $1   | 평화로움    |
 * | $1 ~ $5   | 살짝 불안   |
 * | $5 ~ $10  | 걱정       |
 * | $10 ~ $30 | 경고       |
 * | $30 ~ $100| 공포       |
 * | $100+     | 장례식      |
 */

const TIERS = [
  {
    max: 1,
    emoji: '🪙',
    prefix: '',
    messages: [
      '아직은 괜찮아... 커피 한 모금 값이야.',
      '동전 하나 날아갔어요~',
      '지갑이 평화롭습니다.',
      '새의 깃털처럼 가벼운 비용이네요.',
      '이 정도면 자판기 커피 한 잔?',
      '지갑: "...아직 괜찮아"',
    ],
  },
  {
    max: 5,
    emoji: '💸',
    prefix: '',
    messages: [
      '아이스 아메리카노 한 잔이 증발했습니다.',
      '지갑에서 바람이 불기 시작합니다...',
      '슬슬 커피값이 나가고 있어요.',
      '편의점 삼각김밥 몇 개가 사라졌습니다.',
      '지갑이 살짝 가벼워지는 느낌...',
      '아직은... 괜찮다고... 해두죠.',
    ],
  },
  {
    max: 10,
    emoji: '🔥',
    prefix: '',
    messages: [
      '오늘 점심값이 날아갔습니다.',
      '맛있는 점심 한 끼가 연기처럼...',
      '지갑에서 연기가 나기 시작합니다 🔥',
      '이 돈이면 치킨 반 마리는 됐는데...',
      '카드 명세서가 무서워지기 시작합니다.',
      '혹시... Haiku 모델로 바꿔보시는 건...?',
    ],
  },
  {
    max: 30,
    emoji: '🚨',
    prefix: '⚠️ ',
    messages: [
      '당신의 치킨이 울고 있습니다.',
      '🚨 경고: 지갑 잔고가 줄어들고 있습니다.',
      '한 달 넷플릭스비가 날아갔습니다.',
      '당신의 저축 계획이 흔들리고 있습니다.',
      '지갑: "살려줘..."',
      '이 정도면 맛있는 외식 한 번인데...',
      '연말정산에서 이걸 공제받을 수 있다면...',
    ],
  },
  {
    max: 100,
    emoji: '💀',
    prefix: '🔴 ',
    messages: [
      '이번 달 넷플릭스를 해지해야 할 수도 있습니다.',
      '지갑이 위독합니다... 💀',
      '가계부에 이걸 뭐라고 적지...',
      '마트 장보기 한 번이 날아갔습니다.',
      '당신의 카드사가 걱정하고 있습니다.',
      '이 비용을 시급으로 환산하면... 생각하지 말자.',
    ],
  },
  {
    max: Infinity,
    emoji: '⚰️',
    prefix: '☠️ ',
    messages: [
      '여기 개발자의 지갑이 잠들다. (2024-2026)',
      'R.I.P. 💐 당신의 예산',
      '장례식을 준비해야 할 것 같습니다...',
      '이 정도면 항공권을 샀어야 했는데...',
      '축하합니다! 당신은 Anthropic의 VIP 고객입니다.',
      '...이직을 고려해보시는 건 어떨까요?',
    ],
  },
];

export function getTier(totalCost) {
  return TIERS.find((tier) => totalCost < tier.max) || TIERS[TIERS.length - 1];
}

export function getMessage(totalCost) {
  const tier = getTier(totalCost);
  const message = tier.messages[Math.floor(Math.random() * tier.messages.length)];
  return {
    emoji: tier.emoji,
    prefix: tier.prefix,
    message,
  };
}

export function getStartupMood(totalCost) {
  if (totalCost === 0) return '아직 지갑이 평화롭습니다 🕊️';
  if (totalCost < 1) return '오늘은 아직 괜찮아요';
  if (totalCost < 5) return '슬슬 지갑이 가벼워지고 있어요...';
  if (totalCost < 10) return '오늘 좀 쓰셨네요 😅';
  if (totalCost < 30) return '지갑이 울고 있습니다 😢';
  if (totalCost < 100) return '💀 위험 수준입니다';
  return '⚰️ ...묵념';
}
