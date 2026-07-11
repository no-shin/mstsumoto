/** 汎用ヘルパー(元アプリのユーティリティ関数の移植) */

import type { Pt } from './types';

export function esc(s: unknown): string {
  return String(s ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );
}

export function num(v: unknown, fallback = 0): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function cleanName(name: string): string {
  return (name || 'sample').replace(/\.[^.]+$/, '').replace(/[_-]+exported$/i, '');
}

let uidCounter = 1;
export function uniqueId(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${(uidCounter++).toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

export function safeFileStem(name: unknown, fallback = 'xrd_project'): string {
  const s = String(name || '').trim() || fallback;
  return (
    s
      .replace(/[\\/:*?"<>|]+/g, '_')
      .replace(/\s+/g, '_')
      .replace(/^_+|_+$/g, '') || fallback
  );
}

export function medianValue(values: number[]): number {
  const xs = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!xs.length) return 0;
  const m = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[m] : (xs[m - 1] + xs[m]) / 2;
}

export function interpY(points: Pt[], x: number): number {
  if (!points.length) return 0;
  if (x <= points[0].x) return points[0].y;
  if (x >= points[points.length - 1].x) return points[points.length - 1].y;
  let lo = 0;
  let hi = points.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid].x < x) lo = mid;
    else hi = mid;
  }
  const a = points[lo];
  const b = points[hi];
  const t = (x - a.x) / (b.x - a.x || 1);
  return a.y + (b.y - a.y) * t;
}

export function splitCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      q = !q;
      continue;
    }
    if (c === ',' && !q) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += c;
  }
  out.push(cur.trim());
  return out;
}

export function extractNumericFields(line: string): number[] {
  return String(line)
    .split(/[,\t ]+/)
    .map((v) => Number(String(v).replace(/[^\x00-\x7F]/g, '')))
    .filter(Number.isFinite);
}

export function niceTicks(min: number, max: number, target = 6): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return [min || 0];
  const span = Math.abs(max - min);
  const raw = span / Math.max(1, target);
  const pow = 10 ** Math.floor(Math.log10(raw));
  const mult = raw / pow <= 1.5 ? 1 : raw / pow <= 3 ? 2 : raw / pow <= 7 ? 5 : 10;
  const step = mult * pow;
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.25; v += step) ticks.push(Math.abs(v) < step * 1e-6 ? 0 : v);
  return ticks;
}

export function ticksWithInterval(
  min: number,
  max: number,
  interval: unknown,
  target = 6,
): number[] {
  const step = Number(interval);
  if (!Number.isFinite(step) || step <= 0) return niceTicks(min, max, target);
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  const start = Math.ceil(lo / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= hi + step * 0.25; v += step) ticks.push(Math.abs(v) < step * 1e-8 ? 0 : v);
  return ticks;
}

export function minorTickValues(major: number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < major.length - 1; i++) {
    const d = (major[i + 1] - major[i]) / 5;
    for (let j = 1; j < 5; j++) out.push(major[i] + d * j);
  }
  return out;
}

export function fmtTick(v: number): string {
  const av = Math.abs(v);
  if (av >= 100) return v.toFixed(0);
  if (av >= 10) return Number.isInteger(v) ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, '');
  if (av >= 1) return Number.isInteger(v) ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, '');
  return v
    .toFixed(2)
    .replace(/0+$/, '')
    .replace(/\.$/, '');
}

export function shortLegendLabel(label: unknown, max = 24): string {
  const s = String(label || '').trim();
  return s.length > max ? `${s.slice(0, Math.max(1, max - 1))}…` : s;
}

export function linearZero(
  a: Record<string, number>,
  b: Record<string, number>,
  xKey: string,
  yKey: string,
): number {
  const ya = a[yKey];
  const yb = b[yKey];
  const xa = a[xKey];
  const xb = b[xKey];
  if (!Number.isFinite(ya) || !Number.isFinite(yb) || ya === yb) return NaN;
  return xa + (0 - ya) * (xb - xa) / (yb - ya);
}
