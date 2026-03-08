/** Pure canvas draw functions for the force-directed graph.
 *  Extracted from graph-force-canvas.tsx to keep the component file focused. */

import { RENDER } from './graph-style';

/* ------------------------------------------------------------------ */
/*  Types (re-exported for use in graph-force-canvas)                 */
/* ------------------------------------------------------------------ */

import type { SimulationLinkDatum, SimulationNodeDatum } from 'd3-force';

export interface SimNode extends SimulationNodeDatum {
  id: string;
  label: string;
  type: string;
  memoryCount: number;
  degree: number;
  radius: number;
  color: string;
  /** Pre-truncated display label (avoids per-frame measureText) */
  _displayLabel?: string;
  /** Fitted label for inside-node rendering (cached after first measure) */
  _fittedLabel?: string;
}

export interface SimLink extends SimulationLinkDatum<SimNode> {
  label: string;
  weight: number;
  width: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

/** Truncate label to fit inside a circle of given radius */
function fitLabel(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 1 && ctx.measureText(`${truncated}...`).width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return `${truncated}...`;
}

/* ------------------------------------------------------------------ */
/*  Draw functions                                                    */
/* ------------------------------------------------------------------ */

export function drawEdge(
  ctx: CanvasRenderingContext2D,
  link: SimLink,
  isHighlighted: boolean,
  isDimmed: boolean,
) {
  const src = link.source as SimNode;
  const tgt = link.target as SimNode;
  if (src.x == null || src.y == null || tgt.x == null || tgt.y == null) return;

  const opacity = isDimmed
    ? RENDER.dimEdgeOpacity
    : isHighlighted
      ? RENDER.highlightEdgeOpacity
      : RENDER.defaultEdgeOpacity;

  const edgeColor = isHighlighted ? RENDER.edgeHighlightColor : RENDER.edgeColor;

  // Straight line
  ctx.beginPath();
  ctx.moveTo(src.x, src.y);
  ctx.lineTo(tgt.x, tgt.y);
  ctx.strokeStyle = edgeColor;
  ctx.globalAlpha = opacity;
  ctx.lineWidth = isHighlighted ? link.width + 0.5 : link.width;
  ctx.stroke();

  // Arrowhead (pointing toward target, stopping at node edge)
  if (!isDimmed) {
    const dx = tgt.x - src.x;
    const dy = tgt.y - src.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return;

    const nx = dx / dist;
    const ny = dy / dist;
    const arrowTipX = tgt.x - nx * (tgt.radius + 2);
    const arrowTipY = tgt.y - ny * (tgt.radius + 2);
    const arrowSize = RENDER.arrowSize;

    ctx.beginPath();
    ctx.moveTo(arrowTipX, arrowTipY);
    ctx.lineTo(
      arrowTipX - nx * arrowSize + ny * arrowSize * 0.4,
      arrowTipY - ny * arrowSize - nx * arrowSize * 0.4,
    );
    ctx.lineTo(
      arrowTipX - nx * arrowSize - ny * arrowSize * 0.4,
      arrowTipY - ny * arrowSize + nx * arrowSize * 0.4,
    );
    ctx.closePath();
    ctx.fillStyle = edgeColor;
    ctx.globalAlpha = opacity;
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}

export function drawEdgeLabel(ctx: CanvasRenderingContext2D, link: SimLink) {
  const src = link.source as SimNode;
  const tgt = link.target as SimNode;
  if (src.x == null || src.y == null || tgt.x == null || tgt.y == null) return;
  if (!link.label) return;

  const mx = (src.x + tgt.x) / 2;
  const my = (src.y + tgt.y) / 2;

  ctx.font = RENDER.edgeLabelFont;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Background pill for readability
  const text = link.label.length > 20 ? `${link.label.slice(0, 18)}...` : link.label;
  const tw = ctx.measureText(text).width;
  const px = 4;
  const py = 2;

  ctx.fillStyle = RENDER.edgeLabelBg;
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.roundRect(mx - tw / 2 - px, my - 6 - py, tw + px * 2, 12 + py * 2, 3);
  ctx.fill();

  ctx.fillStyle = RENDER.edgeLabelText;
  ctx.globalAlpha = 1;
  ctx.fillText(text, mx, my);
}

/** Draw a node's circle, selection ring, and border (no label / no font change). */
export function drawNodeBody(
  ctx: CanvasRenderingContext2D,
  node: SimNode,
  isHovered: boolean,
  isSelected: boolean,
  isDimmed: boolean,
) {
  if (node.x == null || node.y == null) return;
  const { x, y, radius, color } = node;

  const alpha = isDimmed ? RENDER.dimNodeOpacity : RENDER.defaultNodeOpacity;

  // Selection ring
  if ((isSelected || isHovered) && !isDimmed) {
    ctx.beginPath();
    ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = isSelected ? 0.8 : 0.5;
    ctx.stroke();
  }

  // Node circle — solid fill like Neo4j
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  ctx.fill();

  // Subtle darker border
  ctx.strokeStyle = RENDER.nodeBorderColor;
  ctx.lineWidth = 1;
  ctx.globalAlpha = alpha;
  ctx.stroke();

  ctx.globalAlpha = 1;
}

/**
 * Draw all node labels in two batched passes — one ctx.font set per font style
 * instead of one per node. ~2-4x faster label rendering for large graphs.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: batched canvas label rendering with per-node state checks
export function drawNodeLabels(
  ctx: CanvasRenderingContext2D,
  nodes: SimNode[],
  hovered: string | null,
  selected: string | null,
  activeId: string | null,
  activeNeighbors: Set<string> | null | undefined,
) {
  ctx.textAlign = 'center';

  // Pass 1: large nodes (radius >= 16) — bold font, label inside circle
  ctx.font = RENDER.labelFontBold;
  ctx.textBaseline = 'middle';
  for (const node of nodes) {
    if (node.x == null || node.y == null || node.radius < 16) continue;
    const isDimmed = activeId != null && node.id !== activeId && !activeNeighbors?.has(node.id);
    const isHovered = node.id === hovered;
    const isSelected = node.id === selected;
    if (isDimmed && !isHovered && !isSelected) continue;

    const displayLabel = ensureDisplayLabel(node);
    if (!node._fittedLabel) {
      node._fittedLabel = fitLabel(ctx, displayLabel, node.radius * 1.6);
    }
    ctx.fillStyle = RENDER.nodeInnerLabelColor;
    ctx.globalAlpha = isDimmed ? 0.3 : 0.85;
    ctx.fillText(node._fittedLabel, node.x, node.y);
  }

  // Pass 2: small nodes (radius < 16) — regular font, label below circle
  ctx.font = RENDER.labelFont;
  ctx.textBaseline = 'top';
  for (const node of nodes) {
    if (node.x == null || node.y == null || node.radius >= 16) continue;
    const isDimmed = activeId != null && node.id !== activeId && !activeNeighbors?.has(node.id);
    const isHovered = node.id === hovered;
    const isSelected = node.id === selected;
    if (isDimmed && !isHovered && !isSelected) continue;

    const displayLabel = ensureDisplayLabel(node);
    ctx.fillStyle = RENDER.nodeOuterLabelColor;
    ctx.globalAlpha = isDimmed ? 0.15 : 0.85;
    ctx.fillText(displayLabel, node.x, node.y + node.radius + 4);
  }

  ctx.globalAlpha = 1;
}

/** Cache display label to avoid per-frame string ops. Returns the cached label. */
function ensureDisplayLabel(node: SimNode): string {
  if (!node._displayLabel) {
    const maxLen = RENDER.labelMaxLength;
    node._displayLabel =
      node.label.length > maxLen ? `${node.label.slice(0, maxLen - 1)}...` : node.label;
  }
  return node._displayLabel;
}
