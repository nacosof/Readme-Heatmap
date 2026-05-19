import type { CommitRecord } from "./types";
import { buildSchemeFromAccent } from "./colors";

export interface SimNode {
  id: string;
  oid: string;
  headline: string;
  date: string;
  url: string;
  repo: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseR: number;
  r: number;
  phase: number;
}

export interface SimLink {
  a: number;
  b: number;
}

export interface ConstellationSim {
  nodes: SimNode[];
  links: SimLink[];
  width: number;
  height: number;
}

export function rescaleSim(
  sim: ConstellationSim,
  width: number,
  height: number,
): void {
  if (sim.width === width && sim.height === height) return;
  const sx = width / sim.width;
  const sy = height / sim.height;
  const cx = sim.width / 2;
  const cy = sim.height / 2;
  const ncx = width / 2;
  const ncy = height / 2;
  for (const n of sim.nodes) {
    n.x = ncx + (n.x - cx) * sx;
    n.y = ncy + (n.y - cy) * sy;
  }
  sim.width = width;
  sim.height = height;
}

const BASE_R = 4;
const LINK_LEN = 56;
const MIN_GAP = 18;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

function physicsProfile(n: number, settling: boolean) {
  return {
    linkLen: n > 500 ? 38 : n > 300 ? 46 : LINK_LEN,
    linkK: n > 500 ? 0.01 : n > 300 ? 0.016 : 0.022,
    minGap: n > 500 ? 10 : n > 300 ? 13 : MIN_GAP,
    collisionCutoff: n > 400 ? 48 : n > 200 ? 72 : Infinity,
    push: n > 500 ? 0.28 : n > 300 ? 0.45 : 0.85,
    damping: n > 500 ? 0.74 : n > 300 ? 0.8 : 0.88,
    centerPull: n > 300 ? 0.00006 : 0.0002,
    ambient: settling || n > 100 ? 0 : 0.012,
    iters: n > 450 ? 1 : n > 250 ? 2 : 3,
  };
}

export function maxNodeSpeed(sim: ConstellationSim): number {
  let max = 0;
  for (const n of sim.nodes) {
    const s = Math.hypot(n.vx, n.vy);
    if (s > max) max = s;
  }
  return max;
}

export function zeroVelocities(sim: ConstellationSim): void {
  for (const n of sim.nodes) {
    n.vx = 0;
    n.vy = 0;
  }
}

export function buildConstellation(
  commits: CommitRecord[],
  width: number,
  height: number,
): ConstellationSim {
  const cx = width / 2;
  const cy = height / 2;
  const n = commits.length;
  const maxR = Math.min(width, height) * 0.44;
  const nodeR = n > 500 ? 2.5 : n > 350 ? 3 : BASE_R;

  const nodes: SimNode[] = commits.map((c, i) => {
    const t = (i + 0.5) / Math.max(n, 1);
    const r = maxR * Math.sqrt(t);
    const angle = i * GOLDEN;
    return {
      id: c.oid,
      oid: c.oid,
      headline: c.headline,
      date: c.date,
      url: c.url,
      repo: c.repo,
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
      vx: 0,
      vy: 0,
      baseR: nodeR,
      r: nodeR,
      phase: (i * 2.17) % (Math.PI * 2),
    };
  });

  const links: SimLink[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const da = new Date(nodes[i]!.date).getTime();
    const db = new Date(nodes[i + 1]!.date).getTime();
    const diffH = Math.abs(db - da) / 3_600_000;
    if (diffH <= 72) links.push({ a: i, b: i + 1 });
  }

  const unique = new Map<string, SimLink>();
  for (const l of links) {
    const key = [Math.min(l.a, l.b), Math.max(l.a, l.b)].join("-");
    if (!unique.has(key)) unique.set(key, l);
  }

  const sim: ConstellationSim = {
    nodes,
    links: [...unique.values()],
    width,
    height,
  };

  relaxLayout(sim, n > 500 ? 220 : n > 300 ? 180 : 200);
  zeroVelocities(sim);
  return sim;
}

export function relaxLayout(sim: ConstellationSim, steps = 120): void {
  const opts: SimOptions = {
    hovered: null,
    dragged: null,
    dragX: 0,
    dragY: 0,
    time: 0,
    accentColor: "#00e436",
    bg: "#000",
    settling: true,
  };
  for (let i = 0; i < steps; i++) {
    opts.time = i * 16;
    stepSimulation(sim, opts);
  }
  zeroVelocities(sim);
}

export interface SimOptions {
  hovered: number | null;
  dragged: number | null;
  dragX: number;
  dragY: number;
  time: number;
  accentColor: string;
  bg: string;
  settling?: boolean;
  frozen?: boolean;
}

export function stepSimulation(
  sim: ConstellationSim,
  opts: SimOptions,
): void {
  const { nodes, links, width, height } = sim;
  const cx = width / 2;
  const cy = height / 2;
  const { hovered, dragged, dragX, dragY, time } = opts;
  const t = time * 0.001;

  const highlight =
    dragged !== null ? dragged : hovered;

  for (const n of nodes) {
    const targetR =
      n === nodes[highlight ?? -1] ? n.baseR + 2 : n.baseR;
    n.r += (targetR - n.r) * 0.14;
  }

  if (opts.frozen && dragged === null) return;

  const n = nodes.length;
  const p = physicsProfile(n, !!opts.settling);

  for (let iter = 0; iter < p.iters; iter++) {
    for (const link of links) {
      const a = nodes[link.a];
      const b = nodes[link.b];
      if (!a || !b) continue;
      if (link.a === dragged || link.b === dragged) continue;

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 0.01;
      const force = (dist - p.linkLen) * p.linkK;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        if (i === dragged || j === dragged) continue;
        const a = nodes[i]!;
        const b = nodes[j]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.01;
        if (dist > p.collisionCutoff) continue;
        const minD = a.baseR + b.baseR + p.minGap;
        if (dist < minD) {
          const push = ((minD - dist) / dist) * p.push;
          a.vx -= dx * push;
          a.vy -= dy * push;
          b.vx += dx * push;
          b.vy += dy * push;
        }
      }
    }

    if (dragged !== null) {
      const d = nodes[dragged]!;
      d.x += (dragX - d.x) * 0.38;
      d.y += (dragY - d.y) * 0.38;
      d.vx = 0;
      d.vy = 0;

      for (let i = 0; i < nodes.length; i++) {
        if (i === dragged) continue;
        const n = nodes[i]!;
        const dx = n.x - d.x;
        const dy = n.y - d.y;
        const dist = Math.hypot(dx, dy) || 0.01;
        const minD = d.r + n.r + 10;
        if (dist < minD + 24) {
          const push = ((minD + 24 - dist) / dist) * 2.8;
          n.vx += (dx / dist) * push;
          n.vy += (dy / dist) * push;
        }
      }
    }

    for (let i = 0; i < nodes.length; i++) {
      if (i === dragged) {
        const pad = nodes[i]!.r + 8;
        nodes[i]!.x = Math.max(pad, Math.min(width - pad, nodes[i]!.x));
        nodes[i]!.y = Math.max(pad, Math.min(height - pad, nodes[i]!.y));
        continue;
      }

      const node = nodes[i]!;
      if (p.ambient > 0) {
        node.vx += Math.sin(t * 1.1 + node.phase) * p.ambient;
        node.vy += Math.cos(t * 0.95 + node.phase * 1.3) * p.ambient;
      }
      node.vx += (cx - node.x) * p.centerPull;
      node.vy += (cy - node.y) * p.centerPull;
      node.vx *= p.damping;
      node.vy *= p.damping;
      node.x += node.vx;
      node.y += node.vy;

      const pad = node.r + 8;
      if (node.x < pad) {
        node.x = pad;
        node.vx *= -0.25;
      } else if (node.x > width - pad) {
        node.x = width - pad;
        node.vx *= -0.25;
      }
      if (node.y < pad) {
        node.y = pad;
        node.vy *= -0.25;
      } else if (node.y > height - pad) {
        node.y = height - pad;
        node.vy *= -0.25;
      }
    }
  }
}

export function hitTestNode(
  sim: ConstellationSim,
  px: number,
  py: number,
): number | null {
  let best: number | null = null;
  let bestD = Infinity;

  for (let i = 0; i < sim.nodes.length; i++) {
    const n = sim.nodes[i]!;
    const d = Math.hypot(n.x - px, n.y - py);
    if (d <= n.baseR && d < bestD) {
      bestD = d;
      best = i;
    }
  }

  return best;
}

export interface Viewport {
  scale: number;
  panX: number;
  panY: number;
}

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 2.75;

export function screenToWorld(
  vp: Viewport,
  sx: number,
  sy: number,
): { x: number; y: number } {
  return {
    x: (sx - vp.panX) / vp.scale,
    y: (sy - vp.panY) / vp.scale,
  };
}

export function worldToScreen(
  vp: Viewport,
  wx: number,
  wy: number,
): { x: number; y: number } {
  return {
    x: wx * vp.scale + vp.panX,
    y: wy * vp.scale + vp.panY,
  };
}

export function applyWheelZoom(
  vp: Viewport,
  sx: number,
  sy: number,
  deltaY: number,
): void {
  const factor = deltaY > 0 ? 1.09 : 1 / 1.09;
  const prev = vp.scale;
  const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev * factor));
  if (Math.abs(next - prev) < 0.001) return;

  const wx = (sx - vp.panX) / prev;
  const wy = (sy - vp.panY) / prev;
  vp.scale = next;
  vp.panX = sx - wx * next;
  vp.panY = sy - wy * next;

  if (next <= MIN_ZOOM) {
    vp.scale = MIN_ZOOM;
    vp.panX = 0;
    vp.panY = 0;
  }
}

export function drawCaptionBanner(
  ctx: CanvasRenderingContext2D,
  width: number,
  caption: string,
  accentColor: string,
): void {
  const text = caption.trim();
  if (!text) return;

  const colors = buildSchemeFromAccent(accentColor);
  const padX = 14;
  const boxH = 34;
  const y = 10;

  ctx.save();
  ctx.font = '11px "IBM Plex Mono", monospace';
  const maxW = width - 32;
  let display = text.slice(0, 48);
  while (display.length > 1 && ctx.measureText(display).width > maxW - padX * 2) {
    display = display.slice(0, -1);
  }
  if (display.length < text.length) display += "…";

  const textW = ctx.measureText(display).width;
  const boxW = Math.min(maxW, Math.max(textW + padX * 2, 100));
  const x = (width - boxW) / 2;

  ctx.fillStyle = "rgba(15, 17, 24, 0.94)";
  ctx.fillRect(x, y, boxW, boxH);
  ctx.strokeStyle = colors.accent;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 0.5, y + 0.5, boxW - 1, boxH - 1);

  ctx.fillStyle = colors.accent;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(display, x + boxW / 2, y + boxH / 2);
  ctx.restore();
}

export function drawConstellation(
  ctx: CanvasRenderingContext2D,
  sim: ConstellationSim,
  opts: SimOptions & {
    mapCount?: number;
    commitsTotal?: number;
    skipBackground?: boolean;
    caption?: string;
    drawCaption?: boolean;
  },
): void {
  const colors = buildSchemeFromAccent(opts.accentColor);
  const { width, height, nodes, links } = sim;
  const highlight =
    opts.dragged !== null ? opts.dragged : opts.hovered;

  if (!opts.skipBackground) {
    ctx.fillStyle = opts.bg;
    ctx.fillRect(0, 0, width, height);
  }

  ctx.strokeStyle = colors.accent;
  ctx.globalAlpha = 0.2;
  ctx.lineWidth = 1;
  for (const link of links) {
    const a = nodes[link.a];
    const b = nodes[link.b];
    if (!a || !b) continue;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]!;
    const active = i === highlight;
    const lvl = active ? 3 : 1;
    ctx.fillStyle = colors.levels[lvl] ?? colors.levels[1];
    ctx.beginPath();
    ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
    ctx.fill();
    if (active) {
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = opts.dragged === i ? 3 : 2;
      ctx.stroke();
    }
  }

  if (opts.drawCaption !== false && opts.caption?.trim()) {
    drawCaptionBanner(ctx, width, opts.caption, opts.accentColor);
  }

  if (opts.mapCount !== undefined) {
    const total = opts.commitsTotal ?? opts.mapCount;
    const label =
      total > opts.mapCount
        ? `${opts.mapCount} of ${total} commits`
        : `${opts.mapCount} commits`;
    ctx.font = '11px "IBM Plex Mono", monospace';
    ctx.fillStyle = "#94b0c2";
    ctx.fillText(label, 12, height - 12);
  }
}
