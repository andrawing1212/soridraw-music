/*
 * Galaxy Tab / coarse-pointer A/B helper for `v2DragPerf=tablet-touch-pure`.
 *
 * Why this exists:
 * - Splitter Only is fast on the real tablet.
 * - Both Content Freeze is much faster than live Pure Pane, which proves that
 *   repeated descendant reflow is the expensive part of the gesture.
 * - Fully freezing content is visually wrong, so this helper keeps the REAL
 *   pane shells/divider on the existing Pure Pane path while pacing only the
 *   expensive inner formatting width.
 *
 * The inner subtree is laid out at a committed width roughly every 40ms.
 * Between those commits a compositor scale bridges the tiny width difference,
 * so the visual pane edge still follows the finger every frame without asking
 * the whole Builder + Result subtree to reflow for every pointer pixel.
 *
 * This is deliberately isolated to the existing admin A/B mode. Production
 * `normal` / PC Pure Pane are untouched until the real Galaxy Tab test passes.
 */

const MODE = 'tablet-touch-pure';
const MODE_ALIAS = 'tablet-pure';
const MIN_SPLIT_PERCENT = 24;
const MAX_SPLIT_PERCENT = 76;
const TABLET_MIN_PANE_PX = 430;
const CONTENT_COMMIT_INTERVAL_MS = 40;
const MAX_VISUAL_SCALE_DRIFT = 0.055;

const BUILDER_BREAKPOINTS = [660, 700, 760, 820, 1074, 1080] as const;
const RESULT_BREAKPOINTS = [660, 661, 680, 1080] as const;

type InlinePropertySnapshot = {
  value: string;
  priority: string;
};

type NodeSnapshot = {
  node: HTMLElement;
  width: InlinePropertySnapshot;
  minWidth: InlinePropertySnapshot;
  maxWidth: InlinePropertySnapshot;
  scale: InlinePropertySnapshot;
  transformOrigin: InlinePropertySnapshot;
  willChange: InlinePropertySnapshot;
  pointerEvents: InlinePropertySnapshot;
};

type Session = {
  workspace: HTMLElement;
  builder: HTMLElement;
  result: HTMLElement;
  builderNodes: NodeSnapshot[];
  resultNodes: NodeSnapshot[];
  layoutLeft: number;
  layoutWidth: number;
  resultExtraWidth: number;
  committedBuilderWidth: number;
  committedResultWidth: number;
  lastCommitTime: number;
  lastResponsiveSignature: string;
  pointerId: number;
  pendingClientX: number | null;
  frameId: number | null;
  fallbackCleanupTimer: number | null;
};

let pendingPointerDown: { pointerId: number; pointerType: string; clientX: number } | null = null;
let session: Session | null = null;

const readInlineProperty = (node: HTMLElement, property: string): InlinePropertySnapshot => ({
  value: node.style.getPropertyValue(property),
  priority: node.style.getPropertyPriority(property),
});

const restoreInlineProperty = (
  node: HTMLElement,
  property: string,
  snapshot: InlinePropertySnapshot,
) => {
  if (snapshot.value) node.style.setProperty(property, snapshot.value, snapshot.priority);
  else node.style.removeProperty(property);
};

const captureNode = (node: HTMLElement): NodeSnapshot => ({
  node,
  width: readInlineProperty(node, 'width'),
  minWidth: readInlineProperty(node, 'min-width'),
  maxWidth: readInlineProperty(node, 'max-width'),
  scale: readInlineProperty(node, 'scale'),
  transformOrigin: readInlineProperty(node, 'transform-origin'),
  willChange: readInlineProperty(node, 'will-change'),
  pointerEvents: readInlineProperty(node, 'pointer-events'),
});

const collectDirectContentNodes = (pane: HTMLElement) => (
  Array.from(pane.children)
    .filter((node): node is HTMLElement => node instanceof HTMLElement)
    .map(captureNode)
);

const setFormattingWidth = (nodes: NodeSnapshot[], width: number) => {
  const px = `${Math.max(1, Math.round(width))}px`;
  for (const { node } of nodes) {
    node.style.setProperty('width', px, 'important');
    node.style.setProperty('min-width', px, 'important');
    node.style.setProperty('max-width', px, 'important');
    node.style.setProperty('scale', '1 1', 'important');
    node.style.setProperty('transform-origin', '0 0', 'important');
    node.style.setProperty('will-change', 'transform', 'important');
    node.style.setProperty('pointer-events', 'none', 'important');
  }
};

const setVisualScale = (nodes: NodeSnapshot[], scaleX: number) => {
  const safeScale = Number.isFinite(scaleX) ? Math.max(0.5, Math.min(1.5, scaleX)) : 1;
  const value = `${safeScale.toFixed(5)} 1`;
  for (const { node } of nodes) node.style.setProperty('scale', value, 'important');
};

const restoreNodes = (nodes: NodeSnapshot[]) => {
  for (const snapshot of nodes) {
    const { node } = snapshot;
    restoreInlineProperty(node, 'width', snapshot.width);
    restoreInlineProperty(node, 'min-width', snapshot.minWidth);
    restoreInlineProperty(node, 'max-width', snapshot.maxWidth);
    restoreInlineProperty(node, 'scale', snapshot.scale);
    restoreInlineProperty(node, 'transform-origin', snapshot.transformOrigin);
    restoreInlineProperty(node, 'will-change', snapshot.willChange);
    restoreInlineProperty(node, 'pointer-events', snapshot.pointerEvents);
  }
};

const currentPerfModeIsTabletTouchPure = () => {
  const value = new URLSearchParams(window.location.search).get('v2DragPerf');
  return value === MODE || value === MODE_ALIAS;
};

const isTouchLikePointer = (pointerType: string) => (
  pointerType === 'touch'
  || pointerType === 'pen'
  || (!pointerType && window.matchMedia('(pointer: coarse)').matches)
);

const getSplitBounds = (layoutWidth: number) => {
  const safeWidth = Math.max(1, layoutWidth);
  const minimumPaneWidth = Math.min(TABLET_MIN_PANE_PX, safeWidth / 2);
  const minimumPercent = (minimumPaneWidth / safeWidth) * 100;
  const min = Math.max(MIN_SPLIT_PERCENT, minimumPercent);
  const max = Math.min(MAX_SPLIT_PERCENT, 100 - minimumPercent);
  return min >= max ? { min: 50, max: 50 } : { min, max };
};

const resolveWidths = (activeSession: Session, clientX: number) => {
  const rawPercent = ((clientX - activeSession.layoutLeft) / activeSession.layoutWidth) * 100;
  const bounds = getSplitBounds(activeSession.layoutWidth);
  const percent = Math.min(bounds.max, Math.max(bounds.min, rawPercent));
  const builderWidth = Math.round(activeSession.layoutWidth * (percent / 100));
  const resultWidth = Math.max(
    1,
    Math.round(activeSession.layoutWidth - builderWidth + activeSession.resultExtraWidth),
  );
  return { builderWidth: Math.max(1, builderWidth), resultWidth };
};

const responsiveBand = (width: number, breakpoints: readonly number[]) => {
  let band = 0;
  for (const breakpoint of breakpoints) {
    if (width <= breakpoint) break;
    band += 1;
  }
  return band;
};

const readResponsiveSignature = (builderWidth: number, resultWidth: number) => (
  `${responsiveBand(builderWidth, BUILDER_BREAKPOINTS)}:${responsiveBand(resultWidth, RESULT_BREAKPOINTS)}`
);

const commitFormattingWidths = (
  activeSession: Session,
  builderWidth: number,
  resultWidth: number,
  now: number,
) => {
  setFormattingWidth(activeSession.builderNodes, builderWidth);
  setFormattingWidth(activeSession.resultNodes, resultWidth);
  activeSession.committedBuilderWidth = builderWidth;
  activeSession.committedResultWidth = resultWidth;
  activeSession.lastCommitTime = now;
  activeSession.lastResponsiveSignature = readResponsiveSignature(builderWidth, resultWidth);
};

const flushFrame = (forceCommit = false) => {
  const activeSession = session;
  if (!activeSession || activeSession.pendingClientX === null) return;

  activeSession.frameId = null;
  const clientX = activeSession.pendingClientX;
  activeSession.pendingClientX = null;
  const now = performance.now();
  const { builderWidth, resultWidth } = resolveWidths(activeSession, clientX);

  const builderScale = builderWidth / Math.max(1, activeSession.committedBuilderWidth);
  const resultScale = resultWidth / Math.max(1, activeSession.committedResultWidth);
  const scaleDrift = Math.max(Math.abs(builderScale - 1), Math.abs(resultScale - 1));
  const nextSignature = readResponsiveSignature(builderWidth, resultWidth);
  const crossedResponsiveBoundary = nextSignature !== activeSession.lastResponsiveSignature;
  const intervalElapsed = now - activeSession.lastCommitTime >= CONTENT_COMMIT_INTERVAL_MS;

  if (forceCommit || crossedResponsiveBoundary || intervalElapsed || scaleDrift >= MAX_VISUAL_SCALE_DRIFT) {
    commitFormattingWidths(activeSession, builderWidth, resultWidth, now);
    return;
  }

  // FLIP-style compositor bridge: outer pane geometry is still owned by the
  // existing Pure Pane rAF. Only the inner formatting tree is temporarily scaled
  // from its last committed width to the new visual width. No DOM geometry read.
  setVisualScale(activeSession.builderNodes, builderScale);
  setVisualScale(activeSession.resultNodes, resultScale);
};

const scheduleFrame = (clientX: number) => {
  const activeSession = session;
  if (!activeSession) return;
  activeSession.pendingClientX = clientX;
  if (activeSession.frameId !== null) return;
  activeSession.frameId = window.requestAnimationFrame(() => flushFrame(false));
};

const cleanupSession = () => {
  const activeSession = session;
  if (!activeSession) return;
  if (activeSession.frameId !== null) window.cancelAnimationFrame(activeSession.frameId);
  if (activeSession.fallbackCleanupTimer !== null) window.clearTimeout(activeSession.fallbackCleanupTimer);
  restoreNodes(activeSession.builderNodes);
  restoreNodes(activeSession.resultNodes);
  delete activeSession.workspace.dataset.tabletPacedContent;
  session = null;
};

const beginSession = () => {
  const pointer = pendingPointerDown;
  if (!pointer || !currentPerfModeIsTabletTouchPure() || !isTouchLikePointer(pointer.pointerType)) return;
  if (window.innerWidth < 1100) return;

  cleanupSession();

  const workspace = document.querySelector<HTMLElement>(
    '.soridraw-lite-studio-split-workspace.is-dragging[data-v2-drag-perf-mode="tablet-touch-pure"]',
  );
  if (!workspace) return;
  const builder = workspace.querySelector<HTMLElement>(':scope > .soridraw-studio-builder-pane');
  const result = workspace.querySelector<HTMLElement>(':scope > .soridraw-studio-result-pane');
  if (!builder || !result) return;

  // One-time drag-start reads only. The pointermove/rAF path below never reads
  // geometry, computed style, scroll metrics or React state.
  const layoutRect = workspace.getBoundingClientRect();
  const builderRect = builder.getBoundingClientRect();
  const resultRect = result.getBoundingClientRect();
  if (layoutRect.width <= 1 || builderRect.width <= 1 || resultRect.width <= 1) return;

  const builderNodes = collectDirectContentNodes(builder);
  const resultNodes = collectDirectContentNodes(result);
  if (builderNodes.length === 0 || resultNodes.length === 0) return;

  const resultExtraWidth = resultRect.width - Math.max(0, layoutRect.width - builderRect.width);
  const now = performance.now();
  const initialBuilderWidth = Math.max(1, Math.round(builderRect.width));
  const initialResultWidth = Math.max(1, Math.round(resultRect.width));

  session = {
    workspace,
    builder,
    result,
    builderNodes,
    resultNodes,
    layoutLeft: layoutRect.left,
    layoutWidth: layoutRect.width,
    resultExtraWidth,
    committedBuilderWidth: initialBuilderWidth,
    committedResultWidth: initialResultWidth,
    lastCommitTime: now,
    lastResponsiveSignature: readResponsiveSignature(initialBuilderWidth, initialResultWidth),
    pointerId: pointer.pointerId,
    pendingClientX: null,
    frameId: null,
    fallbackCleanupTimer: null,
  };

  workspace.dataset.tabletPacedContent = 'true';
  setFormattingWidth(builderNodes, initialBuilderWidth);
  setFormattingWidth(resultNodes, initialResultWidth);
};

const handlePointerDown = (event: PointerEvent) => {
  const target = event.target instanceof Element ? event.target : null;
  if (!target?.closest('.soridraw-studio-splitter')) return;
  pendingPointerDown = {
    pointerId: event.pointerId,
    pointerType: event.pointerType || '',
    clientX: event.clientX,
  };
};

const handlePointerMove = (event: PointerEvent) => {
  const activeSession = session;
  if (!activeSession || event.pointerId !== activeSession.pointerId) return;
  scheduleFrame(event.clientX);
};

const handlePointerRelease = (event: PointerEvent) => {
  const activeSession = session;
  if (!activeSession || event.pointerId !== activeSession.pointerId) return;
  activeSession.pendingClientX = event.clientX;
  if (activeSession.frameId !== null) {
    window.cancelAnimationFrame(activeSession.frameId);
    activeSession.frameId = null;
  }
  flushFrame(true);

  // The React split component dispatches `soridraw-split-drag-end` after its own
  // exact pointer-up reconciliation. Keep the fixed formatting width until that
  // event so there is no release-frame mismatch, then restore the natural CSS.
  activeSession.fallbackCleanupTimer = window.setTimeout(cleanupSession, 160);
};

const install = () => {
  document.addEventListener('pointerdown', handlePointerDown, true);
  document.addEventListener('pointermove', handlePointerMove, true);
  window.addEventListener('pointerup', handlePointerRelease, true);
  window.addEventListener('pointercancel', handlePointerRelease, true);
  window.addEventListener('soridraw-split-drag-start', beginSession as EventListener);
  window.addEventListener('soridraw-split-drag-end', cleanupSession as EventListener);
};

declare global {
  interface Window {
    __soridrawTabletTouchPacedContentInstalled?: boolean;
  }
}

if (typeof window !== 'undefined' && !window.__soridrawTabletTouchPacedContentInstalled) {
  window.__soridrawTabletTouchPacedContentInstalled = true;
  install();
}

export {};
