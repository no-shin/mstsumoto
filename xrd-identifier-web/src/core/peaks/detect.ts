/** ピーク検出(局所極大・肩ピーク・近傍探索) */

import type { Pt } from '../types';
import { medianValue } from '../utils';
import { movingAveragePoints } from './smooth';

export function detectPeaks(
  points: Pt[],
  xMin: number,
  xMax: number,
  threshold = 7,
  minSep = 0.18,
): Pt[] {
  const arr = movingAveragePoints(
    points.filter((p) => p.x >= xMin && p.x <= xMax),
    5,
  );
  const candidates: Pt[] = [];
  for (let i = 2; i < arr.length - 2; i++) {
    const y = arr[i].y;
    if (y < threshold) continue;
    if (y > arr[i - 1].y && y >= arr[i + 1].y && y > arr[i - 2].y && y >= arr[i + 2].y) {
      const localMin = Math.min(arr[i - 2].y, arr[i - 1].y, arr[i + 1].y, arr[i + 2].y);
      const prominence = y - localMin;
      if (prominence >= 2.5) candidates.push({ x: arr[i].x, y });
    }
  }
  candidates.sort((a, b) => b.y - a.y);
  const selected: Pt[] = [];
  for (const c of candidates) {
    if (!selected.some((p) => Math.abs(p.x - c.x) < minSep)) selected.push(c);
  }
  return selected.sort((a, b) => a.x - b.x);
}

export interface LocalMax extends Pt {
  delta: number;
}

export function localMaxNear(
  profile: Pt[],
  angle: number,
  tol: number,
  minPeak: number,
): LocalMax | null {
  let best: Pt | null = null;
  const lo = angle - tol;
  const hi = angle + tol;
  for (const p of profile) {
    if (p.x < lo || p.x > hi) continue;
    if (!best || p.y > best.y) best = p;
  }
  if (!best || best.y < minPeak) return null;
  return { x: best.x, y: best.y, delta: best.x - angle };
}

export interface StrictPeak extends Pt {
  prominence: number;
}

export function strictLocalPeakNear(
  profile: Pt[],
  angle: number,
  tol: number,
  minPeak: number,
  minProminence = 1,
): StrictPeak | null {
  let best: StrictPeak | null = null;
  for (let i = 1; i < profile.length - 1; i++) {
    const p = profile[i];
    const a = profile[i - 1];
    const b = profile[i + 1];
    if (p.x < angle - tol || p.x > angle + tol || p.y < minPeak || p.y < a.y || p.y < b.y) continue;
    const left = profile[Math.max(0, i - 2)].y;
    const right = profile[Math.min(profile.length - 1, i + 2)].y;
    const prominence = p.y - Math.max(Math.min(a.y, left), Math.min(b.y, right));
    if (prominence < minProminence) continue;
    if (
      !best ||
      Math.abs(p.x - angle) < Math.abs(best.x - angle) ||
      (Math.abs(p.x - angle) === Math.abs(best.x - angle) && p.y > best.y)
    )
      best = { x: p.x, y: p.y, prominence };
  }
  return best;
}

export interface MarkerSupport extends Pt {
  delta: number;
  reason: string;
  lift?: number;
}

/**
 * 参照マーカーを表示すべき実測の裏付け(局所極大 or 肩ピーク)を探す。
 */
export function observedMarkerSupport(
  profile: Pt[],
  angle: number,
  tol: number,
  minPeak: number,
  prominence = 1.0,
  allowShoulder = true,
): MarkerSupport | null {
  const strict = localMaxNear(profile, angle, tol, minPeak);
  if (strict) return { ...strict, reason: 'local-max' };
  if (!allowShoulder) return null;

  const lo = angle - tol;
  const hi = angle + tol;
  const inner = profile.filter((p) => p.x >= lo && p.x <= hi);
  if (!inner.length) return null;
  let best = inner[0];
  for (const p of inner) if (p.y > best.y) best = p;
  if (best.y < minPeak) return null;

  const outerSpan = Math.max(tol * 3.0, tol + 0.18);
  const guard = Math.max(tol * 1.15, tol + 0.03);
  const outer = profile.filter(
    (p) => Math.abs(p.x - angle) <= outerSpan && Math.abs(p.x - angle) >= guard,
  );
  const outerLevel = outer.length
    ? medianValue(outer.map((p) => p.y))
    : Math.min(...inner.map((p) => p.y));
  const innerMin = Math.min(...inner.map((p) => p.y));
  const localBase = Math.min(outerLevel, innerMin);
  const lift = best.y - localBase;

  // 肩ピーク・幅広ピーク用。局所極大ではなくても周辺より盛り上がっていれば残す。
  if (lift >= prominence || best.y >= minPeak + Math.max(0.5, prominence * 0.5)) {
    return { x: best.x, y: best.y, delta: best.x - angle, reason: 'small-or-shoulder', lift };
  }
  return null;
}
