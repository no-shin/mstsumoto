/** SVG 文字列生成の共通ヘルパー(マーカー形状・リッチテキスト・凡例レイアウト) */

import { esc } from '../../core/utils';
import { estimateRichTextWidth, fitLegendText, richSpans } from '../../core/text/richText';
import type { RefPhase } from '../../core/types';
import { phaseLabel } from '../../core/xrd/identify';

export const SVG_NS = 'http://www.w3.org/2000/svg';

export function markerLabel(m: string): string {
  return (
    {
      triangle_down: '▼',
      triangle_up: '▲',
      triangle_left: '◀',
      triangle_right: '▶',
      circle: '●',
      diamond: '◆',
      square: '■',
      cross: '×',
      plus: '＋',
      star: '★',
      star6: '✶',
      wedge_down: '⏷',
      wedge_up: '⏴',
      wedge_left: '⏹',
      wedge_right: '⏵',
    } as Record<string, string>
  )[m] || m;
}

export function polygonPoints(points: [number, number][]): string {
  return points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
}

export function starPoints(
  x: number,
  y: number,
  outer: number,
  inner: number,
  n: number,
  rot = -Math.PI / 2,
): string {
  const pts: [number, number][] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = rot + (i * Math.PI) / n;
    pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
  }
  return polygonPoints(pts);
}

export interface RichTextOpts {
  fontSize?: number;
  anchor?: string;
  extra?: string;
}

export function svgRichText(x: number, y: number, text: unknown, opts: RichTextOpts = {}): string {
  const fontSize = opts.fontSize ?? 20;
  const anchor = opts.anchor || 'start';
  const extra = opts.extra || '';
  const spans = richSpans(text);
  if (!spans.length) return '';
  const body = spans
    .map((sp) => {
      if (sp.mode === 'sub')
        return `<tspan baseline-shift="sub" font-size="65%">${esc(sp.text)}</tspan>`;
      if (sp.mode === 'sup')
        return `<tspan baseline-shift="super" font-size="65%">${esc(sp.text)}</tspan>`;
      return `<tspan>${esc(sp.text)}</tspan>`;
    })
    .join('');
  return `<text ${extra} x="${Number(x).toFixed(2)}" y="${Number(y).toFixed(2)}" font-size="${Number(
    fontSize,
  ).toFixed(2)}" text-anchor="${anchor}">${body}</text>`;
}

export function markerSvg(
  x: number,
  y: number,
  marker: string,
  color: string,
  size: number,
  extra = '',
): string {
  const s = size;
  if (marker === 'circle')
    return `<circle ${extra} cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${s.toFixed(2)}" fill="${color}" stroke="${color}"/>`;
  if (marker === 'diamond')
    return `<polygon ${extra} points="${x.toFixed(2)},${(y - s).toFixed(2)} ${(x - s).toFixed(2)},${y.toFixed(2)} ${x.toFixed(2)},${(y + s).toFixed(2)} ${(x + s).toFixed(2)},${y.toFixed(2)}" fill="${color}" stroke="${color}"/>`;
  if (marker === 'triangle_up')
    return `<polygon ${extra} points="${x.toFixed(2)},${(y - s * 0.7).toFixed(2)} ${(x - s * 0.78).toFixed(2)},${(y + s * 0.62).toFixed(2)} ${(x + s * 0.78).toFixed(2)},${(y + s * 0.62).toFixed(2)}" fill="${color}" stroke="${color}"/>`;
  if (marker === 'triangle_left')
    return `<polygon ${extra} points="${(x - s * 0.72).toFixed(2)},${y.toFixed(2)} ${(x + s * 0.58).toFixed(2)},${(y - s * 0.78).toFixed(2)} ${(x + s * 0.58).toFixed(2)},${(y + s * 0.78).toFixed(2)}" fill="${color}" stroke="${color}"/>`;
  if (marker === 'triangle_right')
    return `<polygon ${extra} points="${(x + s * 0.72).toFixed(2)},${y.toFixed(2)} ${(x - s * 0.58).toFixed(2)},${(y - s * 0.78).toFixed(2)} ${(x - s * 0.58).toFixed(2)},${(y + s * 0.78).toFixed(2)}" fill="${color}" stroke="${color}"/>`;
  if (marker === 'square')
    return `<rect ${extra} x="${(x - s).toFixed(2)}" y="${(y - s).toFixed(2)}" width="${(2 * s).toFixed(2)}" height="${(2 * s).toFixed(2)}" fill="${color}" stroke="${color}"/>`;
  if (marker === 'cross')
    return `<g ${extra} stroke="${color}" stroke-width="${Math.max(2, s * 0.28).toFixed(2)}"><line x1="${(x - s).toFixed(2)}" y1="${(y - s).toFixed(2)}" x2="${(x + s).toFixed(2)}" y2="${(y + s).toFixed(2)}"/><line x1="${(x - s).toFixed(2)}" y1="${(y + s).toFixed(2)}" x2="${(x + s).toFixed(2)}" y2="${(y - s).toFixed(2)}"/></g>`;
  if (marker === 'plus')
    return `<g ${extra} stroke="${color}" stroke-width="${Math.max(2, s * 0.3).toFixed(2)}" stroke-linecap="round"><line x1="${(x - s).toFixed(2)}" y1="${y.toFixed(2)}" x2="${(x + s).toFixed(2)}" y2="${y.toFixed(2)}"/><line x1="${x.toFixed(2)}" y1="${(y - s).toFixed(2)}" x2="${x.toFixed(2)}" y2="${(y + s).toFixed(2)}"/></g>`;
  if (marker === 'star')
    return `<polygon ${extra} points="${starPoints(x, y, s, s * 0.43, 5)}" fill="${color}" stroke="${color}"/>`;
  if (marker === 'star6')
    return `<g ${extra} fill="${color}" stroke="${color}"><polygon points="${polygonPoints([[x, y - s], [x - s * 0.86, y + s * 0.5], [x + s * 0.86, y + s * 0.5]])}"/><polygon points="${polygonPoints([[x, y + s], [x - s * 0.86, y - s * 0.5], [x + s * 0.86, y - s * 0.5]])}"/></g>`;
  if (marker === 'wedge_up')
    return `<polygon ${extra} points="${polygonPoints([[x, y - s], [x - s * 0.42, y + s], [x + s * 0.42, y + s]])}" fill="${color}" stroke="${color}"/>`;
  if (marker === 'wedge_down')
    return `<polygon ${extra} points="${polygonPoints([[x, y + s], [x - s * 0.42, y - s], [x + s * 0.42, y - s]])}" fill="${color}" stroke="${color}"/>`;
  if (marker === 'wedge_left')
    return `<polygon ${extra} points="${polygonPoints([[x - s, y], [x + s, y - s * 0.42], [x + s, y + s * 0.42]])}" fill="${color}" stroke="${color}"/>`;
  if (marker === 'wedge_right')
    return `<polygon ${extra} points="${polygonPoints([[x + s, y], [x - s, y - s * 0.42], [x - s, y + s * 0.42]])}" fill="${color}" stroke="${color}"/>`;
  return `<polygon ${extra} points="${x.toFixed(2)},${(y + s * 0.62).toFixed(2)} ${(x - s * 0.72).toFixed(2)},${(y - s * 0.55).toFixed(2)} ${(x + s * 0.72).toFixed(2)},${(y - s * 0.55).toFixed(2)}" fill="${color}" stroke="${color}"/>`;
}

export interface LegendItem {
  ref: RefPhase;
  label: string;
  itemW: number;
}

export function buildLegendLayout(
  refSets: RefPhase[],
  availableW: number,
  fontSize: number,
): LegendItem[][] {
  const rows: LegendItem[][] = [];
  let row: LegendItem[] = [];
  let rowW = 0;
  const gap = Math.max(18, fontSize * 0.9);
  const markerTextGap = Math.max(24, fontSize * 1.15);
  const maxItemW = Math.max(110, Math.min(availableW, availableW * 0.48));
  for (const r of refSets) {
    const rawLabel = phaseLabel(r);
    const textMax = Math.max(60, maxItemW - markerTextGap - gap);
    const label = fitLegendText(rawLabel, textMax, fontSize);
    const itemW = Math.min(maxItemW, markerTextGap + estimateRichTextWidth(label, fontSize) + gap);
    if (row.length && rowW + itemW > availableW) {
      rows.push(row);
      row = [];
      rowW = 0;
    }
    row.push({ ref: r, label, itemW });
    rowW += itemW;
  }
  if (row.length) rows.push(row);
  return rows;
}
