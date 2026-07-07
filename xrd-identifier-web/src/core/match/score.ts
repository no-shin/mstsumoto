/** 相ごとのスコアリング */

import type {
  AnalysisParams,
  MeasuredPeak,
  PhaseResult,
  RefPeak,
  ReferencePhase,
  ScoreBreakdown,
} from '../types';
import { compositionScore } from '../candidates/composition';
import { assignMatches } from './assign';
import { hasOrientation, refWeight } from './orientation';

const STRONG_REF_TOP_N = 8;
const TOP_OBS_N = 25;

/** ピアソン相関(対数強度) */
function logIntensityCorrelation(pairs: Array<[number, number]>): number {
  if (pairs.length < 3) return 0;
  const xs = pairs.map(([a]) => Math.log(Math.max(a, 1e-6)));
  const ys = pairs.map(([, b]) => Math.log(Math.max(b, 1e-6)));
  const mx = xs.reduce((s, v) => s + v, 0) / xs.length;
  const my = ys.reduce((s, v) => s + v, 0) / ys.length;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < xs.length; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  if (sxx <= 0 || syy <= 0) return 0;
  const corr = sxy / Math.sqrt(sxx * syy);
  return Math.max(0, Math.min(1, (corr + 1) / 2));
}

export function scorePhase(
  ref: ReferencePhase,
  measured: MeasuredPeak[],
  zeroShift: number,
  xMin: number,
  xMax: number,
  params: AnalysisParams,
): PhaseResult {
  const notes: string[] = [];
  const inRange: RefPeak[] = ref.peaks.filter(
    (p) => p.twoTheta + zeroShift >= xMin && p.twoTheta + zeroShift <= xMax && p.intensity >= 1,
  );

  const empty: ScoreBreakdown = {
    position: 0,
    strongExplained: 0,
    observedExplained: 0,
    composition: compositionScore(params.sampleElements, ref.elements),
    intensityCorr: 0,
  };
  if (inRange.length === 0) {
    return buildResult(ref, 0, empty, zeroShift, [], 0, 0, 0, ['参照ピークが測定範囲外です']);
  }

  const matches = assignMatches(inRange, measured, zeroShift, params.toleranceDeg);
  const matchedRefTheta = new Set(matches.map((m) => m.refTwoTheta));

  // 位置一致スコア: 配向重み付きの参照ピーク説明率
  const weights = inRange.map((p) => refWeight(p, ref.orientation));
  const total = weights.reduce((s, v) => s + v, 0);
  const matchedW = inRange.reduce(
    (s, p, i) => (matchedRefTheta.has(p.twoTheta) ? s + weights[i] : s),
    0,
  );
  const position = total > 0 ? matchedW / total : 0;

  // 強ピーク説明率
  const strong = inRange
    .slice()
    .sort((a, b) => b.intensity - a.intensity)
    .slice(0, STRONG_REF_TOP_N);
  const strongMatched = strong.filter((p) => matchedRefTheta.has(p.twoTheta)).length;
  const strongExplained = strong.length > 0 ? strongMatched / strong.length : 0;

  // 観測強ピークの説明率
  const topObs = measured
    .slice()
    .sort((a, b) => b.intensity - a.intensity)
    .slice(0, TOP_OBS_N);
  const explained = topObs.filter((op) =>
    inRange.some((r) => Math.abs(op.twoTheta - (r.twoTheta + zeroShift)) <= params.toleranceDeg),
  ).length;
  const observedExplained = topObs.length > 0 ? explained / topObs.length : 0;

  const intensityCorr = logIntensityCorrelation(
    matches.map((m) => [m.refIntensity, m.obsIntensity]),
  );
  const composition = compositionScore(params.sampleElements, ref.elements);

  const oriented = hasOrientation(ref.orientation);
  // 重み: 位置一致を最重視。配向仮定時は強度相関の寄与をほぼゼロにする。
  const score = oriented
    ? 0.5 * position + 0.23 * strongExplained + 0.1 * observedExplained + 0.15 * composition + 0.02 * intensityCorr
    : 0.45 * position + 0.2 * strongExplained + 0.1 * observedExplained + 0.15 * composition + 0.1 * intensityCorr;

  if (oriented) {
    notes.push(
      `${ref.orientation.mode} 配向を仮定しています。強度比不一致の減点を弱め、主に 2θ 位置一致で判定しています。`,
    );
  }
  if (composition < 0.5 && params.sampleElements.length > 0) {
    notes.push('原料組成に含まれない元素を含む相です。');
  }
  if (strongExplained < 0.5 && position > 0.5) {
    notes.push('参照の強ピークの説明率が低めです。重畳・配向の可能性を確認してください。');
  }

  const breakdown: ScoreBreakdown = {
    position,
    strongExplained,
    observedExplained,
    composition,
    intensityCorr,
  };
  return buildResult(
    ref,
    Math.max(0, Math.min(1, score)),
    breakdown,
    zeroShift,
    matches,
    inRange.length,
    strongMatched,
    strong.length,
    notes,
  );
}

function buildResult(
  ref: ReferencePhase,
  score: number,
  breakdown: ScoreBreakdown,
  zeroShift: number,
  matches: PhaseResult['matches'],
  refCountInRange: number,
  strongMatchedCount: number,
  strongRefCount: number,
  notes: string[],
): PhaseResult {
  return {
    phaseId: ref.id,
    phaseName: ref.phaseName,
    pdfId: ref.pdfId,
    score,
    breakdown,
    zeroShift,
    matches,
    matchedCount: matches.length,
    refCountInRange,
    strongMatchedCount,
    strongRefCount,
    orientation: ref.orientation,
    color: ref.color,
    marker: ref.marker,
    notes,
  };
}
