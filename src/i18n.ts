import en from './locales/en.js';
import ko from './locales/ko.js';
import { loadConfig } from './config.js';

export type Locale = 'en' | 'ko';
type LocaleStrings = typeof en;

const locales: Record<Locale, LocaleStrings> = { en, ko };

let currentLocale: Locale | null = null;

export function getLocale(): Locale {
  if (currentLocale) return currentLocale;
  const config = loadConfig();
  currentLocale = (config.language as Locale) || 'en';
  return currentLocale;
}

export function setLocale(lang: Locale): void {
  currentLocale = lang;
}

export function resetLocale(): void {
  currentLocale = null;
}

export function t(key: string, params?: Record<string, string | number>): string {
  const locale = getLocale();
  const strings = locales[locale] || locales.en;
  let text = strings[key as keyof LocaleStrings] ?? locales.en[key as keyof LocaleStrings] ?? key;

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }

  return text;
}

export function getLocaleStrings(lang?: Locale): LocaleStrings {
  const l = lang || getLocale();
  return locales[l] || locales.en;
}
