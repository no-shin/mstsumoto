/** 画面全体。状態の持ち回りはこのコンポーネントに集約する(core は純関数なので状態を持たない) */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AnalysisParams, AnalysisResult, MeasuredPattern, ReferencePhase } from '../core/types';
import { DEFAULT_PARAMS } from '../core/types';
import { analyze } from '../core/analyze';
import { listPhases } from '../db/referenceStore';
import { ImportMeasurement } from './ImportMeasurement';
import { ReferenceManager } from './ReferenceManager';
import { AnalysisControls } from './AnalysisControls';
import { ResultsTable } from './ResultsTable';
import { PlotPanel } from './PlotPanel';
import { ExportPanel } from './ExportPanel';

export function App() {
  const [phases, setPhases] = useState<ReferencePhase[]>([]);
  const [pattern, setPattern] = useState<MeasuredPattern | null>(null);
  const [params, setParams] = useState<AnalysisParams>(DEFAULT_PARAMS);
  const [elementsText, setElementsText] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState('');

  const reloadPhases = useCallback(() => {
    void listPhases().then((loaded) => {
      setPhases(loaded);
      // 新規インポートされた相は自動で選択に加える
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const p of loaded) if (!prev.has(p.id)) next.add(p.id);
        // DB から消えた相は選択からも外す
        const ids = new Set(loaded.map((p) => p.id));
        for (const id of next) if (!ids.has(id)) next.delete(id);
        return next;
      });
    });
  }, []);

  useEffect(() => {
    reloadPhases();
  }, [reloadPhases]);

  const selectedPhases = useMemo(
    () => phases.filter((p) => selectedIds.has(p.id)),
    [phases, selectedIds],
  );

  const runAnalysis = () => {
    if (!pattern || selectedPhases.length === 0) return;
    setAnalysisError('');
    try {
      setResult(analyze(pattern, selectedPhases, params));
    } catch (e) {
      setAnalysisError(e instanceof Error ? e.message : String(e));
      setResult(null);
    }
  };

  return (
    <div className="app">
      <h1 className="app-title">XRD Identifier</h1>
      <p className="app-subtitle">
        粉末XRD同定支援 ― 候補相ランキング + 根拠ピーク提示。相を断定するツールではありません。
        データはすべてこのブラウザ内で処理され、外部送信されません。
      </p>

      <ImportMeasurement
        pattern={pattern}
        onLoaded={(p) => {
          setPattern(p);
          setResult(null);
        }}
      />

      <ReferenceManager phases={phases} onChanged={reloadPhases} />

      <AnalysisControls
        phases={phases}
        params={params}
        onParamsChange={setParams}
        elementsText={elementsText}
        onElementsTextChange={setElementsText}
        selectedIds={selectedIds}
        onSelectedIdsChange={setSelectedIds}
        canRun={pattern !== null && selectedIds.size > 0}
        onRun={runAnalysis}
      />

      {analysisError && (
        <div className="panel">
          <p className="error-text">解析エラー: {analysisError}</p>
        </div>
      )}

      {result && pattern && (
        <>
          <ResultsTable result={result} />
          <PlotPanel pattern={pattern} result={result} phases={selectedPhases} />
          <ExportPanel result={result} />
        </>
      )}
    </div>
  );
}
