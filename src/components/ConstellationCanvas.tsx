"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  forwardRef,
} from "react";
import type { CommitRecord, HeatmapConfig } from "@/lib/types";
import {
  applyWheelZoom,
  buildConstellation,
  drawCaptionBanner,
  drawConstellation,
  hitTestNode,
  maxNodeSpeed,
  rescaleSim,
  relaxLayout,
  screenToWorld,
  stepSimulation,
  worldToScreen,
  zeroVelocities,
  type ConstellationSim,
  type Viewport,
} from "@/lib/constellation-engine";

export interface ConstellationCanvasHandle {
  exportPng: (filename: string) => void;
}

interface Props {
  commits: CommitRecord[];
  commitsTotal?: number;
  config: HeatmapConfig;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export const ConstellationCanvas = forwardRef<ConstellationCanvasHandle, Props>(
  function ConstellationCanvas({ commits, commitsTotal, config }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const wrapRef = useRef<HTMLDivElement>(null);
    const simRef = useRef<ConstellationSim | null>(null);
    const rafRef = useRef<number>(0);
    const pointerRef = useRef<{ x: number; y: number } | null>(null);
    const viewportRef = useRef<Viewport>({ scale: 1, panX: 0, panY: 0 });

    const hoveredRef = useRef<number | null>(null);
    const draggedRef = useRef<number | null>(null);
    const dragPosRef = useRef({ x: 0, y: 0 });
    const didDragRef = useRef(false);
    const downPosRef = useRef({ x: 0, y: 0 });
    const frozenRef = useRef(false);
    const calmFramesRef = useRef(0);

    const [tooltip, setTooltip] = useState<{
      x: number;
      y: number;
      headline: string;
      date: string;
      repo: string;
    } | null>(null);

    const [cursor, setCursor] = useState("default");
    const [canvasSize, setCanvasSize] = useState({ w: 720, h: 420 });

    const measureSize = useCallback(() => {
      const wrap = wrapRef.current;
      if (!wrap) return null;
      const n = commits.length;
      const w = Math.min(900, Math.max(320, wrap.clientWidth - 8));
      let aspect = 0.55;
      if (n > 200) aspect = 0.65;
      if (n > 400) aspect = 0.78;
      if (n > 550) aspect = 0.88;
      const maxH = n > 400 ? 660 : 520;
      const h = Math.min(maxH, Math.max(300, Math.round(w * aspect)));
      return { w, h };
    }, [commits.length]);

    const screenPoint = useCallback(
      (clientX: number, clientY: number): { x: number; y: number } | null => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return null;
        const { w, h } = canvasSize;
        return {
          x: ((clientX - rect.left) / rect.width) * w,
          y: ((clientY - rect.top) / rect.height) * h,
        };
      },
      [canvasSize],
    );

    const canvasPoint = useCallback(
      (clientX: number, clientY: number): { x: number; y: number } | null => {
        const s = screenPoint(clientX, clientY);
        if (!s) return null;
        return screenToWorld(viewportRef.current, s.x, s.y);
      },
      [screenPoint],
    );

    const syncHoverFromPointer = useCallback(() => {
      const sim = simRef.current;
      const ptr = pointerRef.current;
      if (!sim || !ptr || draggedRef.current !== null) return;

      const hit = hitTestNode(sim, ptr.x, ptr.y);
      const prev = hoveredRef.current;
      hoveredRef.current = hit;
      if (hit === prev) return;
      setCursor(hit !== null ? "grab" : "default");

      if (hit !== null) {
        const n = sim.nodes[hit]!;
        const { x: sx, y: sy } = worldToScreen(
          viewportRef.current,
          n.x,
          n.y,
        );
        setTooltip({
          x: sx,
          y: sy,
          headline: n.headline,
          date: formatDate(n.date),
          repo: n.repo,
        });
      } else {
        setTooltip(null);
      }
    }, []);

    useEffect(() => {
      const size = measureSize();
      if (!size) return;

      setCanvasSize(size);

      if (!commits.length) {
        simRef.current = null;
        return;
      }

      simRef.current = buildConstellation(commits, size.w, size.h);
      viewportRef.current = { scale: 1, panX: 0, panY: 0 };
      frozenRef.current = false;
      calmFramesRef.current = 0;
    }, [commits, measureSize]);

    useEffect(() => {
      const onResize = () => {
        const size = measureSize();
        if (!size) return;

        setCanvasSize((prev) => {
          if (prev.w === size.w && prev.h === size.h) return prev;
          viewportRef.current = { scale: 1, panX: 0, panY: 0 };
          frozenRef.current = false;
          calmFramesRef.current = 0;
          return size;
        });

        if (simRef.current) {
          rescaleSim(simRef.current, size.w, size.h);
          relaxLayout(simRef.current, commits.length > 400 ? 60 : 80);
          zeroVelocities(simRef.current);
        }
      };

      const ro = new ResizeObserver(onResize);
      if (wrapRef.current) ro.observe(wrapRef.current);
      return () => ro.disconnect();
    }, [commits.length, measureSize]);

    useImperativeHandle(ref, () => ({
      exportPng(filename: string) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const link = document.createElement("a");
        link.download = filename;
        link.href = canvas.toDataURL("image/png");
        link.click();
      },
    }));

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas || !commits.length) return;

      const dpr = window.devicePixelRatio || 1;
      const { w, h } = canvasSize;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const loop = (now: number) => {
        const sim = simRef.current;
        if (!sim) return;

        syncHoverFromPointer();

        const drag = dragPosRef.current;
        const dragging = draggedRef.current !== null;
        stepSimulation(sim, {
          hovered: hoveredRef.current,
          dragged: draggedRef.current,
          dragX: drag.x,
          dragY: drag.y,
          time: now,
          accentColor: config.accentColor,
          bg: config.bg,
          frozen: frozenRef.current && !dragging,
        });

        if (!frozenRef.current && !dragging) {
          if (maxNodeSpeed(sim) < 0.05) {
            calmFramesRef.current += 1;
          } else {
            calmFramesRef.current = 0;
          }
          if (calmFramesRef.current > 35) {
            frozenRef.current = true;
            zeroVelocities(sim);
          }
        }

        const vp = viewportRef.current;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = config.bg;
        ctx.fillRect(0, 0, w, h);

        ctx.save();
        ctx.translate(vp.panX, vp.panY);
        ctx.scale(vp.scale, vp.scale);
        drawConstellation(ctx, sim, {
          hovered: hoveredRef.current,
          dragged: draggedRef.current,
          dragX: drag.x,
          dragY: drag.y,
          time: now,
          accentColor: config.accentColor,
          bg: config.bg,
          mapCount: commits.length,
          commitsTotal,
          skipBackground: true,
        });
        ctx.restore();

        drawCaptionBanner(ctx, w, config.caption, config.accentColor);

        rafRef.current = requestAnimationFrame(loop);
      };

      rafRef.current = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(rafRef.current);
    }, [
      commits,
      config.accentColor,
      config.bg,
      config.caption,
      canvasSize,
      syncHoverFromPointer,
    ]);

    const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (e.button !== 0) return;
      const pt = canvasPoint(e.clientX, e.clientY);
      if (!pt) return;

      pointerRef.current = pt;
      const hit = hitTestNode(simRef.current!, pt.x, pt.y);
      downPosRef.current = { x: e.clientX, y: e.clientY };
      didDragRef.current = false;

      if (hit !== null) {
        draggedRef.current = hit;
        dragPosRef.current = { x: pt.x, y: pt.y };
        hoveredRef.current = hit;
        setCursor("grabbing");
        e.preventDefault();
      }
    };

    const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
      const pt = canvasPoint(e.clientX, e.clientY);
      const sim = simRef.current;
      if (!pt || !sim) return;

      pointerRef.current = pt;

      if (draggedRef.current !== null) {
        const moved =
          Math.hypot(
            e.clientX - downPosRef.current.x,
            e.clientY - downPosRef.current.y,
          ) > 4;
        if (moved) didDragRef.current = true;

        dragPosRef.current = { x: pt.x, y: pt.y };
        const n = sim.nodes[draggedRef.current]!;
        const { x: sx, y: sy } = worldToScreen(
          viewportRef.current,
          n.x,
          n.y,
        );
        setTooltip({
          x: sx,
          y: sy,
          headline: n.headline,
          date: formatDate(n.date),
          repo: n.repo,
        });
      }
    };

    const endDrag = () => {
      const wasDragging = draggedRef.current !== null;
      draggedRef.current = null;
      if (wasDragging) {
        frozenRef.current = false;
        calmFramesRef.current = 0;
      }
      syncHoverFromPointer();
    };

    const onMouseUp = () => {
      const wasDragging = draggedRef.current;
      const sim = simRef.current;

      if (wasDragging !== null && sim && !didDragRef.current) {
        const n = sim.nodes[wasDragging]!;
        window.open(n.url, "_blank", "noopener,noreferrer");
      }

      endDrag();
    };

    useEffect(() => {
      const onWindowUp = () => {
        if (draggedRef.current !== null) endDrag();
      };
      window.addEventListener("mouseup", onWindowUp);
      return () => window.removeEventListener("mouseup", onWindowUp);
    }, [syncHoverFromPointer]);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const onWheel = (e: WheelEvent) => {
        const sim = simRef.current;
        if (!sim) return;

        const screen = screenPoint(e.clientX, e.clientY);
        if (!screen) return;

        const world = screenToWorld(viewportRef.current, screen.x, screen.y);
        const overGraph =
          hitTestNode(sim, world.x, world.y) !== null ||
          hoveredRef.current !== null;
        if (!overGraph) return;

        e.preventDefault();
        applyWheelZoom(viewportRef.current, screen.x, screen.y, e.deltaY);
      };

      canvas.addEventListener("wheel", onWheel, { passive: false });
      return () => canvas.removeEventListener("wheel", onWheel);
    }, [screenPoint]);

    const onMouseLeave = () => {
      pointerRef.current = null;
      if (draggedRef.current === null) {
        hoveredRef.current = null;
        setTooltip(null);
        setCursor("default");
      }
    };

    if (!commits.length) {
      return (
        <p className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">
          No commit data. Add a token to .env (GITHUB_TOKEN or GitHubUsername).
        </p>
      );
    }

    return (
      <div ref={wrapRef} className="constellation-host relative w-full">
        <canvas
          ref={canvasRef}
          className="constellation-canvas mx-auto block"
          style={{ cursor }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseLeave}
          aria-label="Interactive commit constellation"
        />
        {tooltip && (
          <div
            className="constellation-tooltip"
            style={{
              left: Math.min(
                tooltip.x + 14,
                (wrapRef.current?.clientWidth ?? 300) - 220,
              ),
              top: tooltip.y - 8,
            }}
          >
            <p className="constellation-tooltip__date">{tooltip.date}</p>
            <p className="constellation-tooltip__msg">{tooltip.headline}</p>
            <p className="constellation-tooltip__repo">{tooltip.repo}</p>
          </div>
        )}
      </div>
    );
  },
);
