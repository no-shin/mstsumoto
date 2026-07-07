/** 参照相メタデータ(名前/PDF番号/元素/分類/色/マーカー/配向)の編集ダイアログ */

import { useState } from 'react';
import type { MarkerShape, OrientationMode, ReferencePhase } from '../core/types';
import { MARKER_LABELS } from '../plot/markers';
import { parseElementsInput } from '../core/candidates/composition';

interface Props {
  phase: ReferencePhase;
  onSave: (phase: ReferencePhase) => void;
  onCancel: () => void;
}

const ORIENTATION_MODES: Array<{ value: OrientationMode; label: string }> = [
  { value: 'none', label: '配向なし(通常粉末)' },
  { value: '00l', label: '00l 配向 (h=0, k=0, l≠0)' },
  { value: 'h00', label: 'h00 配向 (h≠0, k=0, l=0)' },
  { value: '0k0', label: '0k0 配向 (h=0, k≠0, l=0)' },
  { value: 'hk0', label: 'hk0 配向 (l=0)' },
  { value: 'custom', label: 'custom(条件を指定)' },
];

type Cond = 'zero' | 'nonzero' | 'any';
const COND_LABELS: Record<Cond, string> = { zero: '= 0', nonzero: '≠ 0', any: '任意' };

export function PhaseEditDialog({ phase, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState<ReferencePhase>({ ...phase });
  const [elementsText, setElementsText] = useState(phase.elements.join(', '));

  const set = <K extends keyof ReferencePhase>(key: K, value: ReferencePhase[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const customRule = draft.orientation.custom ?? { h: 'any' as Cond, k: 'any' as Cond, l: 'any' as Cond };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>参照相の設定</h2>
        <p className="muted">
          元ファイル: {draft.sourceFileName}(ピーク {draft.peaks.length} 本)
        </p>

        <div className="row">
          <label className="field grow">
            相名
            <input
              type="text"
              className="grow"
              value={draft.phaseName}
              onChange={(e) => set('phaseName', e.target.value)}
              style={{ minWidth: 260 }}
            />
          </label>
          <label className="field">
            PDF 番号
            <input
              type="text"
              value={draft.pdfId}
              onChange={(e) => set('pdfId', e.target.value)}
              placeholder="00-039-1433"
            />
          </label>
        </div>

        <div className="row">
          <label className="field grow">
            元素(組成候補判定に使用)
            <input
              type="text"
              className="grow"
              value={elementsText}
              onChange={(e) => setElementsText(e.target.value)}
              placeholder="Ba, Fe, O"
              style={{ minWidth: 200 }}
            />
          </label>
          <label className="field">
            相分類
            <input
              type="text"
              value={draft.phaseFamily}
              onChange={(e) => set('phaseFamily', e.target.value)}
              placeholder="M-type hexaferrite"
            />
          </label>
        </div>

        <div className="row">
          <label className="field">
            色
            <input
              type="color"
              value={draft.color}
              onChange={(e) => set('color', e.target.value)}
            />
          </label>
          <label className="field">
            マーカー
            <select
              value={draft.marker}
              onChange={(e) => set('marker', e.target.value as MarkerShape)}
            >
              {(Object.keys(MARKER_LABELS) as MarkerShape[]).map((m) => (
                <option key={m} value={m}>
                  {MARKER_LABELS[m]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            配向仮定
            <select
              value={draft.orientation.mode}
              onChange={(e) =>
                set('orientation', {
                  mode: e.target.value as OrientationMode,
                  custom: e.target.value === 'custom' ? customRule : undefined,
                })
              }
            >
              {ORIENTATION_MODES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {draft.orientation.mode === 'custom' && (
          <div className="row">
            {(['h', 'k', 'l'] as const).map((axis) => (
              <label className="field" key={axis}>
                {axis}
                <select
                  value={customRule[axis]}
                  onChange={(e) =>
                    set('orientation', {
                      mode: 'custom',
                      custom: { ...customRule, [axis]: e.target.value as Cond },
                    })
                  }
                >
                  {(Object.keys(COND_LABELS) as Cond[]).map((c) => (
                    <option key={c} value={c}>
                      {COND_LABELS[c]}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <span className="muted">条件を満たす面のピークを配向強調します</span>
          </div>
        )}

        <p className="muted">
          配向設定は相の存在を確定するものではなく、強度比の不一致を許容するための補正です。
        </p>

        <div className="modal-actions">
          <button onClick={onCancel}>キャンセル</button>
          <button
            className="primary"
            disabled={draft.phaseName.trim() === ''}
            onClick={() => onSave({ ...draft, elements: parseElementsInput(elementsText) })}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
