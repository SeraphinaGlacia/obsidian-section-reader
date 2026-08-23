const translations = {
  en: {
    viewName: "Focus Cards",
    ribbon: "Toggle Focus Cards",
    toggle: "Toggle card browsing mode",
    next: "Next card",
    previous: "Previous card",
    cardLabel: (current: number, total: number): string => `Card ${current} of ${total}`,
  },
  zh: {
    viewName: "专注卡片",
    ribbon: "切换专注卡片",
    toggle: "切换卡片浏览模式",
    next: "下一张卡片",
    previous: "上一张卡片",
    cardLabel: (current: number, total: number): string => `第 ${current} 张，共 ${total} 张`,
  },
} as const;

export type Translations = (typeof translations)[keyof typeof translations];
export type DisplayLanguage = keyof typeof translations;

export function resolveDisplayLanguage(language: string): DisplayLanguage {
  const normalized = language.trim().toLowerCase();
  return normalized === "zh" || normalized.startsWith("zh-") || normalized.startsWith("zh_")
    ? "zh"
    : "en";
}

export function translationsForLanguage(language: string): Translations {
  return translations[resolveDisplayLanguage(language)];
}
