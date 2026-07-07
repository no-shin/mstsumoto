/**
 * 全相共通のゼロシフト(装置由来の 2θ 全体ズレ)推定。
 *
 * 旧実装は相ごとに「その相が在る」前提でシフトを推定しており、
 * 存在しない相でも偶然の近接ピークからシフトが作られる循環があった。
 * 本実装では:
 *  1) シフト 0 で各相の仮スコア(強ピーク一致率)を出す
 *  2) 一致率の高い上位相の強ピークだけを使い、観測との差の中央値を全相共通シフトとする
 */

import type { MeasuredPeak, ReferencePhase } from '../types';

function nearestObs(measured: MeasuredPeak[], target: number): MeasuredPeak | null {
  let best: MeasuredPeak | null = null;
  let bestDist = Infinity;
  for (const p of measured) {
    const d = Math.abs(p.twoTheta - target);
    if (d < bestDist) {
      best = p;
      bestDist = d;
    }
  }
  return best;
}

/** 強い参照ピーク(範囲内・強度上位)を返す */
function strongPeaksInRange(ref: ReferencePhase, xMin: number, xMax: number, topN = 12) {
  return ref.peaks
    .filter((p) => p.twoTheta >= xMin && p.twoTheta <= xMax && p.intensity >= 10)
    .sort((a, b) => b.intensity - a.intensity)
    .slice(0, topN);
}

/** シフト 0 での強ピーク一致率(仮判定用) */
function roughMatchRatio(
  ref: ReferencePhase,
  measured: MeasuredPeak[],
  xMin: number,
  xMax: number,
  window: number,
): number {
  const strong = strongPeaksInRange(ref, xMin, xMax);
  if (strong.length === 0) return 0;
  let hit = 0;
  for (const r of strong) {
    const obs = nearestObs(measured, r.twoTheta);
    if (obs && Math.abs(obs.twoTheta - r.twoTheta) <= window) hit += 1;
  }
  return hit / strong.length;
}

export function estimateGlobalZeroShift(
  refs: ReferencePhase[],
  measured: MeasuredPeak[],
  xMin: number,
  xMax: number,
  shiftWindowDeg: number,
): number {
  if (measured.length === 0 || refs.length === 0) return 0;

  const ratios = refs.map((r) => roughMatchRatio(r, measured, xMin, xMax, shiftWindowDeg));
  const maxRatio = Math.max(...ratios);
  if (maxRatio <= 0) return 0;
  // 一致率が最大の 8 割以上の相のみをシフト推定に使う
  const trusted = refs.filter((_, i) => ratios[i] >= Math.max(0.5, maxRatio * 0.8));

  const diffs: number[] = [];
  for (const ref of trusted) {
    for (const r of strongPeaksInRange(ref, xMin, xMax)) {
      const obs = nearestObs(measured, r.twoTheta);
      if (!obs) continue;
      const d = obs.twoTheta - r.twoTheta;
      if (Math.abs(d) <= shiftWindowDeg) diffs.push(d);
    }
  }
  if (diffs.length < 3) return 0;
  diffs.sort((a, b) => a - b);
  return diffs[Math.floor(diffs.length / 2)];
}
