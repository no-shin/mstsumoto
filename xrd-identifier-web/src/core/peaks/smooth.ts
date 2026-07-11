/** 平滑化・微分(移動平均、局所多項式フィット、ノイズ抑制) */

import type { Pt } from '../types';
import { num } from '../utils';

export function movingAveragePoints(points: Pt[], win = 5): Pt[] {
  const n = Math.max(1, Math.floor(win));
  const half = Math.floor(n / 2);
  return points.map((p, i) => {
    let s = 0;
    let c = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(points.length - 1, i + half); j++) {
      s += points[j].y;
      c++;
    }
    return { x: p.x, y: c ? s / c : p.y };
  });
}

export function movingAverageValues(values: number[], win = 5): number[] {
  const n = Math.max(1, Math.floor(win));
  if (n <= 1) return values.slice();
  const half = Math.floor(n / 2);
  return values.map((v, i) => {
    let s = 0;
    let c = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(values.length - 1, i + half); j++) {
      s += values[j];
      c++;
    }
    return c ? s / c : v;
  });
}

export function oddWindow(value: unknown, fallback: number, maxLen?: number): number {
  let w = Math.max(1, Math.floor(num(value, fallback)));
  if (w % 2 === 0) w += 1;
  if (Number.isFinite(maxLen as number) && (maxLen as number) > 0) {
    const m = maxLen as number;
    w = Math.min(w, m % 2 ? m : m - 1);
  }
  return Math.max(1, w);
}

export function solveLinearSystem(a: number[][], b: number[]): number[] | null {
  const n = b.length;
  const m = a.map((row, i) => row.concat([b[i]]));
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
    if (Math.abs(m[pivot][col]) < 1e-12) return null;
    if (pivot !== col) {
      const tmp = m[col];
      m[col] = m[pivot];
      m[pivot] = tmp;
    }
    const div = m[col][col];
    for (let c = col; c <= n; c++) m[col][c] /= div;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = m[r][col];
      for (let c = col; c <= n; c++) m[r][c] -= f * m[col][c];
    }
  }
  return m.map((row) => row[n]);
}

export function localPolynomialSmoothPoints(points: Pt[], win: unknown, degree = 2): Pt[] {
  if (!points || points.length < 3) return (points || []).slice();
  const n = points.length;
  const w = oddWindow(win, 5, n);
  if (w <= 1) return points.slice();
  const half = Math.floor(w / 2);
  const deg = Math.max(1, Math.min(degree, 3));
  return points.map((p, i) => {
    const lo = Math.max(0, i - half);
    const hi = Math.min(n - 1, i + half);
    const span = Math.max(1e-9, points[hi].x - points[lo].x);
    const sigma = Math.max(1, (hi - lo + 1) / 2.8);
    const ata = Array.from({ length: deg + 1 }, () => Array<number>(deg + 1).fill(0));
    const aty = Array<number>(deg + 1).fill(0);
    let weighted = 0;
    let weightSum = 0;
    let plain = 0;
    let count = 0;
    for (let j = lo; j <= hi; j++) {
      const x = (points[j].x - p.x) / span;
      const dist = (j - i) / sigma;
      const weight = Math.exp(-0.5 * dist * dist);
      const basis = [1];
      for (let d = 1; d <= deg; d++) basis[d] = basis[d - 1] * x;
      for (let r = 0; r <= deg; r++) {
        aty[r] += weight * basis[r] * points[j].y;
        for (let c = 0; c <= deg; c++) ata[r][c] += weight * basis[r] * basis[c];
      }
      weighted += weight * points[j].y;
      weightSum += weight;
      plain += points[j].y;
      count++;
    }
    const coeff = solveLinearSystem(ata, aty);
    const y = coeff ? coeff[0] : weightSum > 0 ? weighted / weightSum : plain / Math.max(1, count);
    return { x: p.x, y: Number.isFinite(y) ? y : p.y };
  });
}

export function suppressImpulseNoise(points: Pt[], win = 5, zLimit = 6): Pt[] {
  if (!points || points.length < 5) return (points || []).slice();
  const w = oddWindow(win, 5, points.length);
  const half = Math.floor(w / 2);
  return points.map((p, i) => {
    const values: number[] = [];
    for (let j = Math.max(0, i - half); j <= Math.min(points.length - 1, i + half); j++)
      values.push(points[j].y);
    values.sort((a, b) => a - b);
    const med = values[Math.floor(values.length / 2)];
    const dev = values
      .map((v) => Math.abs(v - med))
      .sort((a, b) => a - b)[Math.floor(values.length / 2)];
    const limit = Math.max(1e-12, zLimit * 1.4826 * dev);
    return Math.abs(p.y - med) > limit ? { x: p.x, y: med } : { x: p.x, y: p.y };
  });
}

export function collapseDuplicateX(points: Pt[]): Pt[] {
  const out: { x: number; y: number; count: number }[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.x - p.x) < 1e-9) {
      last.y = (last.y * last.count + p.y) / (last.count + 1);
      last.count++;
    } else {
      out.push({ x: p.x, y: p.y, count: 1 });
    }
  }
  return out.map((p) => ({ x: p.x, y: p.y }));
}

export interface DerivativeFitResult {
  base: Pt[];
  d1: Pt[];
  d2: Pt[];
}

export function localPolynomialDerivativePoints(
  points: Pt[],
  win: unknown,
  degree = 3,
): DerivativeFitResult {
  if (!points || points.length < 5) return { base: (points || []).slice(), d1: [], d2: [] };
  const n = points.length;
  const w = oddWindow(win, 7, n);
  const half = Math.floor(w / 2);
  const deg = Math.max(2, Math.min(degree, 3));
  const base: Pt[] = [];
  const d1: Pt[] = [];
  const d2: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const p = points[i];
    const lo = Math.max(0, i - half);
    const hi = Math.min(n - 1, i + half);
    const span = Math.max(
      1e-9,
      Math.max(Math.abs(points[hi].x - p.x), Math.abs(p.x - points[lo].x), 1),
    );
    const sigma = Math.max(1, (hi - lo + 1) / 2.8);
    const ata = Array.from({ length: deg + 1 }, () => Array<number>(deg + 1).fill(0));
    const aty = Array<number>(deg + 1).fill(0);
    let weighted = 0;
    let weightSum = 0;
    for (let j = lo; j <= hi; j++) {
      const x = (points[j].x - p.x) / span;
      const dist = (j - i) / sigma;
      const weight = Math.exp(-0.5 * dist * dist);
      const basis = [1];
      for (let d = 1; d <= deg; d++) basis[d] = basis[d - 1] * x;
      for (let r = 0; r <= deg; r++) {
        aty[r] += weight * basis[r] * points[j].y;
        for (let c = 0; c <= deg; c++) ata[r][c] += weight * basis[r] * basis[c];
      }
      weighted += weight * points[j].y;
      weightSum += weight;
    }
    const coeff = solveLinearSystem(ata, aty);
    const y0 = coeff ? coeff[0] : weightSum ? weighted / weightSum : p.y;
    base.push({ x: p.x, y: Number.isFinite(y0) ? y0 : p.y });
    if (coeff && Number.isFinite(coeff[1])) d1.push({ x: p.x, y: coeff[1] / span });
    if (coeff && Number.isFinite(coeff[2])) d2.push({ x: p.x, y: (2 * coeff[2]) / (span * span) });
  }
  return { base, d1, d2 };
}
