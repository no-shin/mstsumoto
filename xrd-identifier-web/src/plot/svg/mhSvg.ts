/** MH ループ図の SVG 文字列生成 */

import type { AppState, MhTrace } from '../../core/types';
import { esc, fmtTick, minorTickValues, shortLegendLabel, ticksWithInterval } from '../../core/utils';
import { sBool, sNum, sOptNum, sStr } from '../../core/settings';
import { estimateRichTextWidth } from '../../core/text/richText';
import { mhDisplayName, mhPlotPoints } from '../../core/mh/analysis';
import { SVG_NS, svgRichText } from './build';

export interface MhSvgResult {
  svg: string;
  meta: { count: number; points: number; xMin: number; xMax: number; yMin: number; yMax: number };
}

interface LegendRowItem {
  trace: MhTrace;
  label: string;
  itemW: number;
  color: string;
}

export function makeMHSvg(state: AppState): MhSvgResult {
  const s = state.settings;
  const traces = state.mhTraces.filter((t) => t.visible !== false && (t.points || []).length);
  const svgW = sOptNum(s, 'mhSvgW', sNum(s, 'svgW', 960));
  const svgH = sOptNum(s, 'mhSvgH', sNum(s, 'svgH', 760));
  const fontSize = sOptNum(s, 'mhFontSize', sNum(s, 'fontSize', 34));
  const lineWidth = sOptNum(s, 'mhLineWidth', sNum(s, 'lineWidth', 2.0));
  const showLegend = sBool(s, 'showLegend', true);
  const showZero = sBool(s, 'mhShowZero', true);
  const mirrorTicks = sBool(s, 'mhMirrorTicks', true);
  let xMinBase = sOptNum(s, 'mhXMin', NaN);
  let xMaxBase = sOptNum(s, 'mhXMax', NaN);
  if ((!Number.isFinite(xMinBase) || !Number.isFinite(xMaxBase)) && traces.length) {
    const xs = traces.flatMap((t) => mhPlotPoints(t, s).map((p) => p.x)).filter(Number.isFinite);
    if (xs.length) {
      xMinBase = Number.isFinite(xMinBase) ? xMinBase : Math.min(...xs);
      xMaxBase = Number.isFinite(xMaxBase) ? xMaxBase : Math.max(...xs);
    }
  }
  if (!Number.isFinite(xMinBase)) xMinBase = -15;
  if (!Number.isFinite(xMaxBase)) xMaxBase = 15;
  let xMin = state.mhZoomView ? state.mhZoomView.xMin : xMinBase;
  let xMax = state.mhZoomView ? state.mhZoomView.xMax : xMaxBase;
  const allPts = traces.flatMap((t) =>
    mhPlotPoints(t, s).filter((p) => p.x >= Math.min(xMin, xMax) && p.x <= Math.max(xMin, xMax)),
  );
  let yMinBase = sOptNum(s, 'mhYMin', NaN);
  let yMaxBase = sOptNum(s, 'mhYMax', NaN);
  const mhAutoY =
    sStr(s, 'mhAutoY', 'manual') === 'auto' || !Number.isFinite(yMinBase) || !Number.isFinite(yMaxBase);
  if (mhAutoY && allPts.length) {
    const ys = allPts.map((p) => p.y);
    yMinBase = Math.min(...ys);
    yMaxBase = Math.max(...ys);
    const pad = Math.max(1, (yMaxBase - yMinBase) * 0.08);
    yMinBase -= pad;
    yMaxBase += pad;
  }
  if (!Number.isFinite(yMinBase)) yMinBase = -80;
  if (!Number.isFinite(yMaxBase)) yMaxBase = 80;
  let yMin = state.mhZoomView ? state.mhZoomView.yMin : yMinBase;
  let yMax = state.mhZoomView ? state.mhZoomView.yMax : yMaxBase;
  if (xMin === xMax) {
    xMin -= 1;
    xMax += 1;
  }
  if (yMin === yMax) {
    yMin -= 1;
    yMax += 1;
  }
  const marginLR = { l: sOptNum(s, 'mhMarginL', 170), r: sOptNum(s, 'mhMarginR', 64) };
  const plotW0 = Math.max(160, svgW - marginLR.l - marginLR.r);
  const legendFont = Math.max(17, fontSize * 0.62);
  const legendRows: LegendRowItem[][] =
    showLegend && traces.length
      ? traces.map((t) => [
          { trace: t, label: shortLegendLabel(mhDisplayName(t)), itemW: plotW0, color: t.color },
        ])
      : [];
  const legendRowH = Math.max(28, legendFont * 1.55);
  const legendH = legendRows.length ? Math.max(54, legendRows.length * legendRowH + 22) : 16;
  const margin = {
    l: marginLR.l,
    r: marginLR.r,
    t: sOptNum(s, 'mhMarginT', 36) + legendH,
    b: sOptNum(s, 'mhMarginB', 116),
  };
  const plotW = Math.max(160, svgW - margin.l - margin.r);
  const plotH = Math.max(160, svgH - margin.t - margin.b);
  const sx = (x: number) => margin.l + ((x - xMin) / (xMax - xMin)) * plotW;
  const sy = (y: number) => margin.t + ((yMax - y) / (yMax - yMin)) * plotH;
  const plotBottom = margin.t + plotH;
  const tickIn = Math.max(13, Math.min(28, fontSize * 0.48));
  const parts: string[] = [];
  parts.push(
    `<svg xmlns="${SVG_NS}" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}" role="img" data-mode="mh" data-x-min="${xMin}" data-x-max="${xMax}" data-y-min="${yMin}" data-y-max="${yMax}" data-plot-left="${margin.l}" data-plot-top="${margin.t}" data-plot-width="${plotW}" data-plot-height="${plotH}">`,
  );
  parts.push(`<rect width="100%" height="100%" fill="white"/>`);
  parts.push(
    `<style>text{font-family:'Times New Roman','Yu Mincho',serif;fill:#000}.axis{stroke:#000;stroke-width:2;fill:none}.tick{stroke:#000;stroke-width:2}.mhTrace{fill:none;stroke-linecap:round;stroke-linejoin:round}.zeroLine{stroke:#000;stroke-width:1.4}</style>`,
  );
  parts.push(
    `<defs><clipPath id="mhPlotClip"><rect x="${margin.l}" y="${margin.t}" width="${plotW}" height="${plotH}"/></clipPath></defs>`,
  );
  if (showLegend && legendRows.length) {
    const lx = Number.isFinite(state.mhLegend?.x as number) ? (state.mhLegend as { x: number }).x : margin.l + 14;
    const ly = Number.isFinite(state.mhLegend?.y as number) ? (state.mhLegend as { y: number }).y : margin.t + 28;
    const boxW = Math.min(
      plotW - 18,
      Math.max(180, ...legendRows.flat().map((i) => 92 + estimateRichTextWidth(i.label, legendFont))),
    );
    const boxH = legendRows.length * legendRowH + 14;
    parts.push(
      `<g class="movableLegend" data-legend-mode="mh" transform="translate(${lx.toFixed(2)} ${ly.toFixed(2)})"><rect x="-8" y="${(-legendRowH * 0.75).toFixed(2)}" width="${boxW.toFixed(2)}" height="${boxH.toFixed(2)}" fill="transparent" stroke="none" opacity="0" style="pointer-events:all"/>`,
    );
    legendRows.forEach((row, ri) => {
      const y = ri * legendRowH;
      row.forEach((item) => {
        const t = item.trace;
        parts.push(
          `<line x1="0" y1="${y}" x2="60" y2="${y}" stroke="${esc(t.color)}" stroke-width="${Math.max(3, lineWidth * 1.8)}"/>`,
        );
        parts.push(svgRichText(78, y + legendFont * 0.35, item.label, { fontSize: legendFont, anchor: 'start' }));
      });
    });
    parts.push(`</g>`);
  }
  parts.push(`<rect class="axis" x="${margin.l}" y="${margin.t}" width="${plotW}" height="${plotH}"/>`);
  const xTicks = ticksWithInterval(xMin, xMax, s['mhXTick'], 6);
  const yTicks = ticksWithInterval(yMin, yMax, s['mhYTick'], 5);
  if (sBool(s, 'mhMinorTicks', false))
    minorTickValues(xTicks).forEach((x) => {
      const X = sx(x);
      parts.push(
        `<line class="tick" x1="${X}" y1="${plotBottom}" x2="${X}" y2="${plotBottom - tickIn * 0.45}" stroke-width="1"/>`,
      );
    });
  xTicks.forEach((x, i) => {
    const X = sx(x);
    parts.push(`<line class="tick" x1="${X}" y1="${plotBottom}" x2="${X}" y2="${plotBottom - tickIn}"/>`);
    if (mirrorTicks)
      parts.push(`<line class="tick" x1="${X}" y1="${margin.t}" x2="${X}" y2="${margin.t + tickIn}"/>`);
    if (i % Math.max(1, Math.floor(sNum(s, 'mhXLabelEvery', 1))) === 0)
      parts.push(
        `<text x="${X}" y="${plotBottom + 48}" font-size="${fontSize * 0.98}" text-anchor="middle">${fmtTick(x)}</text>`,
      );
  });
  if (sBool(s, 'mhMinorTicks', false))
    minorTickValues(yTicks).forEach((y) => {
      const Y = sy(y);
      parts.push(
        `<line class="tick" x1="${margin.l}" y1="${Y}" x2="${margin.l + tickIn * 0.45}" y2="${Y}" stroke-width="1"/>`,
      );
    });
  yTicks.forEach((y, i) => {
    const Y = sy(y);
    parts.push(`<line class="tick" x1="${margin.l}" y1="${Y}" x2="${margin.l + tickIn}" y2="${Y}"/>`);
    if (mirrorTicks)
      parts.push(
        `<line class="tick" x1="${margin.l + plotW}" y1="${Y}" x2="${margin.l + plotW - tickIn}" y2="${Y}"/>`,
      );
    if (i % Math.max(1, Math.floor(sNum(s, 'mhYLabelEvery', 1))) === 0)
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
    svgRichText(margin.l + plotW / 2, plotBottom + 90, sStr(s, 'mhXAxisLabel', 'Magnetic field (kOe)'), {
      fontSize: fontSize * 1.0,
      anchor: 'middle',
    }),
  );
  parts.push(
    `<g transform="translate(${Math.max(58, margin.l * 0.42)},${margin.t + plotH / 2}) rotate(-90)">${svgRichText(0, 0, sStr(s, 'mhYAxisLabel', 'Magnetization (emu/g)'), { fontSize: fontSize * 1.0, anchor: 'middle' })}</g>`,
  );
  traces.forEach((t) => {
    const pts = mhPlotPoints(t, s).filter((p) => p.x >= Math.min(xMin, xMax) && p.x <= Math.max(xMin, xMax));
    if (pts.length < 2) return;
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(2)},${sy(p.y).toFixed(2)}`).join(' ');
    parts.push(
      `<path class="mhTrace" clip-path="url(#mhPlotClip)" d="${d}" stroke="${esc(t.color)}" stroke-width="${lineWidth}"/>`,
    );
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
