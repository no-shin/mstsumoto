/**
 * 参照ファイルの列マッピング確認ダイアログ(人間との対話 UI の中核)。
 * 先頭数行をプレビュー表示し、各役割(h/k/l/I/2θ/d)の列番号を人間が確定する。
 * Bragg の式による 2θ–d 整合チェックで取り違えを即座に警告する。
 */

import { useMemo, useState } from 'react';
import type { ColumnMapping } from '../core/types';
import type { NumericTable } from '../core/parse/tokenize';
import { braggMismatchRatio, type ColumnGuess } from '../core/parse/columnGuess';

interface Props {
  fileName: string;
  table: NumericTable;
  guess: ColumnGuess;
  onConfirm: (mapping: ColumnMapping) => void;
  onCancel: () => void;
}

const ROLES: Array<{ key: keyof ColumnMapping; label: string; required: boolean }> = [
  { key: 'twoTheta', label: '2θ (deg)', required: true },
  { key: 'intensity', label: '強度 I', required: true },
  { key: 'h', label: 'h', required: false },
  { key: 'k', label: 'k', required: false },
  { key: 'l', label: 'l', required: false },
  { key: 'd', label: 'd (Å)', required: false },
];

export function ColumnMappingDialog({ fileName, table, guess, onConfirm, onCancel }: Props) {
  const [mapping, setMapping] = useState<ColumnMapping>(guess.mapping);
  const nCols = table.columnCount;
  const previewRows = table.rows.slice(0, 6);

  const braggRatio = useMemo(() => braggMismatchRatio(table, mapping), [table, mapping]);
  const duplicates = useMemo(() => {
    const used = Object.values(mapping).filter((v) => v >= 0);
    return new Set(used.filter((v, i) => used.indexOf(v) !== i));
  }, [mapping]);

  const valid =
    mapping.twoTheta >= 0 && mapping.intensity >= 0 && duplicates.size === 0;

  const roleOfColumn = (col: number): string => {
    const hits = ROLES.filter((r) => mapping[r.key] === col).map((r) => r.label);
    return hits.join(' / ');
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>列の割り当てを確認してください</h2>
        <p className="muted">
          ファイル: {fileName} ― {guess.reason}
          {!guess.confident && ' 自動推定に自信がありません。必ず確認してください。'}
        </p>
        <p className="muted">
          ICDD/PDF 由来のファイルは <b>l k h I 2θ d</b> のような非標準の列順のことがあります。
          h と l の取り違えは配向判定を壊すため、下のプレビューと照らして確認してください。
        </p>

        <table className="data">
          <thead>
            <tr>
              {Array.from({ length: nCols }, (_, c) => (
                <th key={c}>
                  列{c + 1}
                  <br />
                  <span style={{ color: '#1d4ed8' }}>{roleOfColumn(c) || '―'}</span>
                </th>
              ))}
            </tr>
            {table.headers.length > 0 && (
              <tr>
                {Array.from({ length: nCols }, (_, c) => (
                  <th key={c} style={{ fontWeight: 400 }}>
                    {table.headers[c] ?? ''}
                  </th>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {previewRows.map((row, i) => (
              <tr key={i}>
                {Array.from({ length: nCols }, (_, c) => (
                  <td key={c}>{c < row.length ? row[c] : ''}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        <h3>各項目がどの列にあるか指定:</h3>
        <div className="row">
          {ROLES.map((role) => (
            <label className="field" key={role.key}>
              {role.label}
              {role.required && <span style={{ color: '#dc2626' }}>*</span>}
              <select
                value={mapping[role.key]}
                onChange={(e) =>
                  setMapping({ ...mapping, [role.key]: Number(e.target.value) })
                }
              >
                <option value={-1}>なし</option>
                {Array.from({ length: nCols }, (_, c) => (
                  <option key={c} value={c}>
                    列{c + 1}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>

        {duplicates.size > 0 && (
          <p className="error-text">同じ列が複数の役割に割り当てられています。</p>
        )}
        {braggRatio !== null && braggRatio > 0.1 && (
          <div className="warning-banner">
            ⚠ 2θ と d の関係が Bragg の式(Cu-Kα)と合いません(不一致 {(braggRatio * 100).toFixed(0)}%)。
            2θ 列と d 列の割り当てが逆になっていないか確認してください。
          </div>
        )}
        {braggRatio !== null && braggRatio <= 0.1 && (
          <p className="muted">✓ 2θ–d の整合チェック OK(Bragg の式と一致)</p>
        )}

        <div className="modal-actions">
          <button onClick={onCancel}>キャンセル</button>
          <button className="primary" disabled={!valid} onClick={() => onConfirm(mapping)}>
            この割り当てで確定
          </button>
        </div>
      </div>
    </div>
  );
}
