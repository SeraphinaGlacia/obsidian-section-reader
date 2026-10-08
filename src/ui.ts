export function eventElement(target: EventTarget | null): Element | null {
  const win = (target as Node | null)?.ownerDocument?.defaultView;
  return win && target instanceof win.Element ? target : null;
}

export function isInteractiveTarget(target: EventTarget | null): boolean {
  return eventElement(target)?.closest(
    "a, button, input, textarea, select, option, [contenteditable='true'], pre, code, table, .table-wrapper",
  ) != null;
}

export function hasActiveTextSelection(selection: Selection | null = window.getSelection()): boolean {
  return selection !== null && !selection.isCollapsed && selection.toString().length > 0;
}

export function internalLinkFromEvent(event: MouseEvent): HTMLAnchorElement | null {
  return event.button === 0 ? eventElement(event.target)?.closest<HTMLAnchorElement>("a.internal-link") ?? null : null;
}
