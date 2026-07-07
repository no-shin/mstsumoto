/** 測定データの読み込み(D&D / ファイル選択)。3列以上なら列選択を人間に確認する */

import { useRef, useState } from 'react';
import type { MeasuredPattern } from '../core/types';
import { decodeText } from '../core/parse/tokenize';
import {
  buildMeasurement,
  previewMeasurement,
  sampleNameFromFileName,
  type MeasurementPreview,
} from '../core/parse/measurement';

interface Props {
  pattern: MeasuredPattern | null;
  onLoaded: (pattern: MeasuredPattern) => void;
}

interface PendingColumns {
  fileName: string;
  preview: MeasurementPreview;
  twoThetaCol: number;
  intensityCol: number;
}

export function ImportMeasurement({ pattern, onLoaded }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [pending, setPending] = useState<PendingColumns | null>(null);
  const [error, setError] = useState('');

  const loadFile = async (file: File) => {
    setError('');
    try {
      const text = decodeText(await file.arrayBuffer());
      const preview = previewMeasurement(text);
      if (preview.needsColumnConfirmation) {
        setPending({
          fileName: file.name,
          preview,
          twoThetaCol: preview.suggestedTwoThetaCol,
          intensityCol: preview.suggestedIntensityCol,
        });
      } else {
        onLoaded(
          buildMeasurement(
            preview.table,
            preview.suggestedTwoThetaCol,
            preview.suggestedIntensityCol,
            sampleNameFromFileName(file.name),
          ),
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const confirmColumns = () => {
    if (!pending) return;
    try {
      onLoaded(
        buildMeasurement(
          pending.preview.table,
          pending.twoThetaCol,
          pending.intensityCol,
          sampleNameFromFileName(pending.fileName),
        ),
      );
      setPending(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="panel">
      <h2>測定データ</h2>
      <div
        className={`dropzone ${dragging ? 'active' : ''}`}
        onClick={() => fileInput.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files[0];
          if (f) void loadFile(f);
        }}
      >
        {pattern ? (
          <span>
            ✓ <b>{pattern.sampleName}</b>({pattern.twoTheta.length} 点, 2θ ={' '}
            {pattern.twoTheta[0].toFixed(2)}–{pattern.twoTheta[pattern.twoTheta.length - 1].toFixed(2)}
            °) ― クリックまたはドロップで差し替え
          </span>
        ) : (
          <span>測定 XRD データ(txt/csv)をここにドロップ、またはクリックして選択</span>
        )}
      </div>
      <input
        ref={fileInput}
        type="file"
        accept=".txt,.csv,.dat,.xy,.TXT"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void loadFile(f);
          e.target.value = '';
        }}
      />
      {error && <p className="error-text">{error}</p>}

      {pending && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>測定データの列を指定してください</h2>
            <p className="muted">
              {pending.fileName} は {pending.preview.table.columnCount} 列あります。2θ
              列と強度列を確認してください。
            </p>
            <table className="data">
              <tbody>
                {pending.preview.table.rows.slice(0, 5).map((row, i) => (
                  <tr key={i}>
                    {row.map((v, c) => (
                      <td key={c}>{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="row" style={{ marginTop: 10 }}>
              <label className="field">
                2θ 列
                <select
                  value={pending.twoThetaCol}
                  onChange={(e) => setPending({ ...pending, twoThetaCol: Number(e.target.value) })}
                >
                  {Array.from({ length: pending.preview.table.columnCount }, (_, c) => (
                    <option key={c} value={c}>
                      列{c + 1}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                強度列
                <select
                  value={pending.intensityCol}
                  onChange={(e) => setPending({ ...pending, intensityCol: Number(e.target.value) })}
                >
                  {Array.from({ length: pending.preview.table.columnCount }, (_, c) => (
                    <option key={c} value={c}>
                      列{c + 1}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="modal-actions">
              <button onClick={() => setPending(null)}>キャンセル</button>
              <button
                className="primary"
                disabled={pending.twoThetaCol === pending.intensityCol}
                onClick={confirmColumns}
              >
                この列で読み込む
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
