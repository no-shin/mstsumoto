/** グラフ表示 + 表示オプション + SVG/PNG 保存 */

import { useMemo, useRef, useState } from 'react';
import type { AnalysisResult, MeasuredPattern, ReferencePhase } from '../core/types';
import { DEFAULT_PLOT_OPTIONS, XrdPlot, type PlotOptions } from '../plot/XrdPlot';
import { downloadPng, downloadSvg } from '../plot/exportImage';

interface Props {
  pattern: MeasuredPattern;
  result: AnalysisResult;
  phases: ReferencePhase[];
}

export function PlotPanel({ pattern, result, phases }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // 既定はスコア 0.4 以上の相を表示
  const [visibleIds, setVisibleIds] = useState<Set<string>>(
    () => new Set(result.results.filter((r) => r.score >= 0.4).map((r) => r.phaseId)),
  );
  const [opts, setOpts] = useState(DEFAULT_PLOT_OPTIONS);

  const options: PlotOptions = { ...opts, visiblePhaseIds: visibleIds };
  const referencePeaks = useMemo(() => {
    const map: Record<string, Array<{ twoTheta: number; intensity: number }>> = {};
    for (const p of phases) {
      map[p.id] = p.peaks.map((q) => ({ twoTheta: q.twoTheta, intensity: q.intensity }));
    }
    return map;
  }, [phases]);

  const set = <K extends keyof typeof opts>(key: K, value: (typeof opts)[K]) =>
    setOpts((o) => ({ ...o, [key]: value }));

  const getSvg = () => containerRef.current?.querySelector('svg') ?? null;

  const toggle = (id: string) => {
    const next = new Set(visibleIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setVisibleIds(next);
  };

  return (
    <div className="panel">
      <h2>同定結果グラフ</h2>
      <div className="row">
        {result.results.map((r) => (
          <label className="field" key={r.phaseId}>
            <input
              type="checkbox"
              checked={visibleIds.has(r.phaseId)}
              onChange={() => toggle(r.phaseId)}
            />
            <span style={{ color: r.color }}>
              {r.phaseName} ({r.score.toFixed(2)})
            </span>
          </label>
        ))}
      </div>
      <div className="row">
        <label className="field">
          2θ 範囲
          <input
            type="number"
            placeholder="自動"
            value={opts.xMin ?? ''}
            onChange={(e) => set('xMin', e.target.value === '' ? null : Number(e.target.value))}
          />
          –
          <input
            type="number"
            placeholder="自動"
            value={opts.xMax ?? ''}
            onChange={(e) => set('xMax', e.target.value === '' ? null : Number(e.target.value))}
          />
        </label>
        <label className="field">
          強度範囲
          <input
            type="number"
            placeholder="0"
            value={opts.yMin ?? ''}
            onChange={(e) => set('yMin', e.target.value === '' ? null : Number(e.target.value))}
          />
          –
          <input
            type="number"
            placeholder="自動"
            value={opts.yMax ?? ''}
            onChange={(e) => set('yMax', e.target.value === '' ? null : Number(e.target.value))}
          />
        </label>
        <label className="field">
          <input
            type="checkbox"
            checked={opts.showUnmatched}
            onChange={(e) => set('showUnmatched', e.target.checked)}
          />
          未同定ピーク表示
        </label>
        <label className="field">
          <input
            type="checkbox"
            checked={opts.showReferenceSticks}
            onChange={(e) => set('showReferenceSticks', e.target.checked)}
          />
          参照スティック表示
        </label>
      </div>

      <div ref={containerRef} style={{ marginTop: 10, overflowX: 'auto' }}>
        <XrdPlot
          pattern={pattern}
          result={result}
          options={options}
          referencePeaks={referencePeaks}
        />
      </div>

      <div className="row" style={{ marginTop: 8 }}>
        <button
          onClick={() => {
            const svg = getSvg();
            if (svg) downloadSvg(svg, `${result.sampleName}_identified_plot.svg`);
          }}
        >
          SVG 保存
        </button>
        <button
          onClick={() => {
            const svg = getSvg();
            if (svg) void downloadPng(svg, `${result.sampleName}_identified_plot.png`, 3);
          }}
        >
          PNG 保存(高解像度)
        </button>
        <span className="muted">PDF が必要な場合はブラウザの印刷機能(Ctrl+P)から保存できます</span>
      </div>
    </div>
  );
}
