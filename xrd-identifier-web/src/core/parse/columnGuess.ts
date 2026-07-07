/**
 * 参照ピーク表の列マッピング推定。
 * 推定結果はあくまで「初期値の提案」であり、UI(ColumnMappingDialog)で
 * 人間が必ず確認してから確定する設計。
 */

import type { ColumnMapping } from '../types';
import type { NumericTable } from './tokenize';

export interface ColumnGuess {
  mapping: ColumnMapping;
  /** ヘッダから確定的に読めたか(false なら要注意表示) */
  confident: boolean;
  /** 推定根拠(UI 表示用) */
  reason: string;
}

const EMPTY: ColumnMapping = { h: -1, k: -1, l: -1, intensity: -1, twoTheta: -1, d: -1 };

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/θ/g, 'theta')
    .replace(/２/g, '2')
    .replace(/[°()]/g, '')
    .replace(/deg/g, '');
}

/** ヘッダ行から列を割り当てる。割当できなければ null 部は -1 のまま */
function guessFromHeaders(headers: string[]): ColumnMapping {
  const m = { ...EMPTY };
  headers.forEach((raw, i) => {
    const t = normalizeHeader(raw);
    if (t === 'h') m.h = i;
    else if (t === 'k') m.k = i;
    else if (t === 'l') m.l = i;
    else if (['i', 'int', 'intensity', 'relint', 'i/i0', 'irel'].includes(t)) m.intensity = i;
    else if (t.includes('2theta') || ['2th', 'twotheta', '2t'].includes(t)) m.twoTheta = i;
    else if (t === 'd' || t.startsWith('d')) {
      if (m.d < 0) m.d = i;
    }
  });
  return m;
}

/** データ値から列を推定するヒューリスティック(ヘッダ無し用) */
function guessFromValues(table: NumericTable): ColumnMapping {
  const n = table.columnCount;
  const m = { ...EMPTY };
  // 2θ 候補: 5–180 の実数でばらつく列。d 候補: 0.5–15 の実数減少列。
  for (let c = 0; c < n; c++) {
    const vals = table.rows.filter((r) => c < r.length).map((r) => r[c]);
    if (vals.length === 0) continue;
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const allInt = vals.every((v) => Number.isInteger(v));
    if (m.twoTheta < 0 && !allInt && min >= 5 && max <= 180 && max - min > 5) m.twoTheta = c;
    else if (m.d < 0 && !allInt && min > 0.3 && max < 20) m.d = c;
    else if (m.intensity < 0 && min >= 0 && max > 20 && c !== m.twoTheta) m.intensity = c;
  }
  // 残りの整数列を h,k,l に前から割当(順序は不明なので必ず人間確認)
  const used = new Set([m.twoTheta, m.d, m.intensity]);
  const intCols: number[] = [];
  for (let c = 0; c < n; c++) {
    if (used.has(c)) continue;
    const vals = table.rows.filter((r) => c < r.length).map((r) => r[c]);
    if (vals.every((v) => Number.isInteger(v) && Math.abs(v) < 60)) intCols.push(c);
  }
  if (intCols.length >= 3) [m.h, m.k, m.l] = [intCols[0], intCols[1], intCols[2]];
  return m;
}

/** 列マッピングを推定する。UI での人間確認が前提。 */
export function guessColumnMapping(table: NumericTable): ColumnGuess {
  if (table.headers.length > 0) {
    const m = guessFromHeaders(table.headers);
    if (m.twoTheta >= 0 && m.intensity >= 0) {
      const confident = m.h >= 0 && m.k >= 0 && m.l >= 0;
      return {
        mapping: m,
        confident,
        reason: `ヘッダ行「${table.headers.join(' ')}」から推定しました。`,
      };
    }
  }
  const m = guessFromValues(table);
  return {
    mapping: m,
    confident: false,
    reason:
      'ヘッダが読めなかったため、値の範囲から推定しました。特に h/k/l の順序は必ず確認してください。',
  };
}

/**
 * Bragg の式による 2θ–d 整合チェック(Cu-Kα1 λ=1.5406 Å)。
 * d 列が指定されている場合、割当の取り違えを検出できる。
 * 戻り値: 不一致だった行の割合(0 なら整合)。
 */
export function braggMismatchRatio(
  table: NumericTable,
  mapping: ColumnMapping,
  wavelength = 1.5406,
): number | null {
  if (mapping.twoTheta < 0 || mapping.d < 0) return null;
  let checked = 0;
  let bad = 0;
  for (const row of table.rows) {
    if (mapping.twoTheta >= row.length || mapping.d >= row.length) continue;
    const twoTheta = row[mapping.twoTheta];
    const d = row[mapping.d];
    if (twoTheta <= 0 || twoTheta >= 180 || d <= 0) continue;
    const expected = wavelength / (2 * Math.sin(((twoTheta / 2) * Math.PI) / 180));
    checked += 1;
    if (Math.abs(expected - d) / d > 0.02) bad += 1;
  }
  return checked === 0 ? null : bad / checked;
}
