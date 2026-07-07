/**
 * 観測ピークと参照ピークの 1対1 割り当て。
 * 旧実装の「1観測ピークが複数参照ピークにマッチしてスコア過大」問題への対策。
 * 参照強度の高い順に、許容幅内で最も近い未使用の観測ピークを割り当てる貪欲法。
 */

import type { MeasuredPeak, PeakMatch, RefPeak } from '../types';

export function assignMatches(
  refPeaks: RefPeak[],
  measured: MeasuredPeak[],
  zeroShift: number,
  toleranceDeg: number,
): PeakMatch[] {
  const usedObs = new Set<number>();
  const matches: PeakMatch[] = [];
  const refOrder = refPeaks
    .map((_, i) => i)
    .sort((a, b) => refPeaks[b].intensity - refPeaks[a].intensity);

  for (const ri of refOrder) {
    const ref = refPeaks[ri];
    const target = ref.twoTheta + zeroShift;
    let best = -1;
    let bestDist = Infinity;
    for (let oi = 0; oi < measured.length; oi++) {
      if (usedObs.has(oi)) continue;
      const dist = Math.abs(measured[oi].twoTheta - target);
      if (dist <= toleranceDeg && dist < bestDist) {
        best = oi;
        bestDist = dist;
      }
    }
    if (best >= 0) {
      usedObs.add(best);
      const obs = measured[best];
      matches.push({
        refTwoTheta: ref.twoTheta,
        obsTwoTheta: obs.twoTheta,
        obsIntensity: obs.intensity,
        refIntensity: ref.intensity,
        diff: obs.twoTheta - target,
        h: ref.h,
        k: ref.k,
        l: ref.l,
      });
    }
  }
  matches.sort((a, b) => a.refTwoTheta - b.refTwoTheta);
  return matches;
}
