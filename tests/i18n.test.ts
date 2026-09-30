import { describe, expect, it } from "vitest";
import {
  resolveDisplayLanguage,
  translationsForLanguage,
} from "../src/i18n";

describe("display language selection", () => {
  it.each(["zh", "zh-CN", "zh_TW", " ZH-Hans "])(
    "uses Chinese for %s",
    (language) => {
      expect(resolveDisplayLanguage(language)).toBe("zh");
      expect(translationsForLanguage(language).ribbon).toBe("切换 Section Reader");
      expect(translationsForLanguage(language).toggle).toBe("切换卡片浏览模式");
    },
  );

  it.each(["en", "en-US", "ja", "de", "fr", "", "unknown"])(
    "uses English for %s",
    (language) => {
      expect(resolveDisplayLanguage(language)).toBe("en");
      expect(translationsForLanguage(language).ribbon).toBe("Toggle Section Reader");
      expect(translationsForLanguage(language).toggle).toBe("Toggle card browsing mode");
    },
  );
});
