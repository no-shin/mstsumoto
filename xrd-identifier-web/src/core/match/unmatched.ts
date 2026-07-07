/** 未説明ピーク抽出: 「有力」判定(スコア閾値以上)の相だけで説明済みとみなす */

import type { MeasuredPeak, PhaseResult } from '../types';

export function findUnmatchedPeaks(
  measured: MeasuredPeak[],
  results: PhaseResult[],
  scoreThreshold: number,
  toleranceDeg: number,
): MeasuredPeak[] {
  const strong = results.filter((r) => r.score >= scoreThreshold);
  return measured.filter(
    (p) =>
      !strong.some((r) =>
        r.matches.some((m) => Math.abs(p.twoTheta - m.obsTwoTheta) <= toleranceDeg),
      ),
  );
}
