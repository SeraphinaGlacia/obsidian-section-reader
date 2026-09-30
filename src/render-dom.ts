import type { CardDocument } from "./cards";

function topLevelNode(root: HTMLElement, marker: HTMLElement): ChildNode | null {
  let node: Node = marker;
  while (node.parentNode !== null && node.parentNode !== root) node = node.parentNode;
  return node.parentNode === root ? (node as ChildNode) : null;
}

function containsOnlyMarker(node: Node, marker: HTMLElement): boolean {
  if (node === marker) return true;
  if (node.nodeType === Node.TEXT_NODE) return node.textContent?.trim().length === 0;
  return [...node.childNodes].every((child) => containsOnlyMarker(child, marker));
}

export function splitRenderedDocument(
  root: HTMLElement,
  cardDocument: CardDocument,
  markerPrefix: string,
): DocumentFragment[] | null {
  const boundaryNodes = new Map<ChildNode, number>();

  for (let index = 0; index < cardDocument.breaks.length; index += 1) {
    const marker = root.querySelector<HTMLElement>(
      `[data-focus-cards-marker="${markerPrefix}-${index}"]`,
    );
    if (marker === null) return null;
    const boundary = topLevelNode(root, marker);
    if (
      boundary === null ||
      boundaryNodes.has(boundary) ||
      !containsOnlyMarker(boundary, marker)
    ) {
      return null;
    }
    boundaryNodes.set(boundary, index);
  }

  const rawFragments = cardDocument.segments.map(() => createFragment());
  let segmentIndex = 0;
  for (const node of [...root.childNodes]) {
    const boundaryIndex = boundaryNodes.get(node);
    if (boundaryIndex !== undefined) {
      segmentIndex = boundaryIndex + 1;
      node.remove();
      continue;
    }
    rawFragments[segmentIndex]?.append(node);
  }

  return cardDocument.cards.map((card) => rawFragments[card.segmentIndex]!);
}
