/** 六方晶の格子定数フィット(1/d² 最小二乗)とピーク対応管理 */

import type { AppState, PeakAlignment, XrdTrace } from '../types';
import { num } from '../utils';
import { sNum } from '../settings';
import { strictLocalPeakNear } from '../peaks/detect';
import {
  normalizedPoints,
  sampleDataName,
  selectedRefPeaksForTrace,
  visibleMeasured,
} from './identify';
import type { RefPeakWithPhase } from './identify';

export function xrdPeakKey(r: {
  phaseLabel?: string;
  phase?: string;
  angle: number;
  h: number | string | null;
  k: number | string | null;
  l: number | string | null;
  d: number | null;
}): string {
  return `${r.phaseLabel || r.phase || ''}|${Number(r.angle).toFixed(5)}|${r.h ?? ''}|${r.k ?? ''}|${
    r.l ?? ''
  }|${Number.isFinite(Number(r.d)) ? Number(r.d).toFixed(5) : ''}`;
}

export function markerStateKey(trace: XrdTrace, peak: Parameters<typeof xrdPeakKey>[0]): string {
  return `${trace.id || sampleDataName(trace)}::${xrdPeakKey(peak)}`;
}

export function alignedPeakAngle(state: AppState, r: RefPeakWithPhase): number {
  const a = state.xrdPeakAlignments?.[xrdPeakKey(r)];
  const corrected = a?.correctedTwoTheta;
  return a && Number.isFinite(Number(corrected)) ? Number(corrected) : Number(r.angle);
}

export function braggD(state: AppState, twoThetaDeg: number): number {
  const lambda = Math.max(0.1, sNum(state.settings, 'xrdLambda', 1.54056));
  const theta = (Number(twoThetaDeg) * Math.PI) / 360;
  const s = Math.sin(theta);
  return s > 1e-9 ? lambda / (2 * s) : NaN;
}

export interface AlignmentRow extends PeakAlignment {
  dObs: number;
}

export function xrdAlignmentRows(state: AppState): AlignmentRow[] {
  const rows: AlignmentRow[] = [];
  for (const [key, a] of Object.entries(state.xrdPeakAlignments || {})) {
    const correctedTwoTheta = Number(a.correctedTwoTheta);
    const originalTwoTheta = Number(a.originalTwoTheta);
    const dObs = Number.isFinite(correctedTwoTheta) ? braggD(state, correctedTwoTheta) : NaN;
    rows.push({ ...a, key, originalTwoTheta, correctedTwoTheta, dObs, use: a.use !== false });
  }
  return rows.sort(
    (a, b) =>
      (a.referenceName || '').localeCompare(b.referenceName || '') ||
      a.originalTwoTheta - b.originalTwoTheta,
  );
}

interface UsedRow extends AlignmentRow {
  xA: number;
  xC: number;
  y: number;
  residual?: number;
}

export interface HexLatticeFit {
  ok: boolean;
  reason?: string;
  a?: number;
  c?: number;
  rms?: number;
  used: UsedRow[];
}

export function solveHexLattice(rows: AlignmentRow[]): HexLatticeFit {
  const used: UsedRow[] = rows
    .filter((r) => {
      const h = Number(r.h);
      const k = Number(r.k);
      const l = Number(r.l);
      const d = Number(r.dObs);
      return (
        r.use !== false &&
        [h, k, l, d].every(Number.isFinite) &&
        d > 0 &&
        (h * h + h * k + k * k > 0 || l !== 0)
      );
    })
    .map((r) => {
      const h = Number(r.h);
      const k = Number(r.k);
      const l = Number(r.l);
      const d = Number(r.dObs);
      return { ...r, xA: (4 / 3) * (h * h + h * k + k * k), xC: l * l, y: 1 / (d * d) };
    });
  if (used.length < 2) return { ok: false, reason: '有効なhkl付きピークが不足しています。', used };
  let sAA = 0;
  let sAC = 0;
  let sCC = 0;
  let sAy = 0;
  let sCy = 0;
  used.forEach((r) => {
    sAA += r.xA * r.xA;
    sAC += r.xA * r.xC;
    sCC += r.xC * r.xC;
    sAy += r.xA * r.y;
    sCy += r.xC * r.y;
  });
  const det = sAA * sCC - sAC * sAC;
  if (Math.abs(det) < 1e-14)
    return { ok: false, reason: 'a と c を同時に求めるための独立なhklが不足しています。', used };
  const A = (sAy * sCC - sCy * sAC) / det;
  const C = (sAA * sCy - sAC * sAy) / det;
  if (A <= 0 || C <= 0 || !Number.isFinite(A) || !Number.isFinite(C))
    return { ok: false, reason: '格子定数を正の値として計算できません。', used };
  const a = 1 / Math.sqrt(A);
  const c = 1 / Math.sqrt(C);
  let ss = 0;
  const withResiduals = used.map((r) => {
    const pred = r.xA * A + r.xC * C;
    const residual = r.y - pred;
    ss += residual * residual;
    return { ...r, residual };
  });
  return { ok: true, a, c, used: withResiduals, rms: Math.sqrt(ss / Math.max(1, used.length - 2)) };
}

export function nearestMeasuredPeakTwoTheta(
  state: AppState,
  angle: number,
  tolerance?: number,
  traceId?: string,
): number {
  const tol = Math.max(0.01, num(tolerance, sNum(state.settings, 'markerPeakWindow', 0.1)));
  const minPeak = sNum(state.settings, 'markerPeakMin', 2.0);
  const minProminence = sNum(state.settings, 'markerPeakProminence', 1.0);
  let best: { x: number } | null = null;
  visibleMeasured(state).forEach((tr) => {
    if (traceId && tr.id !== traceId) return;
    const norm = normalizedPoints(tr, state.settings);
    const p = strictLocalPeakNear(norm, angle, tol, minPeak, minProminence);
    if (p && (!best || Math.abs(p.x - angle) < Math.abs(best.x - angle))) best = p;
  });
  return best ? (best as { x: number }).x : NaN;
}

/** 参照ピークを実測ピークへ自動対応させ、alignments を返す(既存の手動対応は保持) */
export function autoAssignLatticePeaks(state: AppState): Record<string, PeakAlignment> {
  const tol = sNum(state.settings, 'latticeAutoTol', 0.2);
  const out: Record<string, PeakAlignment> = { ...state.xrdPeakAlignments };
  visibleMeasured(state).forEach((tr) => {
    const norm = normalizedPoints(tr, state.settings);
    const used = new Set<number>();
    const refs = selectedRefPeaksForTrace(state, tr)
      .filter((r) => r.h != null && r.k != null && r.l != null)
      .sort((a, b) => (b.iNorm || b.intensity || 0) - (a.iNorm || a.intensity || 0));
    refs.forEach((r) => {
      const key = markerStateKey(tr, r);
      if (out[key] && !out[key].autoAssigned) return;
      const peak = strictLocalPeakNear(
        norm,
        Number(r.angle),
        tol,
        sNum(state.settings, 'markerPeakMin', 2),
        sNum(state.settings, 'markerPeakProminence', 1),
      );
      if (!peak || used.has(peak.x)) return;
      used.add(peak.x);
      out[key] = {
        key,
        referenceName: r.phaseLabel || r.phase || '',
        sampleName: sampleDataName(tr),
        traceId: tr.id,
        originalTwoTheta: Number(r.angle),
        correctedTwoTheta: peak.x,
        matchedMeasuredPeakTwoTheta: peak.x,
        h: r.h,
        k: r.k,
        l: r.l,
        d: r.d,
        intensity: r.iNorm ?? r.intensity,
        use: true,
        autoAssigned: true,
      };
    });
  });
  return out;
}
