/** 解析のオーケストレーション: ピーク検出 → 全相共通ゼロシフト → 相ごと照合 → 未説明ピーク */

import type { AnalysisParams, AnalysisResult, MeasuredPattern, ReferencePhase } from './types';
import { detectPeaks } from './peaks/detect';
import { estimateGlobalZeroShift } from './match/zeroShift';
import { scorePhase } from './match/score';
import { findUnmatchedPeaks } from './match/unmatched';

export function analyze(
  pattern: MeasuredPattern,
  refs: ReferencePhase[],
  params: AnalysisParams,
): AnalysisResult {
  const warnings: string[] = [];
  const measuredPeaks = detectPeaks(pattern, params);
  if (measuredPeaks.length === 0) {
    warnings.push('ピークが検出できませんでした。prominence 設定を下げてみてください。');
  }
  const xMin = pattern.twoTheta[0];
  const xMax = pattern.twoTheta[pattern.twoTheta.length - 1];

  const zeroShift = estimateGlobalZeroShift(refs, measuredPeaks, xMin, xMax, params.shiftWindowDeg);
  if (Math.abs(zeroShift) > 0.3) {
    warnings.push(
      `推定ゼロシフトが ${zeroShift.toFixed(3)}° と大きめです。試料高さずれや装置校正を確認してください。`,
    );
  }

  const results = refs
    .map((ref) => scorePhase(ref, measuredPeaks, zeroShift, xMin, xMax, params))
    .sort((a, b) => b.score - a.score);

  const unmatchedPeaks = findUnmatchedPeaks(
    measuredPeaks,
    results,
    params.unmatchedScoreThreshold,
    params.toleranceDeg,
  );

  const strongUnmatched = unmatchedPeaks.filter((p) => {
    const maxI = Math.max(...measuredPeaks.map((q) => q.intensity), 1e-9);
    return p.intensity >= maxI * 0.15;
  });
  if (strongUnmatched.length > 0) {
    warnings.push(
      `強い未説明ピークが ${strongUnmatched.length} 本あります(例: ${strongUnmatched
        .slice(0, 3)
        .map((p) => p.twoTheta.toFixed(2) + '°')
        .join(', ')})。参照 DB に無い相が含まれる可能性があります。`,
    );
  }

  return {
    sampleName: pattern.sampleName,
    params,
    measuredPeaks,
    globalZeroShift: zeroShift,
    results,
    unmatchedPeaks,
    warnings,
  };
}
