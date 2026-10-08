const translations = {
  en: {
    viewName: "Section Reader",
    ribbon: "Toggle Section Reader",
    toggle: "Toggle section focus",
    next: "Next section",
    previous: "Previous section",
    nativeModes: "Allow native reading/editing mode switching",
    nativeModesDescription: "Switch between reading and editing while section focus stays on. Takes effect the next time you enter Section Reader.",
    cardLabel: (current: number, total: number): string => `Section ${current} of ${total}`,
  },
  zh: {
    viewName: "Section Reader",
    ribbon: "切换 Section Reader",
    toggle: "切换分节聚焦",
    next: "下一节",
    previous: "上一节",
    nativeModes: "允许切换原生阅读／编辑模式",
    nativeModesDescription: "保持分节聚焦时，可在原生阅读与编辑之间切换。重新进入 Section Reader 后生效。",
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
