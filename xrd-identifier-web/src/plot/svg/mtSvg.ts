/** MT 図の SVG 文字列生成(微分曲線・Tc 注釈付き) */

import type { AppState } from '../../core/types';
import {
  clamp,
  esc,
  fmtTick,
  interpY,
  minorTickValues,
  num,
  shortLegendLabel,
  ticksWithInterval,
} from '../../core/utils';
import { sBool, sNum, sOptNum, sStr } from '../../core/settings';
import { estimateRichTextWidth } from '../../core/text/richText';
import {
  mtAcceptedTcList,
  mtDerivatives,
  mtDisplayName,
  mtPlotPoints,
  scaledAuxPoints,
} from '../../core/mt/derivative';
import { SVG_NS, svgRichText } from './build';

export interface MtSvgResult {
  svg: string;
  meta: { count: number; points: number; xMin: number; xMax: number; yMin: number; yMax: number };
}

export function makeMTSvg(state: AppState): MtSvgResult {
  const s = state.settings;
  const traces = state.mtTraces.filter((t) => t.visible !== false && (t.points || []).length);
  const svgW = sOptNum(s, 'mtSvgW', sNum(s, 'svgW', 960));
  const svgH = sOptNum(s, 'mtSvgH', sNum(s, 'svgH', 760));
  const fontSize = sOptNum(s, 'mtFontSize', sNum(s, 'fontSize', 34));
  const lineWidth = sOptNum(s, 'mtLineWidth', sNum(s, 'lineWidth', 2.0));
  const showLegend = sBool(s, 'showLegend', true);
  const showZero = sBool(s, 'mtShowZero', false);
  const showD1 = sBool(s, 'mtShowD1', false);
  const showD2 = sBool(s, 'mtShowD2', false);
  let xMinBase = sOptNum(s, 'mtXMin', NaN);
  let xMaxBase = sOptNum(s, 'mtXMax', NaN);
  if ((!Number.isFinite(xMinBase) || !Number.isFinite(xMaxBase)) && traces.length) {
    const xs = traces.flatMap((t) => mtPlotPoints(t, s).map((p) => p.x)).filter(Number.isFinite);
    if (xs.length) {
      xMinBase = Number.isFinite(xMinBase) ? xMinBase : Math.min(...xs);
      xMaxBase = Number.isFinite(xMaxBase) ? xMaxBase : Math.max(...xs);
    }
  }
  if (!Number.isFinite(xMinBase)) xMinBase = 0;
  if (!Number.isFinite(xMaxBase)) xMaxBase = 600;
  let xMin = state.mtZoomView ? state.mtZoomView.xMin : xMinBase;
  let xMax = state.mtZoomView ? state.mtZoomView.xMax : xMaxBase;
  const baseByTrace = new Map(traces.map((t) => [t.id, mtPlotPoints(t, s)]));
  const allPts = [...baseByTrace.values()]
    .flat()
    .filter((p) => p.x >= Math.min(xMin, xMax) && p.x <= Math.max(xMin, xMax));
  let yMinBase = sOptNum(s, 'mtYMin', NaN);
  let yMaxBase = sOptNum(s, 'mtYMax', NaN);
  const mtAutoY =
    sStr(s, 'mtAutoY', 'auto') === 'auto' || !Number.isFinite(yMinBase) || !Number.isFinite(yMaxBase);
  if (mtAutoY && allPts.length) {
    const ys = allPts.map((p) => p.y);
    yMinBase = Math.min(...ys);
    yMaxBase = Math.max(...ys);
    const pad = Math.max(1e-9, (yMaxBase - yMinBase) * 0.08);
    yMinBase -= pad;
    yMaxBase += pad;
  }
  if (!Number.isFinite(yMinBase)) yMinBase = 0;
  if (!Number.isFinite(yMaxBase)) yMaxBase = 1;
  let yMin = state.mtZoomView ? state.mtZoomView.yMin : yMinBase;
  let yMax = state.mtZoomView ? state.mtZoomView.yMax : yMaxBase;
  if (xMin === xMax) {
    xMin -= 1;
    xMax += 1;
  }
  if (yMin === yMax) {
    yMin -= 1;
    yMax += 1;
  }
  const spanY = yMax - yMin;
  const marginLR = { l: sOptNum(s, 'mtMarginL', 170), r: sOptNum(s, 'mtMarginR', 64) };
  const plotW0 = Math.max(160, svgW - marginLR.l - marginLR.r);
  const legendFont = Math.max(17, fontSize * 0.62);
  const legendItems = traces.map((t) => ({
    label: shortLegendLabel(mtDisplayName(t)),
    itemW: plotW0,
    color: t.color,
  }));
  if (showD1) legendItems.push({ label: 'dM/dT', itemW: plotW0, color: '#1d4ed8' });
  if (showD2) legendItems.push({ label: 'd²M/dT²', itemW: plotW0, color: '#dc2626' });
  const rows = showLegend ? legendItems.map((item) => [item]) : [];
  const legendRowH = Math.max(28, legendFont * 1.55);
  const legendH = rows.length ? Math.max(54, rows.length * legendRowH + 22) : 16;
  const margin = {
    l: marginLR.l,
    r: marginLR.r,
    t: sOptNum(s, 'mtMarginT', 36) + legendH,
    b: sOptNum(s, 'mtMarginB', 116),
  };
  const plotW = Math.max(160, svgW - margin.l - margin.r);
  const plotH = Math.max(160, svgH - margin.t - margin.b);
  const sx = (x: number) => margin.l + ((x - xMin) / (xMax - xMin)) * plotW;
  const sy = (y: number) => margin.t + ((yMax - y) / (yMax - yMin)) * plotH;
  const plotBottom = margin.t + plotH;
  const tickIn = Math.max(13, Math.min(28, fontSize * 0.48));
  const d1Amp = spanY * Math.max(0.01, sNum(s, 'mtD1Scale', sNum(s, 'mtDerivativeScale', 18)) / 100);
  const d2Amp = spanY * Math.max(0.01, sNum(s, 'mtD2Scale', sNum(s, 'mtDerivativeScale', 18)) / 100);
  const layout = state.mtDerivativeLayout || { d1BaseRatio: 0.2, d2BaseRatio: 0.34 };
  const d1Base = yMin + spanY * clamp(num(layout.d1BaseRatio, 0.2), 0, 1);
  const d2Base = yMin + spanY * clamp(num(layout.d2BaseRatio, 0.34), 0, 1);
  const parts: string[] = [];
  parts.push(
    `<svg xmlns="${SVG_NS}" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}" role="img" data-mode="mt" data-x-min="${xMin}" data-x-max="${xMax}" data-y-min="${yMin}" data-y-max="${yMax}" data-plot-left="${margin.l}" data-plot-top="${margin.t}" data-plot-width="${plotW}" data-plot-height="${plotH}">`,
  );
  parts.push(`<rect width="100%" height="100%" fill="white"/>`);
  parts.push(
    `<style>text{font-family:'Times New Roman','Yu Mincho',serif;fill:#000}.axis{stroke:#000;stroke-width:2;fill:none}.tick{stroke:#000;stroke-width:2}.mtTrace{fill:none;stroke-linecap:round;stroke-linejoin:round}.zeroLine{stroke:#000;stroke-width:1.4}.tcBox{fill:white;stroke:#000;stroke-width:1.6}.tcArrow{stroke:#000;stroke-width:1.5;fill:none}.mtDerivative{cursor:ns-resize;pointer-events:stroke}.mtDerivativeHit{cursor:ns-resize;pointer-events:stroke}</style>`,
  );
  parts.push(
    `<defs><clipPath id="mtPlotClip"><rect x="${margin.l}" y="${margin.t}" width="${plotW}" height="${plotH}"/></clipPath><marker id="tcArrowHead" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#000"/></marker></defs>`,
  );
  if (showLegend && rows.length) {
    const lx = Number.isFinite(state.mtLegend?.x as number) ? (state.mtLegend as { x: number }).x : margin.l + 14;
    const ly = Number.isFinite(state.mtLegend?.y as number) ? (state.mtLegend as { y: number }).y : margin.t + 28;
    const boxW = Math.min(
      plotW - 18,
      Math.max(180, ...rows.flat().map((i) => 92 + estimateRichTextWidth(i.label, legendFont))),
    );
    const boxH = rows.length * legendRowH + 14;
    parts.push(
      `<g class="movableLegend" data-legend-mode="mt" transform="translate(${lx.toFixed(2)} ${ly.toFixed(2)})"><rect x="-8" y="${(-legendRowH * 0.75).toFixed(2)}" width="${boxW.toFixed(2)}" height="${boxH.toFixed(2)}" fill="transparent" stroke="none" opacity="0" style="pointer-events:all"/>`,
    );
    rows.forEach((row, ri) => {
      const y = ri * legendRowH;
      row.forEach((item) => {
        parts.push(
          `<line x1="0" y1="${y}" x2="60" y2="${y}" stroke="${esc(item.color)}" stroke-width="${Math.max(3, lineWidth * 1.8)}"/>`,
        );
        parts.push(svgRichText(78, y + legendFont * 0.35, item.label, { fontSize: legendFont, anchor: 'start' }));
      });
    });
    parts.push(`</g>`);
  }
  parts.push(`<rect class="axis" x="${margin.l}" y="${margin.t}" width="${plotW}" height="${plotH}"/>`);
  const mtXTicks = ticksWithInterval(xMin, xMax, s['mtXTick'], 6);
  const mtYTicks = ticksWithInterval(yMin, yMax, s['mtYTick'], 5);
  if (sBool(s, 'mtMinorTicks', false))
    minorTickValues(mtXTicks).forEach((x) => {
      const X = sx(x);
      parts.push(
        `<line class="tick" x1="${X}" y1="${plotBottom}" x2="${X}" y2="${plotBottom - tickIn * 0.45}" stroke-width="1"/>`,
      );
    });
  mtXTicks.forEach((x, i) => {
    const X = sx(x);
    parts.push(`<line class="tick" x1="${X}" y1="${plotBottom}" x2="${X}" y2="${plotBottom - tickIn}"/>`);
    parts.push(`<line class="tick" x1="${X}" y1="${margin.t}" x2="${X}" y2="${margin.t + tickIn}"/>`);
    if (i % Math.max(1, Math.floor(sNum(s, 'mtXLabelEvery', 1))) === 0)
      parts.push(
        `<text x="${X}" y="${plotBottom + 48}" font-size="${fontSize * 0.98}" text-anchor="middle">${fmtTick(x)}</text>`,
      );
  });
  if (sBool(s, 'mtMinorTicks', false))
    minorTickValues(mtYTicks).forEach((y) => {
      const Y = sy(y);
      parts.push(
        `<line class="tick" x1="${margin.l}" y1="${Y}" x2="${margin.l + tickIn * 0.45}" y2="${Y}" stroke-width="1"/>`,
      );
    });
  mtYTicks.forEach((y, i) => {
    const Y = sy(y);
    parts.push(`<line class="tick" x1="${margin.l}" y1="${Y}" x2="${margin.l + tickIn}" y2="${Y}"/>`);
    if (sBool(s, 'mtMirrorTicks', true))
      parts.push(
        `<line class="tick" x1="${margin.l + plotW}" y1="${Y}" x2="${margin.l + plotW - tickIn}" y2="${Y}"/>`,
      );
    if (i % Math.max(1, Math.floor(sNum(s, 'mtYLabelEvery', 1))) === 0)
      parts.push(
        `<text x="${margin.l - 18}" y="${Y + fontSize * 0.3}" font-size="${fontSize * 0.92}" text-anchor="end">${fmtTick(y)}</text>`,
      );
  });
  if (showZero) {
    if (xMin < 0 && xMax > 0) {
      const X = sx(0);
      parts.push(`<line class="zeroLine" x1="${X}" y1="${margin.t}" x2="${X}" y2="${plotBottom}"/>`);
    }
    if (yMin < 0 && yMax > 0) {
      const Y = sy(0);
      parts.push(`<line class="zeroLine" x1="${margin.l}" y1="${Y}" x2="${margin.l + plotW}" y2="${Y}"/>`);
    }
  }
  parts.push(
    svgRichText(margin.l + plotW / 2, plotBottom + 90, sStr(s, 'mtXAxisLabel', 'Temperature (°C)'), {
      fontSize: fontSize * 1.0,
      anchor: 'middle',
    }),
  );
  parts.push(
    `<g transform="translate(${Math.max(58, margin.l * 0.42)},${margin.t + plotH / 2}) rotate(-90)">${svgRichText(0, 0, sStr(s, 'mtYAxisLabel', 'Magnetization (arb.units)'), { fontSize: fontSize * 1.0, anchor: 'middle' })}</g>`,
  );
  traces.forEach((t, ti) => {
    const pts = (baseByTrace.get(t.id) || []).filter(
      (p) => p.x >= Math.min(xMin, xMax) && p.x <= Math.max(xMin, xMax),
    );
    if (pts.length >= 2) {
      const d = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(2)},${sy(p.y).toFixed(2)}`).join(' ');
      parts.push(
        `<path class="mtTrace" clip-path="url(#mtPlotClip)" d="${d}" stroke="${esc(t.color)}" stroke-width="${lineWidth}"/>`,
      );
    }
    const deriv = mtDerivatives(t, s);
    const pushDerivative = (kind: 'd1' | 'd2', points: typeof deriv.d1, base: number, amp: number, color: string) => {
      const sp = scaledAuxPoints(points, base, amp).filter(
        (p) => p.x >= Math.min(xMin, xMax) && p.x <= Math.max(xMin, xMax),
      );
      if (sp.length < 2) return;
      const d = sp.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(2)},${sy(p.y).toFixed(2)}`).join(' ');
      parts.push(
        `<path class="mtTrace mtDerivative" data-derivative="${kind}" clip-path="url(#mtPlotClip)" d="${d}" stroke="${color}" stroke-width="${Math.max(1, lineWidth * 0.85)}" opacity="${traces.length > 1 ? 0.75 : 1}"/>`,
      );
      parts.push(
        `<path class="mtDerivativeHit" data-derivative="${kind}" clip-path="url(#mtPlotClip)" d="${d}" stroke="transparent" stroke-width="${Math.max(14, lineWidth * 8)}" fill="none" opacity="0" style="pointer-events:stroke;cursor:ns-resize"/>`,
      );
    };
    if (showD1) pushDerivative('d1', deriv.d1, d1Base, d1Amp, '#1d4ed8');
    if (showD2) pushDerivative('d2', deriv.d2, d2Base, d2Amp, '#dc2626');
    const tcList = mtAcceptedTcList(t)
      .map((a) => Number(a.temp))
      .filter(Number.isFinite);
    tcList.forEach((tc, ai) => {
      if (tc >= Math.min(xMin, xMax) && tc <= Math.max(xMin, xMax) && pts.length) {
        const y = interpY(pts, tc);
        const X = sx(tc);
        const Y = sy(y);
        const key = `${t.id}:${tc.toFixed(3)}`;
        const labelFont = clamp(sNum(s, 'mtTcLabelFont', fontSize * 0.48), 8, 72);
        const autoW = Math.max(90, labelFont * 6.7);
        const autoH = Math.max(26, labelFont * 1.8);
        const autoX = clamp(X - autoW - 34 + ((ti + ai) % 2) * 74, margin.l + 8, margin.l + plotW - autoW - 8);
        const autoY = clamp(Y - autoH - 54 - ((ti + ai) % 4) * 22, margin.t + 12, margin.t + plotH - autoH - 12);
        const a = state.mtTcAnnotations[key] || {};
        const boxW = Math.min(autoW, plotW - 16);
        const boxH = Math.min(autoH, plotH - 16);
        const bx = clamp(num(a.x, autoX), margin.l + 8, margin.l + plotW - boxW - 8);
        const by = clamp(num(a.y, autoY), margin.t + 8, margin.t + plotH - boxH - 8);
        const targetX = clamp(num(a.targetX, X), margin.l, margin.l + plotW);
        const targetY = clamp(num(a.targetY, Y), margin.t, margin.t + plotH);
        parts.push(
          `<path class="tcArrow" data-tc-arrow="${esc(key)}" d="M ${bx + boxW * 0.86} ${by + boxH} L ${targetX} ${targetY}" marker-end="url(#tcArrowHead)"/>`,
        );
        parts.push(
          `<circle class="tcArrowHandle" data-tc-target="${esc(key)}" cx="${targetX}" cy="${targetY}" r="9" fill="transparent" stroke="transparent"/>`,
        );
        parts.push(
          `<g class="tcLabel" data-tc-label="${esc(key)}"><rect class="tcBox" x="${bx}" y="${by}" width="${boxW}" height="${boxH}"/>${svgRichText(bx + 12, by + boxH * 0.68, `T_C = ${Math.round(tc)}°C`, { fontSize: labelFont, anchor: 'start' })}</g>`,
        );
      }
    });
  });
  parts.push('</svg>');
  return {
    svg: parts.join('\n'),
    meta: {
      count: traces.length,
      points: traces.reduce((acc, t) => acc + (t.points || []).length, 0),
      xMin,
      xMax,
      yMin,
      yMax,
    },
  };
}
