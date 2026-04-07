import { t } from './i18n.js';

interface MessageEntry {
  emoji: string;
  message: string;
}

interface MessageTier {
  threshold: number;
  emoji: string;
  messageKeys: string[];
  tierClass: string;
}

const TIERS: MessageTier[] = [
  {
    threshold: 0,
    emoji: '😊',
    messageKeys: ['tier.0.0', 'tier.0.1', 'tier.0.2'],
    tierClass: 'peace',
  },
  {
    threshold: 1,
    emoji: '😅',
    messageKeys: ['tier.1.0', 'tier.1.1', 'tier.1.2', 'tier.1.3'],
    tierClass: 'sweat',
  },
  {
    threshold: 5,
    emoji: '😰',
    messageKeys: ['tier.2.0', 'tier.2.1', 'tier.2.2', 'tier.2.3'],
    tierClass: 'worry',
  },
  {
    threshold: 15,
    emoji: '😱',
    messageKeys: ['tier.3.0', 'tier.3.1', 'tier.3.2', 'tier.3.3', 'tier.3.4'],
    tierClass: 'panic',
  },
  {
    threshold: 50,
    emoji: '💀',
    messageKeys: ['tier.4.0', 'tier.4.1', 'tier.4.2', 'tier.4.3', 'tier.4.4'],
    tierClass: 'dead',
  },
  {
    threshold: 100,
    emoji: '🔥',
    messageKeys: ['tier.5.0', 'tier.5.1', 'tier.5.2', 'tier.5.3', 'tier.5.4'],
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
  const keys = tier.messageKeys;
  const key = keys[Math.floor(Math.random() * keys.length)];
  return { emoji: tier.emoji, message: t(key) };
}

export function getTier(cost: number): string {
  return TIERS[getTierIndex(cost)].tierClass;
}

export function getStartupMood(cost: number): string {
  if (cost < 1) return t('mood.peace');
  if (cost < 5) return t('mood.light');
  if (cost < 15) return t('mood.cloudy');
  if (cost < 50) return t('mood.rain');
  return t('mood.storm');
}

export function getEmoji(cost: number): string {
  return TIERS[getTierIndex(cost)].emoji;
}
