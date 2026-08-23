export function formatCounter(index: number, total: number): string {
  return `${index + 1}/${total}`;
}

export function formatViewTitle(
  file: { basename: string } | null | undefined,
  viewName: string,
): string {
  return file === null || file === undefined ? viewName : `${file.basename} — ${viewName}`;
}

export function navigationDirectionForKey(key: string): -1 | 0 | 1 {
  if (key === "ArrowLeft") return -1;
  if (key === "ArrowRight") return 1;
  return 0;
}

export function detectReadableLineWidth(root: Element): boolean {
  return (
    root.classList.contains("is-readable-line-width") ||
    root.querySelector(".is-readable-line-width") !== null
  );
}

export function setReadableLineWidth(element: Element, enabled: boolean): void {
  element.classList.toggle("is-readable-line-width", enabled);
}

export function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return target.closest(
    "a, button, input, textarea, select, option, [contenteditable='true'], pre, code, .table-wrapper",
  ) !== null;
}

export function hasActiveTextSelection(selection: Selection | null = window.getSelection()): boolean {
  return selection !== null && !selection.isCollapsed && selection.toString().length > 0;
}

export function internalLinkFromEvent(event: MouseEvent): HTMLAnchorElement | null {
  if (event.button !== 0 || !(event.target instanceof Element)) return null;
  const anchor = event.target.closest("a.internal-link");
  return anchor instanceof HTMLAnchorElement ? anchor : null;
}

export function internalLinkFromHoverEvent(event: MouseEvent): HTMLAnchorElement | null {
  if (!(event.target instanceof Element)) return null;
  const anchor = event.target.closest("a.internal-link");
  if (!(anchor instanceof HTMLAnchorElement)) return null;
  if (event.relatedTarget instanceof Node && anchor.contains(event.relatedTarget)) return null;
  return anchor;
}

export function internalLinkText(anchor: HTMLAnchorElement): string | null {
  const dataHref = anchor.dataset.href;
  if (dataHref !== undefined && dataHref.length > 0) return dataHref;
  const href = anchor.getAttribute("href");
  return href !== null && href.length > 0 ? href : null;
}

export function setCardAccessibility(
  cards: readonly HTMLElement[],
  activeIndex: number,
  label: (current: number, total: number) => string,
): void {
  cards.forEach((card, index) => {
    const active = index === activeIndex;
    card.inert = !active;
    card.setAttribute("aria-hidden", active ? "false" : "true");
    card.tabIndex = active ? 0 : -1;
    card.setAttribute("aria-label", label(index + 1, cards.length));
  });
}
