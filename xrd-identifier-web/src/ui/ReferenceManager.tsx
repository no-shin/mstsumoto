/**
 * 参照値 DB 管理パネル。
 * インポートフロー: ファイル選択 → 列マッピング確認(人間) → メタデータ編集(人間) → IndexedDB 保存
 */

import { useRef, useState } from 'react';
import type { ColumnMapping, ReferencePhase } from '../core/types';
import { decodeText, parseNumericTable, type NumericTable } from '../core/parse/tokenize';
import { guessColumnMapping, type ColumnGuess } from '../core/parse/columnGuess';
import {
  buildReferencePeaks,
  elementsFromText,
  phaseNameFromFileName,
} from '../core/parse/reference';
import { deletePhase, exportAllAsJson, importFromJson, savePhase } from '../db/referenceStore';
import { downloadText } from '../plot/exportImage';
import { ColumnMappingDialog } from './ColumnMappingDialog';
import { PhaseEditDialog } from './PhaseEditDialog';
import { newId, suggestStyle } from './common';

interface Props {
  phases: ReferencePhase[];
  onChanged: () => void; // DB 変更後の再読込を親に依頼
}

/** インポート途中のファイル状態 */
interface PendingImport {
  fileName: string;
  table: NumericTable;
  guess: ColumnGuess;
}

export function ReferenceManager({ phases, onChanged }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const jsonInput = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<PendingImport[]>([]);
  const [editTarget, setEditTarget] = useState<ReferencePhase | null>(null);
  const [error, setError] = useState('');

  const startImport = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError('');
    const items: PendingImport[] = [];
    for (const file of Array.from(files)) {
      try {
        const text = decodeText(await file.arrayBuffer());
        const table = parseNumericTable(text);
        if (table.rows.length === 0) throw new Error('数値データ行がありません');
        items.push({ fileName: file.name, table, guess: guessColumnMapping(table) });
      } catch (e) {
        setError(`${file.name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    setQueue((q) => [...q, ...items]);
  };

  /** 列マッピング確定 → メタデータ編集ダイアログへ */
  const onMappingConfirmed = (mapping: ColumnMapping) => {
    const current = queue[0];
    try {
      const peaks = buildReferencePeaks(current.table, mapping);
      const { phaseName, pdfId } = phaseNameFromFileName(current.fileName);
      const style = suggestStyle(phaseName, '');
      setEditTarget({
        id: newId(),
        phaseName,
        pdfId,
        elements: elementsFromText(phaseName),
        phaseFamily: '',
        color: style.color,
        marker: style.marker,
        orientation: { mode: 'none' },
        peaks,
        columnMapping: mapping,
        sourceFileName: current.fileName,
        importedAt: new Date().toISOString(),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setQueue((q) => q.slice(1));
    }
  };

  const onPhaseSaved = async (phase: ReferencePhase) => {
    await savePhase(phase);
    setEditTarget(null);
    // インポート由来なら次のファイルへ
    setQueue((q) => (q.length > 0 && phase.sourceFileName === q[0].fileName ? q.slice(1) : q));
    onChanged();
  };

  const onDelete = async (phase: ReferencePhase) => {
    if (!window.confirm(`「${phase.phaseName}」を参照DBから削除しますか?`)) return;
    await deletePhase(phase.id);
    onChanged();
  };

  const onExportJson = async () => {
    downloadText(await exportAllAsJson(), 'xrd_reference_db.json', 'application/json');
  };

  const onImportJson = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    try {
      const n = await importFromJson(await files[0].text());
      window.alert(`${n} 件の参照相を取り込みました。`);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="panel">
      <h2>参照値データベース({phases.length} 相)</h2>
      <div className="row">
        <button className="primary" onClick={() => fileInput.current?.click()}>
          参照値ファイルをインポート (txt/csv)
        </button>
        <button onClick={onExportJson} disabled={phases.length === 0}>
          DB を JSON で書き出し
        </button>
        <button onClick={() => jsonInput.current?.click()}>JSON から取り込み</button>
        <input
          ref={fileInput}
          type="file"
          accept=".txt,.csv,.dat,.xy"
          multiple
          hidden
          onChange={(e) => {
            void startImport(e.target.files);
            e.target.value = '';
          }}
        />
        <input
          ref={jsonInput}
          type="file"
          accept=".json"
          hidden
          onChange={(e) => {
            void onImportJson(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
      {error && <p className="error-text">{error}</p>}

      {phases.length > 0 && (
        <table className="data" style={{ marginTop: 10 }}>
          <thead>
            <tr>
              <th>相名</th>
              <th>PDF</th>
              <th>元素</th>
              <th>ピーク数</th>
              <th>配向</th>
              <th>スタイル</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {phases.map((p) => (
              <tr key={p.id}>
                <td>{p.phaseName}</td>
                <td>{p.pdfId}</td>
                <td>{p.elements.join(', ')}</td>
                <td>{p.peaks.length}</td>
                <td>{p.orientation.mode}</td>
                <td>
                  <span style={{ color: p.color }}>■</span> {p.marker}
                </td>
                <td>
                  <button onClick={() => setEditTarget(p)}>編集</button>{' '}
                  <button className="danger" onClick={() => void onDelete(p)}>
                    削除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {phases.length === 0 && (
        <p className="muted">
          参照値がまだありません。ICDD/PDF 由来のピーク表(txt/csv)をインポートしてください。
        </p>
      )}

      {queue.length > 0 && !editTarget && (
        <ColumnMappingDialog
          fileName={queue[0].fileName}
          table={queue[0].table}
          guess={queue[0].guess}
          onConfirm={onMappingConfirmed}
          onCancel={() => setQueue((q) => q.slice(1))}
        />
      )}
      {editTarget && (
        <PhaseEditDialog
          phase={editTarget}
          onSave={(p) => void onPhaseSaved(p)}
          onCancel={() => {
            setEditTarget(null);
            setQueue((q) =>
              q.length > 0 && editTarget.sourceFileName === q[0].fileName ? q.slice(1) : q,
            );
          }}
        />
      )}
    </div>
  );
}
