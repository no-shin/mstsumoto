/** XRD 同定(規格化・配向フィルタ・相スコアリング・ピーク調査) */

import type { AppState, Pt, RefPeak, RefPhase, Settings, XrdTrace } from '../types';
import { num } from '../utils';
import { sBool, sNum, sStr } from '../settings';
import { detectPeaks, localMaxNear } from '../peaks/detect';
import { simplifyPhaseLabel } from '../refs/labels';
import { referenceMatchesElementFilter } from '../refs/elements';
import { hklText } from '../parse/refPeaks';

export function phaseLabel(r: RefPhase): string {
  return (r.displayName || simplifyPhaseLabel(r.name || r.rawName || '') || r.name || '').trim();
}

export function sampleDataName(tr: XrdTrace): string {
  return (tr.displayName || tr.comment || tr.name || tr.rawName || '').trim();
}

export function visibleMeasured(state: AppState): XrdTrace[] {
  return state.measured.filter((m) => m.visible && m.points.length);
}

/** 測定データの規格化(表示範囲内 min→0, max→100) */
export function normalizedPoints(trace: XrdTrace, settings: Settings): Pt[] {
  const xMin = sNum(settings, 'xMin', 20);
  const xMax = sNum(settings, 'xMax', 70);
  const inRange = trace.points.filter((p) => p.x >= xMin && p.x <= xMax);
  const target = sBool(settings, 'baseline', true) && inRange.length ? inRange : trace.points;
  const ys = target.map((p) => p.y);
  const minY = ys.length ? Math.min(...ys) : 0;
  const maxY = ys.length ? Math.max(...ys) : 1;
  const span = Math.max(1e-12, maxY - minY);
  const normalize = sBool(settings, 'normalize', true);
  return trace.points.map((p) => ({ x: p.x, y: normalize ? ((p.y - minY) / span) * 100 : p.y }));
}

function hklFilterPass(p: RefPeak, mode: string): boolean {
  const h = num(p.h, NaN);
  const k = num(p.k, NaN);
  const l = num(p.l, NaN);
  if (!Number.isFinite(h) || !Number.isFinite(k) || !Number.isFinite(l)) return false;
  if (mode === 'h00') return h !== 0 && k === 0 && l === 0;
  if (mode === '0k0') return h === 0 && k !== 0 && l === 0;
  if (mode === '00l') return h === 0 && k === 0 && l !== 0;
  if (mode === 'hk0') return h !== 0 && k !== 0 && l === 0;
  if (mode === 'h0l') return h !== 0 && k === 0 && l !== 0;
  if (mode === '0kl') return h === 0 && k !== 0 && l !== 0;
  return true;
}

export function orientationPass(p: RefPeak, settings: Settings): boolean {
  const mode = sStr(settings, 'orientationMode', 'all');
  if (mode === 'all') return true;
  return hklFilterPass(p, mode);
}

export function texturePass(p: RefPeak, mode: string): boolean {
  if (mode === 'none' || mode === 'all') return false;
  return hklFilterPass(p, mode);
}

export interface RefPeakWithPhase extends RefPeak {
  color: string;
  marker: string;
  phaseLabel: string;
}

export function traceRefIds(trace: XrdTrace): Set<string> {
  return new Set(Array.isArray(trace.activeRefs) ? trace.activeRefs : []);
}

export function refsForTrace(state: AppState, trace: XrdTrace): RefPhase[] {
  const ids = traceRefIds(trace);
  const v = sStr(state.settings, 'refSelect', 'all');
  return state.refs.filter((r) => ids.has(r.id) && (v === 'all' || r.name === v || r.id === v));
}

export function selectedRefSetsForTrace(state: AppState, trace: XrdTrace): RefPhase[] {
  const minI = sNum(state.settings, 'refMinI', 0);
  const filter = sStr(state.settings, 'refElementFilter', '');
  return refsForTrace(state, trace)
    .filter((r) => referenceMatchesElementFilter(r, filter))
    .map((r) => ({
      ...r,
      displayName: phaseLabel(r),
      peaks: r.peaks.filter((p) => p.iNorm >= minI && orientationPass(p, state.settings)),
    }))
    .filter((r) => r.peaks.length);
}

export function selectedRefPeaksForTrace(state: AppState, trace: XrdTrace): RefPeakWithPhase[] {
  return selectedRefSetsForTrace(state, trace).flatMap((r) =>
    r.peaks.map((p) => ({
      ...p,
      color: r.color,
      marker: r.marker || 'triangle_down',
      phaseLabel: phaseLabel(r),
    })),
  );
}

/** 全測定で使用中の参照相(未指定なら visible 相) */
export function selectedRefSets(state: AppState): RefPhase[] {
  const minI = sNum(state.settings, 'refMinI', 0);
  const filter = sStr(state.settings, 'refElementFilter', '');
  const used = new Set<string>();
  visibleMeasured(state).forEach((tr) => refsForTrace(state, tr).forEach((r) => used.add(r.id)));
  if (!used.size) state.refs.filter((r) => r.visible).forEach((r) => used.add(r.id));
  return state.refs
    .filter((r) => used.has(r.id) && referenceMatchesElementFilter(r, filter))
    .map((r) => ({
      ...r,
      displayName: phaseLabel(r),
      peaks: r.peaks.filter((p) => p.iNorm >= minI && orientationPass(p, state.settings)),
    }))
    .filter((r) => r.peaks.length);
}

function scoringRefSets(state: AppState): RefPhase[] {
  const v = sStr(state.settings, 'refSelect', 'all');
  const minI = sNum(state.settings, 'refMinI', 8);
  const filter = sStr(state.settings, 'refElementFilter', '');
  return state.refs
    .filter(
      (r) => (v === 'all' || r.name === v || r.id === v) && referenceMatchesElementFilter(r, filter),
    )
    .map((r) => ({
      ...r,
      displayName: phaseLabel(r),
      peaks: r.peaks.filter((p) => p.iNorm >= minI),
    }))
    .filter((r) => r.peaks.length);
}

export interface RefMatch {
  ref: RefPeakWithPhase;
  delta: number;
}

export function nearestRef(x: number, refs: RefPeakWithPhase[], tol: number): RefMatch | null {
  let best: RefPeakWithPhase | null = null;
  let dBest = Infinity;
  for (const r of refs) {
    const d = Math.abs(r.angle - x);
    if (d < dBest) {
      best = r;
      dBest = d;
    }
  }
  return best && dBest <= tol ? { ref: best, delta: x - best.angle } : null;
}

interface ScoreSettings {
  tol: number;
  xMin: number;
  xMax: number;
  textureMode: string;
  textureBoost: number;
  minPeak: number;
  autoShift: string;
  maxShift: number;
  mainRequired: boolean;
}

function estimatePhaseShift(measuredPeaks: Pt[], phase: RefPhase, settings: ScoreSettings): number {
  if (settings.autoShift !== 'on') return 0;
  const maxShift = Math.max(0, settings.maxShift || 0);
  if (!maxShift || !measuredPeaks.length) return 0;
  const expected = phase.peaks.filter(
    (p) => p.angle >= settings.xMin && p.angle <= settings.xMax && (p.iNorm || 0) >= 20,
  );
  const deltas: { delta: number; w: number }[] = [];
  for (const p of expected) {
    let best: Pt | null = null;
    let dBest = Infinity;
    for (const pk of measuredPeaks) {
      const d = Math.abs(pk.x - p.angle);
      if (d < dBest) {
        best = pk;
        dBest = d;
      }
    }
    if (best && dBest <= maxShift) {
      deltas.push({ delta: best.x - p.angle, w: Math.sqrt(Math.max(1, p.iNorm || p.intensity || 1)) });
    }
  }
  if (!deltas.length) return 0;
  const sw = deltas.reduce((s, d) => s + d.w, 0);
  const avg = deltas.reduce((s, d) => s + d.delta * d.w, 0) / Math.max(sw, 1e-9);
  return Math.max(-maxShift, Math.min(maxShift, avg));
}

export interface PhaseCandidate {
  sample: string;
  phase: string;
  score: number;
  main: string;
  matched: number;
  expected: number;
  missingStrong: number;
  note: string;
  color?: string;
}

export function scorePhaseForSample(
  sampleName: string,
  measuredPeaks: Pt[],
  measuredProfile: Pt[],
  phase: RefPhase,
  settings: ScoreSettings,
): PhaseCandidate {
  const { tol, xMin, xMax, textureMode, textureBoost, mainRequired, minPeak } = settings;
  const expected = phase.peaks.filter((p) => p.angle >= xMin && p.angle <= xMax);
  const label = phase.displayName || phase.name;
  if (!expected.length) {
    return {
      sample: sampleName,
      phase: label,
      score: 0,
      main: '範囲外',
      matched: 0,
      expected: 0,
      missingStrong: 0,
      note: '表示範囲内に参照ピークなし',
    };
  }
  const shift = estimatePhaseShift(measuredPeaks, phase, settings);
  const main = expected.reduce((a, b) => ((a.iNorm || 0) >= (b.iNorm || 0) ? a : b));
  const mainMatch = localMaxNear(measuredProfile, main.angle + shift, tol, minPeak);
  const mainFound = Boolean(mainMatch);
  if (mainRequired && !mainFound) {
    return {
      sample: sampleName,
      phase: label,
      score: 0,
      main: `${(main.angle + shift).toFixed(3)} ×`,
      matched: 0,
      expected: expected.length,
      missingStrong: expected.filter((p) => p.iNorm >= 50).length,
      note: `メインピークなし${shift ? ` / shift ${shift.toFixed(3)}°` : ''}`,
    };
  }
  const mainY = Math.max(
    1,
    mainMatch ? mainMatch.y : Math.max(...measuredProfile.map((p) => p.y), 1),
  );
  const mainI = Math.max(1, main.iNorm || main.intensity || 100);
  let weightTotal = 0;
  let weightMatched = 0;
  let qualitySum = 0;
  let missingStrong = 0;
  let anomalyPenalty = 0;
  let matchedCount = 0;
  for (const p of expected) {
    const w = Math.sqrt(Math.max(1, p.iNorm || p.intensity || 1));
    weightTotal += w;
    const targetAngle = p.angle + shift;
    const m = localMaxNear(measuredProfile, targetAngle, tol, minPeak);
    if (!m) {
      if ((p.iNorm || 0) >= 50) missingStrong += 1;
      continue;
    }
    matchedCount += 1;
    weightMatched += w;
    const positionScore = Math.max(0, 1 - Math.abs(m.delta) / Math.max(tol, 1e-6));
    const refRatio = Math.max(0.01, (p.iNorm || p.intensity || 1) / mainI);
    const obsRatio = Math.max(0.001, m.y / mainY);
    const isTexture = texturePass(p, textureMode);
    const boost = isTexture ? Math.max(1, textureBoost) : 1.0;
    const upper = refRatio * (isTexture ? boost : 1.9) + 0.1;
    const lower = Math.max(0.004, refRatio / 5.0 - 0.02);
    let intensityScore = 1.0;
    if (obsRatio > upper) {
      const excess = (obsRatio - upper) / Math.max(upper, 0.02);
      intensityScore = Math.max(0.05, 1 - excess * 0.65);
      anomalyPenalty += w * Math.min(1, excess) * (isTexture ? 0.25 : 0.85);
    } else if (obsRatio < lower) {
      intensityScore = 0.58;
    } else {
      const ratio = Math.abs(Math.log(obsRatio / Math.max(refRatio, 0.01)));
      intensityScore = Math.max(0.58, 1 - ratio / Math.log(isTexture ? Math.max(2.2, boost) : 3.2));
    }
    qualitySum += w * (0.72 * positionScore + 0.28 * intensityScore);
  }
  const coverage = weightTotal ? weightMatched / weightTotal : 0;
  const quality = weightMatched ? qualitySum / weightMatched : 0;
  let score = 100 * (0.74 * coverage + 0.26 * quality);
  score -= missingStrong * 6.5;
  score -= anomalyPenalty * 1.7;
  if (!mainFound) score *= 0.25;
  score = Math.max(0, Math.min(100, score));
  const notes: string[] = [];
  if (shift) notes.push(`shift ${shift.toFixed(3)}°`);
  if (!mainFound) notes.push('メイン弱/なし');
  if (missingStrong) notes.push(`強ピーク欠損${missingStrong}`);
  if (anomalyPenalty > 1) notes.push('非配向ピーク過大');
  if (textureMode !== 'none') notes.push(`${textureMode}補正`);
  return {
    sample: sampleName,
    phase: label,
    score,
    main: `${(main.angle + shift).toFixed(3)} ${mainFound ? '○' : '×'}`,
    matched: matchedCount,
    expected: expected.length,
    missingStrong,
    note: notes.join(' / ') || 'OK',
    color: phase.color,
  };
}

export interface PeakRow extends Pt {
  match: RefMatch | null;
}

export interface Analysis {
  sampleId: string;
  sample: string;
  label: string;
  peaks: PeakRow[];
  matched: number;
  unknown: number;
  candidates: PhaseCandidate[];
}

export function analyze(state: AppState): Analysis[] {
  const s = state.settings;
  const tol = sNum(s, 'tol', 0.2);
  const scoreRefs = scoringRefSets(state);
  const xMin = sNum(s, 'xMin', 20);
  const xMax = sNum(s, 'xMax', 70);
  const settings: ScoreSettings = {
    tol,
    xMin,
    xMax,
    textureMode: sStr(s, 'textureMode', 'none'),
    textureBoost: sNum(s, 'textureBoost', 3),
    minPeak: sNum(s, 'minPeakI', 5),
    autoShift: sStr(s, 'autoShift', 'on'),
    maxShift: sNum(s, 'maxShift', 0.5),
    mainRequired: sBool(s, 'mainPeakRequired', true),
  };
  return visibleMeasured(state).map((tr) => {
    const norm = normalizedPoints(tr, s);
    const peaks = detectPeaks(norm, xMin, xMax, 7, Math.max(0.1, tol * 0.8));
    const refs = selectedRefPeaksForTrace(state, tr);
    const rows: PeakRow[] = peaks.map((pk) => ({ ...pk, match: nearestRef(pk.x, refs, tol) }));
    const candidates = scoreRefs
      .map((phase) => scorePhaseForSample(sampleDataName(tr), peaks, norm, phase, settings))
      .sort((a, b) => b.score - a.score);
    return {
      sampleId: tr.id || sampleDataName(tr),
      sample: sampleDataName(tr),
      label: sampleDataName(tr),
      peaks: rows,
      matched: rows.filter((r) => r.match).length,
      unknown: rows.filter((r) => !r.match).length,
      candidates,
    };
  });
}

export interface ProbeCandidate {
  phase: string;
  color: string;
  marker: string;
  angle: number;
  delta: number;
  intensity: number;
  hkl: string;
  d: number | null;
  visible: boolean;
}

/** ピーク調査: 指定 2θ 近傍の候補を全読み込み済み参照から探す */
export function probeCandidatesAt(state: AppState, angle: number): ProbeCandidate[] {
  const win = Math.max(
    0.01,
    sNum(state.settings, 'probeWindow', Math.max(sNum(state.settings, 'tol', 0.2), 0.35)),
  );
  const rows: ProbeCandidate[] = [];
  for (const set of state.refs) {
    for (const p of set.peaks || []) {
      const delta = angle - p.angle;
      const ad = Math.abs(delta);
      if (ad <= win) {
        rows.push({
          phase: phaseLabel(set),
          color: set.color,
          marker: set.marker || 'triangle_down',
          angle: p.angle,
          delta,
          intensity: p.iNorm ?? p.intensity ?? 0,
          hkl: hklText(p),
          d: p.d,
          visible: Boolean(set.visible),
        });
      }
    }
  }
  rows.sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta) || (b.intensity || 0) - (a.intensity || 0));
  return rows.slice(0, 80);
}

export function snapProbeAngle(state: AppState, angle: number): number {
  if (sStr(state.settings, 'probeSnap', 'on') !== 'on') return angle;
  const win = Math.max(0.03, sNum(state.settings, 'probeWindow', 0.35));
  const threshold = Math.max(1, sNum(state.settings, 'minPeakI', 5));
  const xMin = sNum(state.settings, 'xMin', 20);
  const xMax = sNum(state.settings, 'xMax', 70);
  let best: (Pt & { d: number }) | null = null;
  for (const tr of visibleMeasured(state)) {
    const norm = normalizedPoints(tr, state.settings);
    for (const pk of detectPeaks(norm, xMin, xMax, threshold, Math.max(0.08, win * 0.35))) {
      const d = Math.abs(pk.x - angle);
      if (d <= win && (!best || d < best.d || (Math.abs(d - best.d) < 1e-9 && pk.y > best.y)))
        best = { ...pk, d };
    }
  }
  return best ? best.x : angle;
}
