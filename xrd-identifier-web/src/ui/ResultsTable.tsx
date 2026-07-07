/** 候補相ランキング表(スコア内訳・根拠ピーク・注意点の展開表示付き) */

import type { AnalysisResult, PhaseResult } from '../core/types';

interface Props {
  result: AnalysisResult;
}

function verdict(score: number): { label: string; cls: string } {
  if (score >= 0.6) return { label: '有力', cls: 'strong' };
  if (score >= 0.4) return { label: '可能性あり', cls: 'maybe' };
  return { label: '弱い', cls: 'weak' };
}

export function ResultsTable({ result }: Props) {
  return (
    <div className="panel">
      <h2>候補相ランキング</h2>
      {result.warnings.map((w, i) => (
        <div className="warning-banner" key={i}>
          ⚠ {w}
        </div>
      ))}
      <p className="muted">
        検出ピーク {result.measuredPeaks.length} 本 / 全相共通ゼロシフト{' '}
        {result.globalZeroShift >= 0 ? '+' : ''}
        {result.globalZeroShift.toFixed(3)}° / 未説明ピーク {result.unmatchedPeaks.length} 本
      </p>
      <table className="data">
        <thead>
          <tr>
            <th>#</th>
            <th>相</th>
            <th>スコア</th>
            <th>判定</th>
            <th>一致</th>
            <th>強ピーク</th>
            <th>詳細</th>
          </tr>
        </thead>
        <tbody>
          {result.results.map((r, i) => (
            <ResultRow key={r.phaseId} rank={i + 1} r={r} />
          ))}
        </tbody>
      </table>
      <p className="muted" style={{ marginTop: 8 }}>
        この結果は候補相の自動スコアリングであり、相の最終確定ではありません。重要ピークは必ず目視確認してください。
      </p>
    </div>
  );
}

function ResultRow({ rank, r }: { rank: number; r: PhaseResult }) {
  const v = verdict(r.score);
  const topMatches = r.matches
    .slice()
    .sort((a, b) => b.obsIntensity - a.obsIntensity)
    .slice(0, 8);
  return (
    <>
      <tr>
        <td>{rank}</td>
        <td>
          <span style={{ color: r.color, fontWeight: 600 }}>{r.phaseName}</span>
          {r.pdfId && <span className="muted"> PDF {r.pdfId}</span>}
        </td>
        <td>{r.score.toFixed(3)}</td>
        <td>
          <span className={`badge ${v.cls}`}>{v.label}</span>
        </td>
        <td>
          {r.matchedCount}/{r.refCountInRange}
        </td>
        <td>
          {r.strongMatchedCount}/{r.strongRefCount}
        </td>
        <td>
          <details className="result-detail">
            <summary>展開</summary>
            <p className="muted">
              スコア内訳 ― 位置一致: {r.breakdown.position.toFixed(2)} / 強ピーク説明:{' '}
              {r.breakdown.strongExplained.toFixed(2)} / 観測説明:{' '}
              {r.breakdown.observedExplained.toFixed(2)} / 組成: {r.breakdown.composition.toFixed(2)}{' '}
              / 強度相関: {r.breakdown.intensityCorr.toFixed(2)}
            </p>
            {topMatches.length > 0 && (
              <p style={{ fontSize: 12 }}>
                根拠ピーク:{' '}
                {topMatches
                  .map((m) => `${m.obsTwoTheta.toFixed(2)}°(${m.h}${m.k}${m.l})`)
                  .join(', ')}
              </p>
            )}
            {r.notes.length > 0 && (
              <ul className="notes">
                {r.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            )}
          </details>
        </td>
      </tr>
    </>
  );
}
