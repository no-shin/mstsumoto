/** match_report.txt の生成 */

import type { AnalysisResult } from '../types';

const APP_NAME = 'XRD Identifier Web v0.2.0';

export function buildReport(result: AnalysisResult): string {
  const lines: string[] = [];
  lines.push(APP_NAME);
  lines.push('='.repeat(60));
  lines.push(`試料名: ${result.sampleName}`);
  lines.push(`解析日時: ${new Date().toLocaleString('ja-JP')}`);
  lines.push(`2θ許容幅: ±${result.params.toleranceDeg.toFixed(3)} deg`);
  lines.push(
    `ピークprominence: ${result.params.prominence === null ? '自動' : result.params.prominence}`,
  );
  lines.push(`平滑化: ${result.params.smoothing ? 'ON' : 'OFF'}  バックグラウンド補正: ${result.params.baselineCorrection ? 'ON' : 'OFF'}`);
  lines.push(`原料組成(元素): ${result.params.sampleElements.join(', ') || '(未指定)'}`);
  lines.push(`全相共通ゼロシフト: ${result.globalZeroShift >= 0 ? '+' : ''}${result.globalZeroShift.toFixed(4)} deg`);
  lines.push('');

  if (result.warnings.length > 0) {
    lines.push('警告:');
    for (const w of result.warnings) lines.push(`- ${w}`);
    lines.push('');
  }

  lines.push(`検出ピーク数: ${result.measuredPeaks.length}`);
  lines.push('');
  lines.push('候補相ランキング:');
  result.results.forEach((r, i) => {
    lines.push(
      `  ${i + 1}. ${r.phaseName}${r.pdfId ? ` (PDF ${r.pdfId})` : ''}  score=${r.score.toFixed(3)}  matched=${r.matchedCount}/${r.refCountInRange}  強ピーク=${r.strongMatchedCount}/${r.strongRefCount}`,
    );
    lines.push(
      `     内訳: 位置=${r.breakdown.position.toFixed(2)} 強ピーク=${r.breakdown.strongExplained.toFixed(2)} 観測説明=${r.breakdown.observedExplained.toFixed(2)} 組成=${r.breakdown.composition.toFixed(2)} 強度=${r.breakdown.intensityCorr.toFixed(2)}`,
    );
    if (r.matches.length > 0) {
      const top = r.matches
        .slice()
        .sort((a, b) => b.obsIntensity - a.obsIntensity)
        .slice(0, 8)
        .map((m) => `${m.obsTwoTheta.toFixed(2)}°(${m.h}${m.k}${m.l})`);
      lines.push(`     根拠ピーク例: ${top.join(', ')}`);
    }
    for (const note of r.notes) lines.push(`     注意: ${note}`);
  });
  lines.push('');

  lines.push(`未説明ピーク(スコア≥${result.params.unmatchedScoreThreshold} の相で説明できないもの): ${result.unmatchedPeaks.length} 本`);
  for (const p of result.unmatchedPeaks.slice(0, 30)) {
    lines.push(`  - ${p.twoTheta.toFixed(3)}°  I=${p.intensity.toFixed(1)}`);
  }
  lines.push('');
  lines.push('注意:');
  lines.push('- この結果は候補相の自動スコアリングであり、相の最終確定ではありません。');
  lines.push('- 配向、ピーク重畳、固溶によるピークシフト、バックグラウンドにより強度比は崩れます。');
  lines.push('- 重要ピークは必ず元データと参照値で目視確認してください。');
  return lines.join('\n');
}
