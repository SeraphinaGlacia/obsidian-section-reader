import { CARD_ANIMATION_MS } from "./constants";

/** A passive outgoing snapshot lets the original native view remain interactive. */
export class SectionTransition {
  private snapshot: HTMLElement | null = null;
  private animations: Animation[] = [];
  private frame: number | null = null;
  private timer: number | null = null;
  private readonly win: Window;

  constructor(private readonly container: HTMLElement) {
    this.win = container.ownerDocument.defaultView!;
  }

  prepare(source: HTMLElement, direction: -1 | 1, ready: () => boolean): void {
    this.cancel();
    if (this.container.ownerDocument.hidden || typeof source.animate !== "function" ||
      this.win.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const snapshot = createDiv({ cls: "section-reader-transition section-reader-focus" });
    snapshot.inert = true;
    snapshot.setAttribute("aria-hidden", "true");
    const clone = source.cloneNode(true) as HTMLElement;
    snapshot.append(clone);
    const originals = [source, ...source.querySelectorAll<HTMLElement>("*")];
    const copies = [clone, ...clone.querySelectorAll<HTMLElement>("*")];
    // Never create a second embedded browsing context or run copied script elements.
    clone.querySelectorAll("iframe, webview, object, embed, script, video, audio").forEach((element) => element.remove());
    clone.querySelectorAll("[id]").forEach((element) => {
      // Keep local SVG paint references; HTML navigation anchors belong only to the live view.
      if (element.namespaceURI !== "http://www.w3.org/2000/svg") element.removeAttribute("id");
    });
    this.container.append(snapshot);
    this.snapshot = snapshot;
    // Copy scroll offsets before removing any native view from the visual flow.
    originals.forEach((element, index) => {
      const copy = copies[index];
      if (copy === undefined) return;
      if (element === source || element.matches(".cm-editor, .cm-scroller, .cm-sizer, .cm-content, .markdown-preview-view, .markdown-preview-sizer")) {
        const style = this.win.getComputedStyle(element);
        for (const property of ["padding-top", "padding-right", "padding-bottom", "padding-left", "margin-top", "margin-right", "margin-bottom", "margin-left"]) {
          copy.style.setProperty(property, style.getPropertyValue(property));
        }
      }
      copy.scrollTop = element.scrollTop;
      copy.scrollLeft = element.scrollLeft;
    });
    const started = this.win.performance.now();
    const playWhenReady = (): void => {
      this.frame = null;
      if (this.snapshot !== snapshot) return;
      if (!ready() && this.win.performance.now() - started < 350) {
        this.frame = this.win.requestAnimationFrame(playWhenReady);
        return;
      }
      const options: KeyframeAnimationOptions = { duration: CARD_ANIMATION_MS, easing: "cubic-bezier(0.22, 0.8, 0.3, 1)" };
      this.animations = [
        snapshot.animate([{ transform: "translateX(0)" }, { transform: `translateX(${-direction * 100}%)` }], options),
        source.animate([{ transform: `translateX(${direction * 100}%)` }, { transform: "translateX(0)" }], options),
      ];
      this.timer = this.win.setTimeout(() => this.cancel(), CARD_ANIMATION_MS);
    };
    this.frame = this.win.requestAnimationFrame(playWhenReady);
  }

  cancel(): void {
    if (this.frame !== null) this.win.cancelAnimationFrame(this.frame);
    if (this.timer !== null) this.win.clearTimeout(this.timer);
    this.frame = null;
    this.timer = null;
    this.animations.splice(0).forEach((animation) => animation.cancel());
    this.snapshot?.remove();
    this.snapshot = null;
  }
}
