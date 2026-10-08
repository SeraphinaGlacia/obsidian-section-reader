const translations = {
  en: {
    viewName: "Section Reader",
    ribbon: "Toggle Section Reader",
    toggle: "Toggle section focus",
    next: "Next section",
    previous: "Previous section",
    cardLabel: (current: number, total: number): string => `Section ${current} of ${total}`,
  },
  zh: {
    viewName: "Section Reader",
    ribbon: "切换 Section Reader",
    toggle: "切换分节聚焦",
    next: "下一节",
    previous: "上一节",
    cardLabel: (current: number, total: number): string => `第 ${current} 节，共 ${total} 节`,
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
