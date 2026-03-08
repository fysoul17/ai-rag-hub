/** Color mapping and visual constants for the force-directed graph
 *  Inspired by Neo4j Browser and Obsidian graph view */

const NODE_TYPE_COLORS: Record<string, string> = {
  // Primary types
  Person: '#4FC3F7', // Light blue
  Technology: '#CE93D8', // Purple
  Concept: '#81C784', // Green
  Place: '#FFB74D', // Orange
  Event: '#EF5350', // Red
  Organization: '#4DD0E1', // Teal
  Tool: '#BA68C8', // Deep purple
  Topic: '#AED581', // Light green
  Location: '#FFD54F', // Amber
  Product: '#4FC3F7', // Light blue
};

const DEFAULT_NODE_COLOR = '#90A4AE'; // Blue grey

export function getNodeColor(type: string): string {
  // Case-insensitive lookup
  const normalized = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
  return NODE_TYPE_COLORS[normalized] ?? NODE_TYPE_COLORS[type] ?? DEFAULT_NODE_COLOR;
}

/** Node radius scaled by degree: min 8, max 40 */
export function getNodeRadius(degree: number): number {
  return Math.min(40, Math.max(8, 8 + Math.sqrt(degree) * 6));
}

/** Edge width scaled by weight: min 1, max 3 */
export function getEdgeWidth(weight: number): number {
  return Math.min(3, Math.max(1, 1 + weight * 0.5));
}

// Force simulation tuning — designed for good spacing
export const SIMULATION = {
  chargeStrength: -800, // Strong repulsion to spread nodes
  linkDistance: 180, // Moderate link length
  centerStrength: 0.03, // Pull toward center
  collisionPadding: 20, // Extra padding between nodes
  alphaDecay: 0.015, // Settle speed
  velocityDecay: 0.4, // Damping
  typeClusterStrength: 0.06,
} as const;

// Rendering constants
export const RENDER = {
  // Labels
  labelFont: '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  labelFontBold: '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  edgeLabelFont: '9px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  labelMaxLength: 24,

  // Opacity
  defaultNodeOpacity: 1.0,
  defaultEdgeOpacity: 0.5,
  dimNodeOpacity: 0.12,
  dimEdgeOpacity: 0.06,
  highlightEdgeOpacity: 0.85,

  // Camera
  zoomMin: 0.15,
  zoomMax: 6,
  zoomSensitivity: 0.004,

  // Arrowhead
  arrowSize: 8,

  // Edge colors
  edgeColor: 'rgba(255, 255, 255, 0.6)',
  edgeHighlightColor: '#fff',
  edgeLabelBg: 'rgba(15, 15, 25, 0.85)',
  edgeLabelText: 'rgba(255, 255, 255, 0.8)',

  // Node colors
  nodeBorderColor: 'rgba(0, 0, 0, 0.3)',
  nodeInnerLabelColor: '#000',
  nodeOuterLabelColor: '#e4e4e7',
} as const;

// Interaction & physics tuning
export const INTERACTION = {
  hitRadiusPadding: 4, // Extra px around node for pointer hit-test
  alphaStopThreshold: 0.001, // Stop animation loop below this alpha
  clickDistSq: 49, // Max squared px movement to count as click (7²)
  dragAlphaTarget: 0.3, // Alpha target while dragging
  alphaRestart: 0.15, // Alpha kick after releasing a dragged node
  preSimTicks: 300, // Ticks to pre-compute for reduced-motion

  // Auto-fit layout
  preLayoutTicks: 50, // Pre-tick iterations for initial layout estimation
  fitPadding: 60, // Px padding around bounding box for fit calculation

  // Force strengths not in SIMULATION
  linkStrengthBase: 0.3,
  linkStrengthWeightFactor: 0.1,
  collisionStrength: 0.8,

  // Sparse-graph cluster sizing
  clusterRadiusMin: 80,
  clusterRadiusPerNode: 14,

  // Keyboard pan/zoom
  keyZoomStep: 0.15,
  keyPanStep: 50,

  // Auto-fit camera lerp factor (per frame at ~60fps)
  autoFitLerp: 0.08,

  // Double-click zoom-to-node
  dblClickZoom: 1.8,
} as const;

/** Type-based cluster position for sparse graphs */
export function getTypeClusterOffset(type: string, radius: number): { x: number; y: number } {
  let hash = 0;
  for (let i = 0; i < type.length; i++) {
    hash = ((hash << 5) - hash + type.charCodeAt(i)) | 0;
  }
  const angle = (Math.abs(hash) % 360) * (Math.PI / 180);
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}
