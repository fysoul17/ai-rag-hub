'use client';

import type { GraphVizData } from '@pyxmate/memory/dashboard';
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
} from 'd3-force';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  drawEdge,
  drawEdgeLabel,
  drawNodeBody,
  drawNodeLabels,
  type SimLink,
  type SimNode,
} from './graph-draw';
import {
  getEdgeWidth,
  getNodeColor,
  getNodeRadius,
  getTypeClusterOffset,
  INTERACTION,
  RENDER,
  SIMULATION,
} from './graph-style';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface Camera {
  x: number;
  y: number;
  zoom: number;
}

interface GraphForceCanvasProps {
  data: GraphVizData;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function buildSimData(data: GraphVizData) {
  const nodeMap = new Map<string, SimNode>();
  const nodes: SimNode[] = data.nodes.map((n) => {
    const node: SimNode = {
      id: n.id,
      label: n.label,
      type: n.type,
      memoryCount: n.memoryCount,
      degree: n.degree,
      radius: getNodeRadius(n.degree),
      color: getNodeColor(n.type),
    };
    nodeMap.set(n.id, node);
    return node;
  });

  const links: SimLink[] = data.edges
    .filter((e) => nodeMap.has(e.source) && nodeMap.has(e.target))
    .map((e) => ({
      source: e.source,
      target: e.target,
      label: e.label,
      weight: e.weight,
      width: getEdgeWidth(e.weight),
    }));

  return { nodes, links, nodeMap };
}

function screenToCanvas(sx: number, sy: number, rect: DOMRect, cam: Camera): [number, number] {
  const cx = (sx - rect.left - rect.width / 2) / cam.zoom - cam.x;
  const cy = (sy - rect.top - rect.height / 2) / cam.zoom - cam.y;
  return [cx, cy];
}

function findNodeAt(cx: number, cy: number, nodes: SimNode[]): SimNode | null {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i];
    if (!n || n.x == null || n.y == null) continue;
    const dx = cx - n.x;
    const dy = cy - n.y;
    const hitRadius = n.radius + INTERACTION.hitRadiusPadding;
    if (dx * dx + dy * dy <= hitRadius * hitRadius) return n;
  }
  return null;
}

/** Compute camera (zoom + pan) that fits all nodes centered within the viewport */
function computeFitCamera(
  nodes: SimNode[],
  width: number,
  height: number,
  padding: number,
): Camera {
  if (nodes.length === 0 || width === 0 || height === 0) return { x: 0, y: 0, zoom: 1 };
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    if (n.x == null || n.y == null) continue;
    minX = Math.min(minX, n.x - n.radius);
    maxX = Math.max(maxX, n.x + n.radius);
    minY = Math.min(minY, n.y - n.radius);
    maxY = Math.max(maxY, n.y + n.radius);
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, zoom: 1 };
  const graphW = maxX - minX + padding * 2;
  const graphH = maxY - minY + padding * 2;
  const zoom = Math.max(RENDER.zoomMin, Math.min(width / graphW, height / graphH, 1));
  // Center camera on the graph centroid
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return { x: -cx, y: -cy, zoom };
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function GraphForceCanvas({ data }: GraphForceCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<Simulation<SimNode, SimLink> | null>(null);
  const nodesRef = useRef<SimNode[]>([]);
  const linksRef = useRef<SimLink[]>([]);
  const cameraRef = useRef<Camera>({ x: 0, y: 0, zoom: 1 });
  const rafRef = useRef<number>(0);
  const sizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const rectRef = useRef<DOMRect | null>(null);
  const autoFitRef = useRef(true);
  const neighborIdxRef = useRef(0);

  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const hoveredRef = useRef<string | null>(null);
  const selectedRef = useRef<string | null>(null);

  hoveredRef.current = hoveredNode;
  selectedRef.current = selectedNode;

  // Topology fingerprint — only re-init simulation when graph structure changes
  const topologyKey = useMemo(() => {
    const nk = data.nodes
      .map((n) => n.id)
      .sort()
      .join(',');
    const ek = data.edges
      .map((e) => `${e.source}:${e.target}`)
      .sort()
      .join(',');
    return `${nk}|${ek}`;
  }, [data]);

  // Drag state
  const dragRef = useRef<{
    node: SimNode | null;
    isPanning: boolean;
    startX: number;
    startY: number;
    camStartX: number;
    camStartY: number;
  }>({ node: null, isPanning: false, startX: 0, startY: 0, camStartX: 0, camStartY: 0 });

  /* ---------- Connected-node lookup ---------- */
  const connectedRef = useRef<Map<string, Set<string>>>(new Map());
  const nodeMapRef = useRef<Map<string, SimNode>>(new Map());

  const buildConnectivity = useCallback((links: SimLink[], nodeMap: Map<string, SimNode>) => {
    const connected = new Map<string, Set<string>>();
    for (const link of links) {
      const sId = typeof link.source === 'string' ? link.source : (link.source as SimNode).id;
      const tId = typeof link.target === 'string' ? link.target : (link.target as SimNode).id;
      if (!connected.has(sId)) connected.set(sId, new Set());
      if (!connected.has(tId)) connected.set(tId, new Set());
      connected.get(sId)?.add(tId);
      connected.get(tId)?.add(sId);
    }
    connectedRef.current = connected;
    nodeMapRef.current = nodeMap;
  }, []);

  /* ---------- Draw ---------- */
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: canvas draw loop with camera transform and multi-pass rendering
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const { w, h } = sizeRef.current;
    if (w === 0 || h === 0) return;

    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }

    const cam = cameraRef.current;
    const nodes = nodesRef.current;
    const links = linksRef.current;
    const hovered = hoveredRef.current;
    const selected = selectedRef.current;
    const activeId = hovered ?? selected;
    const activeNeighbors = activeId ? connectedRef.current.get(activeId) : null;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Camera transform
    ctx.setTransform(
      dpr * cam.zoom,
      0,
      0,
      dpr * cam.zoom,
      dpr * (w / 2 + cam.x * cam.zoom),
      dpr * (h / 2 + cam.y * cam.zoom),
    );

    // --- Draw edges ---
    for (const link of links) {
      const src = link.source as SimNode;
      const tgt = link.target as SimNode;
      const isHighlighted = activeId != null && (src.id === activeId || tgt.id === activeId);
      const isDimmed = activeId != null && !isHighlighted;
      drawEdge(ctx, link, isHighlighted, isDimmed);
    }

    // --- Draw edge labels for highlighted edges ---
    if (activeId) {
      for (const link of links) {
        const src = link.source as SimNode;
        const tgt = link.target as SimNode;
        if (src.id === activeId || tgt.id === activeId) {
          drawEdgeLabel(ctx, link);
        }
      }
    }

    // --- Draw nodes (bodies then labels, batched by font) ---
    for (const node of nodes) {
      const isHovered = node.id === hovered;
      const isSelected = node.id === selected;
      const isDimmed = activeId != null && node.id !== activeId && !activeNeighbors?.has(node.id);
      drawNodeBody(ctx, node, isHovered, isSelected, isDimmed);
    }
    drawNodeLabels(ctx, nodes, hovered, selected, activeId, activeNeighbors);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }, []);

  /* ---------- Animation loop ---------- */
  const startLoop = useCallback(() => {
    if (rafRef.current) return;
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: animation loop with camera auto-fit tracking and settling detection
    const loop = () => {
      // Auto-fit camera while simulation is settling
      if (autoFitRef.current) {
        const { w, h } = sizeRef.current;
        if (w > 0 && h > 0) {
          const target = computeFitCamera(nodesRef.current, w, h, INTERACTION.fitPadding);
          const cam = cameraRef.current;
          const k = INTERACTION.autoFitLerp;
          cam.x += (target.x - cam.x) * k;
          cam.y += (target.y - cam.y) * k;
          cam.zoom += (target.zoom - cam.zoom) * k;
        }
      }

      draw();
      const alpha = simRef.current?.alpha() ?? 0;
      if (alpha > INTERACTION.alphaStopThreshold) {
        rafRef.current = requestAnimationFrame(loop);
      } else {
        // Snap to exact fit when settling completes
        if (autoFitRef.current) {
          const { w, h } = sizeRef.current;
          if (w > 0 && h > 0) {
            cameraRef.current = computeFitCamera(nodesRef.current, w, h, INTERACTION.fitPadding);
          }
          autoFitRef.current = false;
          draw();
        }
        rafRef.current = 0;
      }
    };
    rafRef.current = requestAnimationFrame(loop);
  }, [draw]);

  const requestDraw = useCallback(() => {
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(() => {
        draw();
        rafRef.current = 0;
      });
    }
  }, [draw]);

  /* ---------- Simulation setup ---------- */
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-init only when graph topology changes (topologyKey), not on every poll cycle
  useEffect(() => {
    const { nodes, links, nodeMap } = buildSimData(data);
    nodesRef.current = nodes;
    linksRef.current = links;
    buildConnectivity(links, nodeMap);

    const nodeCount = nodes.length;
    const isSparse = links.length < 3;

    const sim = forceSimulation<SimNode>(nodes)
      .force(
        'link',
        forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance(SIMULATION.linkDistance)
          .strength(
            (l) => INTERACTION.linkStrengthBase + l.weight * INTERACTION.linkStrengthWeightFactor,
          ),
      )
      .force('charge', forceManyBody<SimNode>().strength(SIMULATION.chargeStrength))
      .force('center', forceCenter(0, 0).strength(SIMULATION.centerStrength))
      .force(
        'collision',
        forceCollide<SimNode>()
          .radius((d) => d.radius + SIMULATION.collisionPadding)
          .strength(INTERACTION.collisionStrength),
      )
      .alphaDecay(SIMULATION.alphaDecay)
      .velocityDecay(SIMULATION.velocityDecay)
      .on('tick', () => {});

    // Type-based clustering when graph is sparse/no edges
    if (isSparse) {
      const clusterRadius = Math.max(
        INTERACTION.clusterRadiusMin,
        nodeCount * INTERACTION.clusterRadiusPerNode,
      );
      sim
        .force(
          'typeX',
          forceX<SimNode>()
            .x((d) => getTypeClusterOffset(d.type, clusterRadius).x)
            .strength(SIMULATION.typeClusterStrength),
        )
        .force(
          'typeY',
          forceY<SimNode>()
            .y((d) => getTypeClusterOffset(d.type, clusterRadius).y)
            .strength(SIMULATION.typeClusterStrength),
        );
    }

    simRef.current = sim;

    // Pre-tick to estimate initial layout, then auto-fit camera
    sim.stop();
    for (let i = 0; i < INTERACTION.preLayoutTicks; i++) sim.tick();

    // Read canvas dimensions directly — sizeRef may not be populated yet
    // if the ResizeObserver hasn't fired before this effect runs
    const canvas = canvasRef.current;
    const w = canvas?.clientWidth ?? 0;
    const h = canvas?.clientHeight ?? 0;
    if (canvas) sizeRef.current = { w, h };
    cameraRef.current = computeFitCamera(nodes, w, h, INTERACTION.fitPadding);
    autoFitRef.current = true;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      // Complete full pre-computation for reduced-motion users
      for (let i = INTERACTION.preLayoutTicks; i < INTERACTION.preSimTicks; i++) sim.tick();
      cameraRef.current = computeFitCamera(nodes, w, h, INTERACTION.fitPadding);
      autoFitRef.current = false;
      sim.alpha(0); // Signal loop to stop after one draw
    } else {
      // Resume live settling animation — autoFit tracks camera during settling
      sim.alpha(1).restart();
    }
    startLoop();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      sim.stop();
      nodesRef.current.forEach((n) => {
        n.fx = null;
        n.fy = null;
      });
    };
  }, [topologyKey, buildConnectivity, startLoop]);

  /* ---------- Resize observer ---------- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const updateSize = () => {
      sizeRef.current = { w: canvas.clientWidth, h: canvas.clientHeight };
      rectRef.current = canvas.getBoundingClientRect();
      requestDraw();
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [requestDraw]);

  /* ---------- Mouse events ---------- */
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      autoFitRef.current = false;
      const rect = canvas.getBoundingClientRect();
      rectRef.current = rect;
      const cam = cameraRef.current;
      const [cx, cy] = screenToCanvas(e.clientX, e.clientY, rect, cam);
      const node = findNodeAt(cx, cy, nodesRef.current);

      if (node) {
        dragRef.current = {
          node,
          isPanning: false,
          startX: e.clientX,
          startY: e.clientY,
          camStartX: 0,
          camStartY: 0,
        };
        node.fx = node.x;
        node.fy = node.y;
        simRef.current?.alphaTarget(INTERACTION.dragAlphaTarget).restart();
        startLoop();
      } else {
        dragRef.current = {
          node: null,
          isPanning: true,
          startX: e.clientX,
          startY: e.clientY,
          camStartX: cam.x,
          camStartY: cam.y,
        };
      }
      canvas.setPointerCapture(e.pointerId);
    },
    [startLoop],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = rectRef.current ?? canvas.getBoundingClientRect();
      const cam = cameraRef.current;
      const drag = dragRef.current;

      if (drag.node) {
        const [cx, cy] = screenToCanvas(e.clientX, e.clientY, rect, cam);
        drag.node.fx = cx;
        drag.node.fy = cy;
        canvas.style.cursor = 'grabbing';
        requestDraw();
        return;
      }

      if (drag.isPanning) {
        const dx = (e.clientX - drag.startX) / cam.zoom;
        const dy = (e.clientY - drag.startY) / cam.zoom;
        cam.x = drag.camStartX + dx;
        cam.y = drag.camStartY + dy;
        canvas.style.cursor = 'grabbing';
        requestDraw();
        return;
      }

      const [cx, cy] = screenToCanvas(e.clientX, e.clientY, rect, cam);
      const node = findNodeAt(cx, cy, nodesRef.current);
      const newId = node?.id ?? null;
      if (newId !== hoveredRef.current) {
        setHoveredNode(newId);
        requestDraw();
      }
      canvas.style.cursor = node ? 'pointer' : 'grab';
    },
    [requestDraw],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;

      if (drag.node) {
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        if (dx * dx + dy * dy < INTERACTION.clickDistSq) {
          const nodeId = drag.node.id;
          setSelectedNode((prev) => (prev === nodeId ? null : nodeId));
          neighborIdxRef.current = 0;
          requestDraw();
        }
        drag.node.fx = null;
        drag.node.fy = null;
        simRef.current?.alphaTarget(0).alpha(INTERACTION.alphaRestart).restart();
        startLoop();
      } else if (drag.isPanning) {
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        if (dx * dx + dy * dy < INTERACTION.clickDistSq) {
          setSelectedNode(null);
          requestDraw();
        }
      }

      dragRef.current = {
        node: null,
        isPanning: false,
        startX: 0,
        startY: 0,
        camStartX: 0,
        camStartY: 0,
      };
      canvasRef.current?.releasePointerCapture(e.pointerId);
    },
    [requestDraw, startLoop],
  );

  /* ---------- Wheel zoom ---------- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      autoFitRef.current = false;
      const rect = canvas.getBoundingClientRect();
      rectRef.current = rect;
      const cam = cameraRef.current;
      const oldZoom = cam.zoom;
      const delta = -e.deltaY * RENDER.zoomSensitivity;
      const newZoom = Math.min(RENDER.zoomMax, Math.max(RENDER.zoomMin, oldZoom * (1 + delta)));

      // Zoom toward cursor
      const mx = e.clientX - rect.left - rect.width / 2;
      const my = e.clientY - rect.top - rect.height / 2;
      cam.x += mx * (1 / newZoom - 1 / oldZoom);
      cam.y += my * (1 / newZoom - 1 / oldZoom);
      cam.zoom = newZoom;

      requestDraw();
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [requestDraw]);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = rectRef.current ?? canvas.getBoundingClientRect();
      const cam = cameraRef.current;
      const [cx, cy] = screenToCanvas(e.clientX, e.clientY, rect, cam);
      const node = findNodeAt(cx, cy, nodesRef.current);

      if (node && node.x != null && node.y != null) {
        // Zoom into the double-clicked node
        autoFitRef.current = false;
        cameraRef.current = {
          x: -node.x,
          y: -node.y,
          zoom: Math.max(cam.zoom, INTERACTION.dblClickZoom),
        };
        // Re-select the node (click toggle may have deselected it)
        setSelectedNode(node.id);
        neighborIdxRef.current = 0;
        requestDraw();
        return;
      }

      // Empty space: fit all (reset view)
      const { w, h } = sizeRef.current;
      cameraRef.current = computeFitCamera(nodesRef.current, w, h, INTERACTION.fitPadding);
      // Re-enable auto-fit if simulation is still settling
      const alpha = simRef.current?.alpha() ?? 0;
      if (alpha > INTERACTION.alphaStopThreshold) {
        autoFitRef.current = true;
        startLoop();
      } else {
        requestDraw();
      }
    },
    [requestDraw, startLoop],
  );

  const handleKeyDown = useCallback(
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: keyboard navigation with multiple key bindings
    (e: React.KeyboardEvent) => {
      // Let browser/OS shortcuts through (Ctrl+R, Cmd+=, Alt+arrows, etc.)
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      // --- Camera controls (always active) ---

      // Zoom: +/= to zoom in, - to zoom out
      if (e.key === '+' || e.key === '=') {
        autoFitRef.current = false;
        const cam = cameraRef.current;
        cam.zoom = Math.min(RENDER.zoomMax, cam.zoom * (1 + INTERACTION.keyZoomStep));
        requestDraw();
        e.preventDefault();
        return;
      }
      if (e.key === '-') {
        autoFitRef.current = false;
        const cam = cameraRef.current;
        cam.zoom = Math.max(RENDER.zoomMin, cam.zoom * (1 - INTERACTION.keyZoomStep));
        requestDraw();
        e.preventDefault();
        return;
      }

      // Reset: r or 0
      if (e.key === 'r' || e.key === '0') {
        const { w, h } = sizeRef.current;
        cameraRef.current = computeFitCamera(nodesRef.current, w, h, INTERACTION.fitPadding);
        // Re-enable auto-fit if simulation is still settling
        const alpha = simRef.current?.alpha() ?? 0;
        if (alpha > INTERACTION.alphaStopThreshold) {
          autoFitRef.current = true;
          startLoop();
        } else {
          requestDraw();
        }
        e.preventDefault();
        return;
      }

      // Pan: Shift+arrows
      if (e.shiftKey && ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) {
        autoFitRef.current = false;
        const cam = cameraRef.current;
        const step = INTERACTION.keyPanStep / cam.zoom;
        if (e.key === 'ArrowLeft') cam.x += step;
        if (e.key === 'ArrowRight') cam.x -= step;
        if (e.key === 'ArrowUp') cam.y += step;
        if (e.key === 'ArrowDown') cam.y -= step;
        requestDraw();
        e.preventDefault();
        return;
      }

      // --- Node navigation ---

      if (!selectedRef.current) {
        if (
          e.key === 'Enter' ||
          ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)
        ) {
          const nodes = nodesRef.current;
          if (nodes.length > 0) {
            const first = nodes.reduce((a, b) => (a.degree >= b.degree ? a : b));
            setSelectedNode(first.id);
            neighborIdxRef.current = 0;
            requestDraw();
            e.preventDefault();
          }
        }
        return;
      }

      const neighbors = connectedRef.current.get(selectedRef.current);
      if (!neighbors || neighbors.size === 0) {
        if (e.key === 'Escape') {
          setSelectedNode(null);
          requestDraw();
        }
        return;
      }

      let nextNodeId: string | null = null;

      if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) {
        const direction = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
        const arr = Array.from(neighbors);
        neighborIdxRef.current =
          (((neighborIdxRef.current + direction) % arr.length) + arr.length) % arr.length;
        nextNodeId = arr[neighborIdxRef.current] || null;
        e.preventDefault();
      } else if (e.key === 'Escape') {
        setSelectedNode(null);
        requestDraw();
      }

      if (nextNodeId) {
        setSelectedNode(nextNodeId);
        requestDraw();
      }
    },
    [requestDraw, startLoop],
  );

  /* ---------- Tooltip content ---------- */
  const hoveredData = hoveredNode ? (nodeMapRef.current.get(hoveredNode) ?? null) : null;
  const selectedData = selectedNode ? (nodeMapRef.current.get(selectedNode) ?? null) : null;
  const activeData = hoveredData ?? selectedData;

  return (
    <div className="graph-canvas-container relative">
      {/* biome-ignore lint/a11y/noInteractiveElementToNoninteractiveRole: canvas needs role="application" for custom keyboard handling per WAI-ARIA */}
      <canvas
        ref={canvasRef}
        className="h-full w-full touch-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-neon-cyan/60 focus-visible:outline-offset-[-2px]"
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => {
          if (hoveredRef.current) {
            setHoveredNode(null);
            requestDraw();
          }
        }}
        onDoubleClick={handleDoubleClick}
        onKeyDown={handleKeyDown}
        role="application"
        aria-roledescription="interactive graph"
        aria-label={`Knowledge graph with ${data.nodeCount} entities and ${data.edgeCount} relationships. Press Enter or arrow keys to select a node, arrow keys to navigate neighbors, Escape to deselect.`}
      />

      {/* HUD: Stats */}
      <div className="pointer-events-none absolute left-3 top-3 select-none">
        <div className="glass pointer-events-auto rounded-lg px-3 py-2 text-[11px] text-muted-foreground">
          <span className="text-foreground font-semibold">{data.nodeCount}</span> nodes
          <span className="mx-2 opacity-30">|</span>
          <span className="text-foreground font-semibold">{data.edgeCount}</span> edges
        </div>
      </div>

      {/* HUD: Legend */}
      {Object.keys(data.nodeTypes).length > 0 && (
        <div className="pointer-events-none absolute bottom-3 left-3 select-none">
          <div className="glass pointer-events-auto flex flex-wrap gap-x-4 gap-y-1.5 rounded-lg px-3 py-2">
            {Object.entries(data.nodeTypes).map(([type, count]) => {
              const color = getNodeColor(type);
              return (
                <div
                  key={type}
                  className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
                >
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    aria-hidden="true"
                    style={{ backgroundColor: color }}
                  />
                  <span>
                    {type}
                    <span className="ml-1 opacity-60">({count})</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* HUD: Controls hint */}
      <span className="pointer-events-none absolute bottom-3 right-3 select-none text-[10px] text-muted-foreground">
        Drag / Shift+Arrows pan &middot; Scroll / +/&minus; zoom &middot; Dbl-click node zoom in
        &middot; Dbl-click bg / R reset &middot; Arrows navigate &middot; Esc deselect
      </span>

      {/* Screen reader announcements */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {selectedData
          ? `Selected: ${selectedData.label}, Type: ${selectedData.type}, ${selectedData.degree} connections, ${selectedData.memoryCount} linked memories`
          : 'No node selected'}
      </div>

      {/* Node detail tooltip */}
      {activeData && (
        <output
          className="pointer-events-none absolute right-3 top-3 block select-none"
          aria-hidden="true"
        >
          <div className="glass rounded-lg px-4 py-3 text-xs">
            <div className="mb-1.5 text-sm font-semibold" style={{ color: activeData.color }}>
              {activeData.label}
            </div>
            <div className="flex flex-col gap-0.5 text-muted-foreground">
              <span>
                Type: <span className="text-foreground">{activeData.type}</span>
              </span>
              <span>
                Connections: <span className="text-foreground">{activeData.degree}</span>
              </span>
              <span>
                Linked memories: <span className="text-foreground">{activeData.memoryCount}</span>
              </span>
            </div>
          </div>
        </output>
      )}
    </div>
  );
}
