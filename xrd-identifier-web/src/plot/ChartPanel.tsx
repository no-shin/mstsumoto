/**
 * SVG 文字列を描画し、ポインタ操作(ズーム矩形・probe・各種ドラッグ)を配線する。
 * ドラッグ中は DOM を直接動かし、pointerup で state に確定する(元アプリと同じ方式)。
 */

import { useEffect, useRef } from 'react';
import type { AppState, PeakAlignment, ZoomView } from '../core/types';
import { clamp, num } from '../core/utils';
import { sBool, sNum } from '../core/settings';
import { snapProbeAngle } from '../core/xrd/identify';
import { nearestMeasuredPeakTwoTheta } from '../core/xrd/lattice';
import { SVG_NS } from './svg/build';

export interface ChartPanelProps {
  svgText: string;
  state: AppState;
  update: (recipe: (s: AppState) => AppState, record?: boolean | 'edit') => void;
}

interface PlotFrame {
  left: number;
  top: number;
  width: number;
  height: number;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

function readFrame(svg: SVGSVGElement): PlotFrame | null {
  const d = svg.dataset;
  const frame = {
    left: Number(d.plotLeft),
    top: Number(d.plotTop),
    width: Number(d.plotWidth),
    height: Number(d.plotHeight),
    xMin: Number(d.xMin),
    xMax: Number(d.xMax),
    yMin: Number(d.yMin),
    yMax: Number(d.yMax),
  };
  return Object.values(frame).every(Number.isFinite) ? frame : null;
}

function svgPoint(svg: SVGSVGElement, e: PointerEvent | MouseEvent): { x: number; y: number } {
  const p = svg.createSVGPoint();
  p.x = e.clientX;
  p.y = e.clientY;
  const m = svg.getScreenCTM();
  return m ? p.matrixTransform(m.inverse()) : { x: e.clientX, y: e.clientY };
}

export function ChartPanel({ svgText, state, update }: ChartPanelProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const svg = host.querySelector('svg') as SVGSVGElement | null;
    if (!svg) return;
    const frame = readFrame(svg);
    if (!frame) return;
    const abort = new AbortController();
    const opts = { signal: abort.signal } as AddEventListenerOptions;
    const mode = svg.dataset.mode || 'xrd';
    const { left, top, width, height, xMin, xMax, yMin, yMax } = frame;
    const inside = (p: { x: number; y: number }) =>
      p.x >= left && p.x <= left + width && p.y >= top && p.y <= top + height;
    const angleFromPoint = (p: { x: number }) =>
      xMin + ((clamp(p.x, left, left + width) - left) / width) * (xMax - xMin);
    const yFromPoint = (p: { y: number }) =>
      yMax - ((clamp(p.y, top, top + height) - top) / height) * (yMax - yMin);
    const xFromAngle = (angle: number) => left + ((angle - xMin) / (xMax - xMin)) * width;
    const viewFromPoints = (p0: { x: number; y: number }, p1: { x: number; y: number }): ZoomView => {
      const xa = xMin + ((Math.min(p0.x, p1.x) - left) / width) * (xMax - xMin);
      const xb = xMin + ((Math.max(p0.x, p1.x) - left) / width) * (xMax - xMin);
      const yt = yMax - ((Math.min(p0.y, p1.y) - top) / height) * (yMax - yMin);
      const yb = yMax - ((Math.max(p0.y, p1.y) - top) / height) * (yMax - yMin);
      return { xMin: Math.min(xa, xb), xMax: Math.max(xa, xb), yMin: Math.min(yb, yt), yMax: Math.max(yb, yt) };
    };

    const viewKey = mode === 'mh' ? 'mhZoomView' : mode === 'mt' ? 'mtZoomView' : 'xrdZoomView';
    const historyKey = mode === 'mh' ? 'mhZoomHistory' : mode === 'mt' ? 'mtZoomHistory' : 'xrdZoomHistory';

    // 右クリック: ズームを1段戻す
    svg.addEventListener(
      'contextmenu',
      (e) => {
        e.preventDefault();
        update((s) => {
          const history = (s[historyKey] as (ZoomView | null)[]) || [];
          if (history.length) {
            const prev = history[history.length - 1];
            return { ...s, [viewKey]: prev ? { ...prev } : null, [historyKey]: history.slice(0, -1) };
          }
          if (s[viewKey]) return { ...s, [viewKey]: null };
          return s;
        });
      },
      opts,
    );

    let zoomStart: { x: number; y: number } | null = null;
    let zoomRect: SVGRectElement | null = null;
    let probeDragging = false;
    let refDragging: {
      el: SVGGraphicsElement;
      markerX: number;
      markerY: number;
    } | null = null;
    let legendDrag: { el: SVGGElement; dx: number; dy: number; mode: string } | null = null;
    let derivDrag: { kind: 'd1' | 'd2'; startRatio: number; startY: number } | null = null;
    let tcDrag: {
      key: string;
      kind: 'move' | 'target';
      start: { x: number; y: number };
      old: { x: number; y: number; w: number; h: number; targetX: number; targetY: number };
    } | null = null;

    const setRect = (a: { x: number; y: number }, b: { x: number; y: number }) => {
      if (!zoomRect) {
        zoomRect = document.createElementNS(SVG_NS, 'rect') as SVGRectElement;
        zoomRect.setAttribute('fill', 'rgba(37,99,235,0.14)');
        zoomRect.setAttribute('stroke', '#2563eb');
        zoomRect.setAttribute('stroke-width', '1.5');
        zoomRect.setAttribute('stroke-dasharray', '5 4');
        zoomRect.setAttribute('pointer-events', 'none');
        svg.appendChild(zoomRect);
      }
      zoomRect.setAttribute('x', String(Math.min(a.x, b.x)));
      zoomRect.setAttribute('y', String(Math.min(a.y, b.y)));
      zoomRect.setAttribute('width', String(Math.abs(a.x - b.x)));
      zoomRect.setAttribute('height', String(Math.abs(a.y - b.y)));
    };

    const moveProbeDom = (x: number, angle: number) => {
      svg.querySelectorAll('.probeX').forEach((el) => {
        if (el.tagName === 'line') {
          el.setAttribute('x1', String(x));
          el.setAttribute('x2', String(x));
        } else if (el.tagName === 'circle') {
          el.setAttribute('cx', String(x));
        } else if (el.tagName === 'text') {
          el.setAttribute('x', String(x));
          el.textContent = `${angle.toFixed(3)}°`;
        }
      });
    };

    svg.addEventListener(
      'pointerdown',
      (e) => {
        if (e.button !== 0) return;
        const p = svgPoint(svg, e);
        const target = e.target as Element;
        if (mode === 'xrd') {
          const refMarker = target.closest?.('.xrdRefMarker') as SVGGraphicsElement | null;
          if (refMarker) {
            e.preventDefault();
            update((s) => ({
              ...s,
              lastSelectedMarkerKey: refMarker.dataset.refKey || null,
              lastSelectedMarkerPhase: refMarker.dataset.phase || '',
            }));
            refDragging = {
              el: refMarker,
              markerX: Number(refMarker.dataset.svgX),
              markerY: Number(refMarker.dataset.svgY),
            };
            try {
              svg.setPointerCapture(e.pointerId);
            } catch { /* noop */ }
            return;
          }
          if (target.closest?.('.probeHandle,.probeHit')) {
            e.preventDefault();
            probeDragging = true;
            try {
              svg.setPointerCapture(e.pointerId);
            } catch { /* noop */ }
            return;
          }
        }
        const legend = target.closest?.('.movableLegend') as SVGGElement | null;
        if (legend) {
          e.preventDefault();
          e.stopPropagation();
          const matrix = legend.transform.baseVal.consolidate()?.matrix;
          legendDrag = {
            el: legend,
            dx: p.x - (matrix ? matrix.e : 0),
            dy: p.y - (matrix ? matrix.f : 0),
            mode: legend.dataset.legendMode || mode,
          };
          try {
            svg.setPointerCapture(e.pointerId);
          } catch { /* noop */ }
          return;
        }
        if (mode === 'mt') {
          const deriv = target.closest?.('[data-derivative]') as SVGElement | null;
          if (deriv) {
            e.preventDefault();
            const kind = deriv.dataset.derivative === 'd2' ? 'd2' : 'd1';
            const layout = stateRef.current.mtDerivativeLayout;
            derivDrag = {
              kind,
              startRatio: kind === 'd2' ? layout.d2BaseRatio : layout.d1BaseRatio,
              startY: p.y,
            };
            update((s) => s, true); // ドラッグ開始時に undo ポイント
            try {
              svg.setPointerCapture(e.pointerId);
            } catch { /* noop */ }
            return;
          }
          const tcEl = target.closest?.('[data-tc-label],[data-tc-target]') as SVGElement | null;
          if (tcEl) {
            e.preventDefault();
            e.stopPropagation();
            const key = tcEl.dataset.tcLabel || tcEl.dataset.tcTarget || '';
            const kind: 'move' | 'target' = tcEl.dataset.tcLabel ? 'move' : 'target';
            const old = { x: 0, y: 0, w: 0, h: 0, targetX: 0, targetY: 0 };
            const a = stateRef.current.mtTcAnnotations[key] || {};
            const label = svg.querySelector(`[data-tc-label="${CSS.escape(key)}"]`);
            const targetC = svg.querySelector(`[data-tc-target="${CSS.escape(key)}"]`);
            const box = label?.querySelector('.tcBox');
            if (box) {
              old.x = num(a.x, Number(box.getAttribute('x')));
              old.y = num(a.y, Number(box.getAttribute('y')));
              old.w = num(a.w, Number(box.getAttribute('width')));
              old.h = num(a.h, Number(box.getAttribute('height')));
            }
            if (targetC) {
              old.targetX = num(a.targetX, Number(targetC.getAttribute('cx')));
              old.targetY = num(a.targetY, Number(targetC.getAttribute('cy')));
            }
            tcDrag = { key, kind, start: p, old };
            update((s) => s, true);
            try {
              svg.setPointerCapture(e.pointerId);
            } catch { /* noop */ }
            return;
          }
        }
        if (!inside(p)) return;
        e.preventDefault();
        zoomStart = { x: clamp(p.x, left, left + width), y: clamp(p.y, top, top + height) };
        try {
          svg.setPointerCapture(e.pointerId);
        } catch { /* noop */ }
      },
      opts,
    );

    svg.addEventListener(
      'pointermove',
      (e) => {
        const p = svgPoint(svg, e);
        if (refDragging) {
          const nowX = clamp(p.x, left, left + width);
          const nowY = clamp(p.y, top, top + height);
          refDragging.el.setAttribute(
            'transform',
            `translate(${(nowX - refDragging.markerX).toFixed(2)} ${(nowY - refDragging.markerY).toFixed(2)})`,
          );
          return;
        }
        if (probeDragging) {
          const angle = angleFromPoint(p);
          moveProbeDom(xFromAngle(angle), angle);
          return;
        }
        if (legendDrag) {
          const pos = { x: p.x - legendDrag.dx, y: p.y - legendDrag.dy };
          legendDrag.el.setAttribute('transform', `translate(${pos.x.toFixed(2)} ${pos.y.toFixed(2)})`);
          return;
        }
        if (derivDrag) {
          const nextRatio = clamp(derivDrag.startRatio - (p.y - derivDrag.startY) / height, 0, 1);
          const kind = derivDrag.kind;
          update((s) => ({
            ...s,
            mtDerivativeLayout: {
              ...s.mtDerivativeLayout,
              [kind === 'd2' ? 'd2BaseRatio' : 'd1BaseRatio']: nextRatio,
            },
            settings: {
              ...s.settings,
              [kind === 'd2' ? 'mtD2Pos' : 'mtD1Pos']: String(Math.round(nextRatio * 100)),
            },
          }));
          return;
        }
        if (tcDrag) {
          const dx = p.x - tcDrag.start.x;
          const dy = p.y - tcDrag.start.y;
          const drag = tcDrag;
          update((s) => {
            const a = { ...(s.mtTcAnnotations[drag.key] || {}) };
            if (drag.kind === 'move') {
              a.x = clamp(drag.old.x + dx, left + 4, left + width - drag.old.w - 4);
              a.y = clamp(drag.old.y + dy, top + 4, top + height - drag.old.h - 4);
            } else {
              a.targetX = clamp(p.x, left + 4, left + width - 4);
              a.targetY = clamp(p.y, top + 4, top + height - 4);
            }
            return { ...s, mtTcAnnotations: { ...s.mtTcAnnotations, [drag.key]: a } };
          });
          return;
        }
        if (zoomStart) {
          setRect(zoomStart, { x: clamp(p.x, left, left + width), y: clamp(p.y, top, top + height) });
        }
      },
      opts,
    );

    svg.addEventListener(
      'pointerup',
      (e) => {
        const p = svgPoint(svg, e);
        if (refDragging) {
          const el = refDragging.el;
          refDragging = null;
          const st = stateRef.current;
          const x = clamp(p.x, left, left + width);
          const originalAngle = Number(el.dataset.originalAngle);
          const maxShift = Math.max(0.1, sNum(st.settings, 'markerDragMaxShift', 5));
          const draggedAngle = clamp(
            angleFromPoint({ x }),
            originalAngle - maxShift,
            originalAngle + maxShift,
          );
          const snapTol = Math.max(0.01, sNum(st.settings, 'markerDragSnapTol', 0.1));
          const snappedAngle = sBool(st.settings, 'markerDragSnap', true)
            ? nearestMeasuredPeakTwoTheta(st, draggedAngle, snapTol, el.dataset.traceId)
            : NaN;
          const correctedAngle = clamp(
            Number.isFinite(snappedAngle) ? snappedAngle : draggedAngle,
            originalAngle - maxShift,
            originalAngle + maxShift,
          );
          const baseY = Number(el.dataset.baseY);
          const yOffset = Number.isFinite(baseY) ? clamp(yFromPoint(p) - baseY, -120, 120) : 0;
          const key = el.dataset.refKey || '';
          const alignment: PeakAlignment = {
            key,
            referenceName: el.dataset.phase || '',
            originalTwoTheta: originalAngle,
            correctedTwoTheta: correctedAngle,
            matchedMeasuredPeakTwoTheta: Number.isFinite(snappedAngle)
              ? snappedAngle
              : nearestMeasuredPeakTwoTheta(st, correctedAngle),
            h: el.dataset.h ?? null,
            k: el.dataset.k ?? null,
            l: el.dataset.l ?? null,
            d: Number(el.dataset.d),
            intensity: Number(el.dataset.intensity),
            use: true,
          };
          update(
            (s) => ({
              ...s,
              xrdMarkerOffsets: {
                ...s.xrdMarkerOffsets,
                [key]: { twoTheta: correctedAngle, yOffset },
              },
              xrdPeakAlignments: { ...s.xrdPeakAlignments, [key]: alignment },
            }),
            true,
          );
          return;
        }
        if (probeDragging) {
          probeDragging = false;
          const angle = angleFromPoint(p);
          update((s) => ({
            ...s,
            probe: { angle: Math.max(Math.min(angle, xMax), xMin) },
          }));
          return;
        }
        if (legendDrag) {
          const pos = { x: p.x - legendDrag.dx, y: p.y - legendDrag.dy };
          const lm = legendDrag.mode;
          legendDrag = null;
          update((s) => (lm === 'mh' ? { ...s, mhLegend: pos } : { ...s, mtLegend: pos }));
          return;
        }
        if (derivDrag) {
          derivDrag = null;
          return;
        }
        if (tcDrag) {
          tcDrag = null;
          return;
        }
        if (!zoomStart || !zoomRect) {
          zoomStart = null;
          return;
        }
        const p0 = zoomStart;
        const p1 = { x: clamp(p.x, left, left + width), y: clamp(p.y, top, top + height) };
        const w = Math.abs(p1.x - p0.x);
        const h = Math.abs(p1.y - p0.y);
        zoomRect.remove();
        zoomRect = null;
        zoomStart = null;
        if (w < 10 || h < 10) {
          // XRD ではクリックで probe を置く
          if (mode === 'xrd' && inside(p1)) {
            const st = stateRef.current;
            const angle = snapProbeAngle(st, angleFromPoint(p1));
            update((s) => ({ ...s, probe: { angle: Math.max(Math.min(angle, xMax), xMin) } }));
          }
          return;
        }
        const view = viewFromPoints(p0, p1);
        update(
          (s) => ({
            ...s,
            [historyKey]: [
              ...((s[historyKey] as (ZoomView | null)[]) || []),
              s[viewKey] ? { ...(s[viewKey] as ZoomView) } : null,
            ],
            [viewKey]: view,
          }),
          true,
        );
      },
      opts,
    );

    return () => abort.abort();
  }, [svgText, update]);

  return (
    <div id="svgHost" ref={hostRef} dangerouslySetInnerHTML={{ __html: svgText }} />
  );
}
