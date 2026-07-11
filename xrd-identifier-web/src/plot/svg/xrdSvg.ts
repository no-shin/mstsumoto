/** XRD 積み上げグラフの SVG 文字列生成(論文風スタイル) */

import type { AppState } from '../../core/types';
import { esc, interpY, num } from '../../core/utils';
import { sBool, sNum, sStr } from '../../core/settings';
import { hklText } from '../../core/parse/refPeaks';
import { observedMarkerSupport } from '../../core/peaks/detect';
import {
  normalizedPoints,
  sampleDataName,
  selectedRefPeaksForTrace,
  selectedRefSets,
  visibleMeasured,
} from '../../core/xrd/identify';
import { alignedPeakAngle, markerStateKey } from '../../core/xrd/lattice';
import { SVG_NS, buildLegendLayout, markerSvg, svgRichText } from './build';

export function makeXrdSvg(state: AppState): string {
  const s = state.settings;
  const measured = visibleMeasured(state);
  const normByTrace = new Map(measured.map((tr) => [tr.id, normalizedPoints(tr, s)]));
  const refSets = selectedRefSets(state);
  const baseXMin = sNum(s, 'xMin', 20);
  const baseXMax = sNum(s, 'xMax', 70);
  const xMin = state.xrdZoomView ? state.xrdZoomView.xMin : baseXMin;
  const xMax = state.xrdZoomView ? state.xrdZoomView.xMax : baseXMax;
  const offset = sNum(s, 'offset', 120);
  const yPad = sNum(s, 'yPad', 45);
  const topPad = sNum(s, 'topPad', 55);
  const svgW = sNum(s, 'svgW', 960);
  const svgH = sNum(s, 'svgH', 760);
  const fontSize = sNum(s, 'fontSize', 34);
  const lineWidth = sNum(s, 'lineWidth', 1.4);
  const markerSize = sNum(s, 'markerSize', 12);
  const markerLift = sNum(s, 'markerLift', 15);
  const markerJitter = sNum(s, 'markerJitter', 0);
  const hideUnmatchedMarkers = sBool(s, 'hideUnmatchedMarkers', true);
  const markerPeakWindow = sNum(s, 'markerPeakWindow', Math.max(sNum(s, 'tol', 0.2), 0.2));
  const markerPeakMin = sNum(s, 'markerPeakMin', 2.0);
  const markerPeakProminence = sNum(s, 'markerPeakProminence', 1.0);
  const markerShoulderDetect = sBool(s, 'markerShoulderDetect', true);
  const baseMarkerScale = sNum(s, 'markerScale', 0.75);
  const autoMarkerScale = sStr(s, 'autoMarkerScale', 'on') === 'on';
  const markerMode = sStr(s, 'markerMode', 'curve');
  const hklMinI = sNum(s, 'hklMinI', 60);
  const n = Math.max(1, measured.length);
  const showMarkers = sBool(s, 'showMarkers', true);
  const showSticks = sBool(s, 'showSticks', false);
  const hklLabel = sBool(s, 'hklLabel', false);
  const showYTicks = sBool(s, 'showYTicks', false);
  const showLegend = sBool(s, 'showLegend', true);
  const labelPos = sStr(s, 'labelPos', 'right');
  const orderTop = sStr(s, 'order', 'top') === 'top';
  const showOriginalMarkers = sBool(s, 'showOriginalMarkers', true);

  const stickRows = showSticks ? refSets.length : 0;
  const stickPanelH = showSticks ? Math.min(150, 22 * stickRows + 18) : 0;
  const yMinDefault = -Math.max(0, yPad);
  const yMaxDefault = 100 + offset * (n - 1) + Math.max(0, topPad);
  const yMin =
    state.xrdZoomView && Number.isFinite(state.xrdZoomView.yMin) ? state.xrdZoomView.yMin : yMinDefault;
  const yMax =
    state.xrdZoomView && Number.isFinite(state.xrdZoomView.yMax) ? state.xrdZoomView.yMax : yMaxDefault;
  const marginLR = { l: 165, r: 82 };
  const plotW0 = Math.max(120, svgW - marginLR.l - marginLR.r);
  const legendFont = Math.max(15, fontSize * 0.54);
  const legendRows = showLegend && refSets.length ? buildLegendLayout(refSets, plotW0, legendFont) : [];
  const legendRowH = Math.max(25, legendFont * 1.55);
  const legendH = legendRows.length ? Math.max(48, legendRows.length * legendRowH + 18) : 20;
  const margin = { l: marginLR.l, r: marginLR.r, t: 34 + legendH, b: 112 + stickPanelH };
  const plotW = Math.max(120, svgW - margin.l - margin.r);
  const plotH = Math.max(120, svgH - margin.t - margin.b);
  const sx = (x: number) => margin.l + ((x - xMin) / (xMax - xMin)) * plotW;
  const sy = (y: number) => margin.t + ((yMax - y) / (yMax - yMin)) * plotH;
  const plotBottom = margin.t + plotH;
  const tickIn = Math.max(10, Math.min(22, fontSize * 0.45));

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="${SVG_NS}" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}" role="img" data-x-min="${xMin}" data-x-max="${xMax}" data-y-min="${yMin}" data-y-max="${yMax}" data-plot-left="${margin.l}" data-plot-top="${margin.t}" data-plot-width="${plotW}" data-plot-height="${plotH}">`,
  );
  parts.push(`<rect width="100%" height="100%" fill="white"/>`);
  parts.push(`<style>
    text{font-family:'Times New Roman','Yu Mincho',serif;fill:#000}
    .axis{stroke:#000;stroke-width:2;fill:none}
    .trace{fill:none;stroke:#000;stroke-linejoin:round;stroke-linecap:round}
    .tick{stroke:#000;stroke-width:2}
    .marker{stroke-width:1}
    .stick{stroke-width:1.4}
    .refLabel{font-family:'Times New Roman','Yu Mincho',serif}
  </style>`);
  parts.push(
    `<defs><clipPath id="plotClip"><rect x="${margin.l}" y="${margin.t}" width="${plotW}" height="${plotH}"/></clipPath></defs>`,
  );
  if (showLegend && legendRows.length) {
    const legendY0 = Math.max(24, margin.t - legendH + 24);
    legendRows.forEach((rowItems, rowIdx) => {
      let xCursor = margin.l + 8;
      const y = legendY0 + rowIdx * legendRowH;
      rowItems.forEach((item) => {
        const r = item.ref;
        parts.push(markerSvg(xCursor, y, r.marker || 'triangle_down', r.color, Math.max(7, legendFont * 0.5)));
        parts.push(
          svgRichText(xCursor + Math.max(22, legendFont * 1.15), y + legendFont * 0.38, item.label, {
            fontSize: legendFont,
            anchor: 'start',
          }),
        );
        xCursor += item.itemW;
      });
    });
  }
  parts.push(`<rect class="axis" x="${margin.l}" y="${margin.t}" width="${plotW}" height="${plotH}"/>`);

  const startTick = Math.ceil(xMin / 10) * 10;
  for (let x = startTick; x <= xMax + 1e-9; x += 10) {
    const X = sx(x);
    parts.push(`<line class="tick" x1="${X}" y1="${plotBottom}" x2="${X}" y2="${plotBottom - tickIn}"/>`);
    parts.push(`<line class="tick" x1="${X}" y1="${margin.t}" x2="${X}" y2="${margin.t + tickIn}"/>`);
    parts.push(
      `<text x="${X}" y="${plotBottom + 47}" font-size="${fontSize * 1.04}" text-anchor="middle">${x}</text>`,
    );
  }
  if (showYTicks) {
    for (let y = 0; y <= 100; y += 50) {
      const Y = sy(y);
      parts.push(`<line class="tick" x1="${margin.l}" y1="${Y}" x2="${margin.l + 18}" y2="${Y}"/>`);
      parts.push(
        `<text x="${margin.l - 14}" y="${Y + 7}" font-size="${fontSize * 0.5}" text-anchor="end">${y}</text>`,
      );
    }
  }

  const xLabelY = plotBottom + 82;
  parts.push(
    `<text x="${margin.l + plotW * 0.43}" y="${xLabelY}" font-size="${fontSize * 1.0}" text-anchor="middle"><tspan font-style="italic">2θ</tspan><tspan>(deg.)</tspan></text>`,
  );
  parts.push(
    `<text x="${margin.l + plotW * 0.85}" y="${xLabelY}" font-size="${fontSize * 0.92}" text-anchor="middle">Cu-Kα</text>`,
  );
  parts.push(
    `<text transform="translate(${Math.max(54, margin.l * 0.38)},${margin.t + plotH / 2}) rotate(-90)" font-size="${fontSize * 0.92}" text-anchor="middle">Intensity (arb. units)</text>`,
  );

  measured.forEach((tr, fileIndex) => {
    const stackIndex = orderTop ? n - 1 - fileIndex : fileIndex;
    const base = stackIndex * offset;
    const norm = normByTrace.get(tr.id) || [];
    const pts = norm.filter((p) => p.x >= xMin && p.x <= xMax);
    if (pts.length) {
      const d = pts
        .map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(2)},${sy(p.y + base).toFixed(2)}`)
        .join(' ');
      parts.push(`<path class="trace" clip-path="url(#plotClip)" d="${d}" stroke-width="${lineWidth}"/>`);
    }
    const label = sampleDataName(tr);
    if (labelPos !== 'none' && label) {
      const lx = labelPos === 'right' ? margin.l + plotW - 10 : margin.l + 10;
      const anchor = labelPos === 'right' ? 'end' : 'start';
      parts.push(svgRichText(lx, sy(base + 72), label, { fontSize: fontSize * 0.92, anchor }));
    }
    const traceRefs = selectedRefPeaksForTrace(state, tr);
    if (showMarkers && traceRefs.length) {
      traceRefs.forEach((r, ri) => {
        const markerKey = markerStateKey(tr, r);
        const manualOffset = state.xrdMarkerOffsets?.[markerKey] || {};
        const displayAngle = Number.isFinite(Number(manualOffset.twoTheta))
          ? Number(manualOffset.twoTheta)
          : alignedPeakAngle(state, r);
        if (displayAngle < xMin || displayAngle > xMax) return;
        const matchedObservedPeak = hideUnmatchedMarkers
          ? observedMarkerSupport(
              norm,
              displayAngle,
              markerPeakWindow,
              markerPeakMin,
              markerPeakProminence,
              markerShoulderDetect,
            )
          : null;
        if (hideUnmatchedMarkers && !matchedObservedPeak) return;
        const X = sx(displayAngle) + markerJitter * ((ri % 3) - 1);
        const yData = interpY(norm, matchedObservedPeak ? matchedObservedPeak.x : displayAngle);
        let yM = markerMode === 'fixed' ? base + 106 : Math.min(base + 108, base + yData + markerLift);
        yM += num(manualOffset.yOffset, 0);
        if (!Number.isFinite(yM)) yM = base + 100;
        const Y = sy(yM);
        const stackScale = autoMarkerScale ? Math.min(1, Math.max(0.45, 3.4 / Math.max(3, n))) : 1;
        const sSize =
          markerSize * baseMarkerScale * stackScale * (0.78 + 0.22 * Math.sqrt((r.iNorm || 100) / 100));
        if (
          showOriginalMarkers &&
          (Number.isFinite(Number(manualOffset.twoTheta)) || Math.abs(num(manualOffset.yOffset, 0)) > 1e-9)
        ) {
          const originalX = sx(Number(r.angle));
          const originalY = sy(yM - num(manualOffset.yOffset, 0));
          parts.push(
            markerSvg(
              originalX,
              originalY,
              r.marker || 'triangle_down',
              r.color,
              sSize,
              'opacity="0.25" pointer-events="none"',
            ),
          );
        }
        const extra = `class="marker xrdRefMarker" clip-path="url(#plotClip)" data-ref-key="${esc(markerKey)}" data-trace-id="${esc(tr.id || '')}" data-original-angle="${Number(r.angle).toFixed(6)}" data-data-angle="${displayAngle.toFixed(6)}" data-data-y="${yM.toFixed(6)}" data-base-y="${(yM - num(manualOffset.yOffset, 0)).toFixed(6)}" data-svg-x="${X.toFixed(6)}" data-svg-y="${Y.toFixed(6)}" data-phase="${esc(r.phaseLabel || r.phase || '')}" data-h="${esc(r.h ?? '')}" data-k="${esc(r.k ?? '')}" data-l="${esc(r.l ?? '')}" data-d="${esc(r.d ?? '')}" data-intensity="${esc(r.iNorm ?? r.intensity ?? '')}"`;
        parts.push(markerSvg(X, Y, r.marker || 'triangle_down', r.color, sSize, extra));
        if (hklLabel && r.iNorm >= hklMinI && fileIndex === n - 1) {
          parts.push(
            `<text clip-path="url(#plotClip)" x="${X}" y="${(Y - sSize - 4).toFixed(2)}" font-size="${fontSize * 0.3}" text-anchor="middle">${esc(hklText(r))}</text>`,
          );
        }
      });
    }
  });

  if (showSticks) {
    const stickTop = plotBottom + 104;
    refSets.forEach((set, rowIdx) => {
      const y0 = stickTop + rowIdx * 22;
      for (const r of set.peaks) {
        const X = sx(r.angle);
        const h = 4 + r.iNorm * 0.16;
        parts.push(`<line class="stick" x1="${X}" y1="${y0}" x2="${X}" y2="${y0 - h}" stroke="${set.color}"/>`);
      }
      const label = set.displayName || set.name;
      parts.push(
        svgRichText(margin.l + 4, y0 + 12, `${label} (max=100)`, {
          fontSize: Math.max(10, fontSize * 0.3),
          anchor: 'start',
          extra: `class="refLabel" fill="${set.color}"`,
        }),
      );
    });
  }

  if (
    state.probe &&
    Number.isFinite(state.probe.angle) &&
    state.probe.angle >= xMin &&
    state.probe.angle <= xMax
  ) {
    const px = sx(state.probe.angle);
    const hy = Math.max(margin.t + 15, margin.t + Math.min(28, plotH * 0.08));
    parts.push(
      `<line class="probeLine probeX" x1="${px.toFixed(2)}" y1="${margin.t}" x2="${px.toFixed(2)}" y2="${plotBottom}"/>`,
    );
    parts.push(
      `<line class="probeHit probeX" x1="${px.toFixed(2)}" y1="${margin.t}" x2="${px.toFixed(2)}" y2="${plotBottom}"/>`,
    );
    parts.push(markerSvg(px, hy, 'circle', '#111', Math.max(6, fontSize * 0.2), 'class="probeHandle probeX"'));
    parts.push(
      `<text class="probeX" x="${px.toFixed(2)}" y="${(hy - Math.max(10, fontSize * 0.32)).toFixed(2)}" font-size="${Math.max(10, fontSize * 0.3).toFixed(2)}" text-anchor="middle">${state.probe.angle.toFixed(3)}°</text>`,
    );
  }

  parts.push(`</svg>`);
  return parts.join('\n');
}
