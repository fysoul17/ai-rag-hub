/** Color mapping and visual constants for the force-directed graph */

export const NODE_TYPE_COLORS: Record<string, string> = {
  Person: '#00f0ff',
  Technology: '#a855f7',
  Concept: '#22c55e',
  Place: '#f59e0b',
  Event: '#ef4444',
  Organization: '#00f0ff',
  Tool: '#a855f7',
  Topic: '#22c55e',
  Location: '#f59e0b',
};

const DEFAULT_NODE_COLOR = 'rgba(148, 163, 184, 0.8)';

export function getNodeColor(type: string): string {
  return NODE_TYPE_COLORS[type] ?? DEFAULT_NODE_COLOR;
}

/** Node radius: 14px base, scaled by log(degree+1), clamped to [14, 52] */
export function getNodeRadius(degree: number): number {
  return Math.min(50, Math.max(14, 14 + Math.log2(degree + 1) * 9));
}

/** Edge width: 1.5px base, scaled by weight, clamped to [1.5, 5] */
export function getEdgeWidth(weight: number): number {
  return Math.min(5, Math.max(1.5, 1.5 + weight * 0.8));
}

// Force simulation tuning
export const SIMULATION = {
  chargeStrength: -650,
  linkDistance: 240,
  centerStrength: 0.018,
  collisionPadding: 14,
  alphaDecay: 0.012,
  velocityDecay: 0.3,
  typeClusterStrength: 0.065,
} as const;

// Rendering constants
export const RENDER = {
  // Labels
  labelFont: '500 12px "Geist Mono", ui-monospace, "Cascadia Code", "Fira Code", monospace',
  edgeLabelFont: '10px "Geist Mono", ui-monospace, "Cascadia Code", "Fira Code", monospace',
  labelOffsetY: 20,
  labelShowZoom: 0.35,
  labelMaxLength: 28,

  // Node opacity
  defaultNodeOpacity: 1.0,
  dimOpacityNear: 0.2,
  dimOpacityFar: 0.08,

  // Edge opacity
  defaultEdgeOpacity: 0.35,

  // Glow
  glowBlurDefault: 22,
  glowAlphaDefault: 0.3,
  glowBlurHover: 32,
  glowAlphaHover: 0.55,
  glowBlurSelected: 40,
  glowAlphaSelected: 0.7,

  // Pulse animation
  pulseSpeed: 0.0008,
  pulseAmplitude: 0.1,
  selectedPulseSpeed: 0.003,
  selectedPulseAmplitude: 0.18,

  // Camera
  zoomMin: 0.1,
  zoomMax: 8,
  zoomSensitivity: 0.0015,

  // Ambient particles
  particleCount: 50,
  particleMinSize: 0.5,
  particleMaxSize: 2.2,
  particleMaxSpeed: 0.25,
  particleMinAlpha: 0.06,
  particleMaxAlpha: 0.18,

  // Bezier edge curvature (0 = straight, higher = more curved)
  edgeCurvature: 0.15,
} as const;

/** Unique deduplicated palette colors for particles */
export const PALETTE_COLORS = [...new Set(Object.values(NODE_TYPE_COLORS))];

/** Generate a layout position offset for type-based clustering.
 *  Uses a deterministic hash so the mapping is stable across remounts. */
export function getTypeClusterOffset(type: string, radius: number): { x: number; y: number } {
  let hash = 0;
  for (let i = 0; i < type.length; i++) {
    hash = ((hash << 5) - hash + type.charCodeAt(i)) | 0;
  }
  const angle = (Math.abs(hash) % 360) * (Math.PI / 180);
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}
