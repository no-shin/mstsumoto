/** 解析パラメータ + 原料組成 + 候補相選択 + 実行ボタン */

import { useState } from 'react';
import type { AnalysisParams, ReferencePhase } from '../core/types';
import { isPlausibleCandidate, parseElementsInput } from '../core/candidates/composition';

interface Props {
  phases: ReferencePhase[];
  params: AnalysisParams;
  onParamsChange: (params: AnalysisParams) => void;
  elementsText: string;
  onElementsTextChange: (text: string) => void;
  selectedIds: Set<string>;
  onSelectedIdsChange: (ids: Set<string>) => void;
  canRun: boolean;
  onRun: () => void;
}

export function AnalysisControls({
  phases,
  params,
  onParamsChange,
  elementsText,
  onElementsTextChange,
  selectedIds,
  onSelectedIdsChange,
  canRun,
  onRun,
}: Props) {
  const [compositionMessage, setCompositionMessage] = useState('');

  const set = <K extends keyof AnalysisParams>(key: K, value: AnalysisParams[K]) =>
    onParamsChange({ ...params, [key]: value });

  const applyComposition = () => {
    const elements = parseElementsInput(elementsText);
    if (elements.length === 0) {
      setCompositionMessage('元素を読み取れませんでした。「Ba, Cu, Fe」や「Ba3Cu2Fe24O41」の形式で入力してください。');
      return;
    }
    onParamsChange({ ...params, sampleElements: elements });
    // 組成から作れそうな相だけを初期選択にする(人間が加除できる)
    const plausible = phases.filter((p) => isPlausibleCandidate(elements, p.elements));
    const excluded = phases.filter((p) => !isPlausibleCandidate(elements, p.elements));
    onSelectedIdsChange(new Set(plausible.map((p) => p.id)));
    setCompositionMessage(
      `元素 {${elements.join(', ')}} で判定: ${plausible.length} 相を候補に選択` +
        (excluded.length > 0
          ? `、${excluded.length} 相を除外(${excluded.map((p) => p.phaseName).join(', ')})`
          : '。除外された相はありません(全相がこの組成で生成可能)'),
    );
  };

  const toggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectedIdsChange(next);
  };

  return (
    <div className="panel">
      <h2>解析設定</h2>

      <h3>原料組成(任意)</h3>
      <div className="row">
        <input
          type="text"
          className="grow"
          placeholder="例: Ba3Cu2Fe24O41 または Ba, Cu, Fe, O"
          value={elementsText}
          onChange={(e) => onElementsTextChange(e.target.value)}
          style={{ minWidth: 260 }}
        />
        <button onClick={applyComposition} disabled={phases.length === 0}>
          組成から候補相を自動選択
        </button>
      </div>
      <p className="muted">
        試料の合成に使った元素(仕込み組成)。入力すると、その元素だけで作れる相のみを照合候補に
        選び、スコアにも組成妥当性として加点します。
      </p>
      {compositionMessage && <p className="muted">✓ {compositionMessage}</p>}

      <h3>照合する候補相({selectedIds.size} / {phases.length})</h3>
      <div className="row">
        {phases.map((p) => (
          <label className="field" key={p.id}>
            <input
              type="checkbox"
              checked={selectedIds.has(p.id)}
              onChange={() => toggle(p.id)}
            />
            <span style={{ color: p.color }}>{p.phaseName}</span>
          </label>
        ))}
        {phases.length === 0 && <span className="muted">参照値 DB が空です</span>}
      </div>

      <h3>ピーク検出・照合パラメータ</h3>
      <div className="row">
        <label className="field">
          2θ 許容幅 ±
          <input
            type="number"
            step={0.05}
            min={0.05}
            value={params.toleranceDeg}
            onChange={(e) => set('toleranceDeg', Number(e.target.value))}
          />
          °
        </label>
        <label className="field">
          prominence
          <input
            type="number"
            placeholder="自動"
            value={params.prominence ?? ''}
            onChange={(e) =>
              set('prominence', e.target.value === '' ? null : Number(e.target.value))
            }
          />
        </label>
        <label className="field">
          最小ピーク間隔
          <input
            type="number"
            step={0.05}
            min={0.02}
            value={params.minDistanceDeg}
            onChange={(e) => set('minDistanceDeg', Number(e.target.value))}
          />
          °
        </label>
        <label className="field">
          <input
            type="checkbox"
            checked={params.smoothing}
            onChange={(e) => set('smoothing', e.target.checked)}
          />
          平滑化
        </label>
        <label className="field">
          <input
            type="checkbox"
            checked={params.baselineCorrection}
            onChange={(e) => set('baselineCorrection', e.target.checked)}
          />
          バックグラウンド補正
        </label>
        <label className="field">
          未説明ピーク判定のスコア閾値
          <input
            type="number"
            step={0.05}
            min={0}
            max={1}
            value={params.unmatchedScoreThreshold}
            onChange={(e) => set('unmatchedScoreThreshold', Number(e.target.value))}
          />
        </label>
      </div>

      <div className="row" style={{ marginTop: 12 }}>
        <button className="primary" disabled={!canRun} onClick={onRun}>
          解析実行
        </button>
        {!canRun && (
          <span className="muted">測定データと候補相(1つ以上)が必要です</span>
        )}
      </div>
    </div>
  );
}
