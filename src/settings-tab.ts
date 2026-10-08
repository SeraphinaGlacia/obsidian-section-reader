import { PluginSettingTab, Setting } from "obsidian";
import type FocusCardsPlugin from "./main";

// A structural type keeps the 1.8.7 build compatible with the newer settings API.
interface NativeModeSetting {
  name: string;
  desc: string;
  control: { type: "toggle"; key: string };
}

export class SectionReaderSettingTab extends PluginSettingTab {
  constructor(private readonly reader: FocusCardsPlugin) { super(reader.app, reader); }

  getSettingDefinitions(): NativeModeSetting[] {
    return [{
      name: this.reader.text.nativeModes,
      desc: this.reader.text.nativeModesDescription,
      control: { type: "toggle", key: "allowNativeModes" },
    }];
  }

  getControlValue(key: string): unknown {
    return key === "allowNativeModes" ? this.reader.allowNativeModes : undefined;
  }

  setControlValue(key: string, value: unknown): void {
    if (key === "allowNativeModes" && typeof value === "boolean") this.reader.setAllowNativeModes(value);
  }

  // Imperative fallback for Obsidian versions before 1.13.0.
  display(): void {
    this.containerEl.empty();
    new Setting(this.containerEl)
      .setName(this.reader.text.nativeModes)
      .setDesc(this.reader.text.nativeModesDescription)
      .addToggle(toggle => toggle
        .setValue(this.reader.allowNativeModes)
        .onChange(value => this.reader.setAllowNativeModes(value)));
  }
}
