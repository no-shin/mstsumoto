/** MH ループの表示用変換とヒステリシス解析(Hc, Mr, Ms, ループ面積) */

import type { MhTrace, Pt, Settings } from '../types';
import { linearZero } from '../utils';
import { sNum, sStr } from '../settings';
import { movingAverageValues } from '../peaks/smooth';

export function mhDisplayName(t: MhTrace): string {
  return (t.displayName || t.name || t.rawName || '').trim();
}

export function mhMassForTrace(t: MhTrace, settings: Settings): number | null {
  const mode = sStr(settings, 'mhMassMode', 'auto');
  if (mode === 'raw') return null;
  if (mode === 'manual') {
    const m = sNum(settings, 'mhManualMass', NaN);
    return Number.isFinite(m) && m > 0 ? m : null;
  }
  const m = Number(t.mass);
  return Number.isFinite(m) && m > 0 ? m : null;
}

/** kOe / (emu/g 換算・平滑化・間引き)済みの表示点列 */
export function mhPlotPoints(t: MhTrace, settings: Settings): Pt[] {
  const mass = mhMassForTrace(t, settings);
  const rawY = (t.points || []).map((p) => (mass ? p.mEmu / mass : p.mEmu));
  const ys = movingAverageValues(rawY, sNum(settings, 'mhSmooth', 0));
  const step = Math.max(1, Math.floor(sNum(settings, 'mhPointStep', 1)));
  const pts: Pt[] = [];
  for (let i = 0; i < (t.points || []).length; i += step) {
    const p = t.points[i];
    const y = ys[i];
    const x = p.hOe / 1000;
    if (Number.isFinite(x) && Number.isFinite(y)) pts.push({ x, y });
  }
  return pts;
}

export interface MhAnalysis {
  name: string;
  hcPlus: number;
  hcMinus: number;
  hcMean: number;
  mrPlus: number;
  mrMinus: number;
  mrMean: number;
  ms: number;
  mrMs: number;
  area: number;
}

export function analyzeMHTrace(t: MhTrace, settings: Settings): MhAnalysis | null {
  const pts = mhPlotPoints(t, settings);
  if (pts.length < 3) return null;
  const hc: number[] = [];
  const mr: { v: number; dir: number }[] = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if (a.y === 0 || b.y === 0 || a.y * b.y < 0)
      hc.push(linearZero(a as unknown as Record<string, number>, b as unknown as Record<string, number>, 'x', 'y'));
    if (a.x === 0 || b.x === 0 || a.x * b.x < 0)
      mr.push({
        v: linearZero(a as unknown as Record<string, number>, b as unknown as Record<string, number>, 'y', 'x'),
        dir: Math.sign(b.x - a.x),
      });
  }
  const hcPos = hc.filter((v) => Number.isFinite(v) && v >= 0);
  const hcNeg = hc.filter((v) => Number.isFinite(v) && v <= 0);
  const hcPlus = hcPos.length ? Math.max(...hcPos) : NaN;
  const hcMinus = hcNeg.length ? Math.min(...hcNeg) : NaN;
  const hcMean =
    Number.isFinite(hcPlus) && Number.isFinite(hcMinus)
      ? (Math.abs(hcPlus) + Math.abs(hcMinus)) / 2
      : NaN;
  const mrPlus = mr.find((v) => v.dir > 0)?.v ?? NaN;
  const mrMinus = mr.find((v) => v.dir < 0)?.v ?? NaN;
  const mrMean =
    Number.isFinite(mrPlus) && Number.isFinite(mrMinus)
      ? (Math.abs(mrPlus) + Math.abs(mrMinus)) / 2
      : NaN;
  const maxH = Math.max(...pts.map((p) => Math.abs(p.x)));
  const high = pts.filter((p) => Math.abs(p.x) >= maxH * 0.85).map((p) => Math.abs(p.y));
  const ms = high.length ? high.reduce((a, b) => a + b, 0) / high.length : NaN;
  let area = 0;
  for (let i = 1; i < pts.length; i++) area += ((pts[i].x - pts[i - 1].x) * (pts[i].y + pts[i - 1].y)) / 2;
  return {
    name: mhDisplayName(t),
    hcPlus,
    hcMinus,
    hcMean,
    mrPlus,
    mrMinus,
    mrMean,
    ms,
    mrMs:
      Number.isFinite(mrMean) && Number.isFinite(ms) && Math.abs(ms) > 1e-12
        ? mrMean / Math.abs(ms)
        : NaN,
    area: Math.abs(area),
  };
}

export function mhAnalysisRows(traces: MhTrace[], settings: Settings): MhAnalysis[] {
  return traces
    .filter((t) => t.visible !== false)
    .map((t) => analyzeMHTrace(t, settings))
    .filter((r): r is MhAnalysis => Boolean(r));
}
