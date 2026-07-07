/** 参照ピーク表のパース(確定済み列マッピングを適用し、強度を max=100 に正規化) */

import type { ColumnMapping, RefPeak } from '../types';
import type { NumericTable } from './tokenize';

export function buildReferencePeaks(table: NumericTable, mapping: ColumnMapping): RefPeak[] {
  if (mapping.twoTheta < 0 || mapping.intensity < 0) {
    throw new Error('2θ 列と強度列の指定は必須です。');
  }
  const raw: RefPeak[] = [];
  for (const row of table.rows) {
    const get = (col: number): number | null =>
      col >= 0 && col < row.length ? row[col] : null;
    const twoTheta = get(mapping.twoTheta);
    const intensity = get(mapping.intensity);
    if (twoTheta === null || intensity === null || twoTheta <= 0 || twoTheta >= 180) continue;
    raw.push({
      h: Math.round(get(mapping.h) ?? 0),
      k: Math.round(get(mapping.k) ?? 0),
      l: Math.round(get(mapping.l) ?? 0),
      intensity,
      twoTheta,
      d: get(mapping.d),
    });
  }
  if (raw.length === 0) {
    throw new Error('有効な参照ピークが1本もありません。列指定を確認してください。');
  }
  // スケール依存の閾値バグを避けるため、相対強度は常に max=100 に正規化する。
  const maxI = Math.max(...raw.map((p) => p.intensity));
  const scale = maxI > 0 ? 100 / maxI : 1;
  const peaks = raw.map((p) => ({ ...p, intensity: p.intensity * scale }));
  peaks.sort((a, b) => a.twoTheta - b.twoTheta);
  return peaks;
}

/** ファイル名から相名と PDF 番号を推定する(例: "M-type BaFe12O19 PDF 00-039-1433.txt") */
export function phaseNameFromFileName(fileName: string): { phaseName: string; pdfId: string } {
  const stem = fileName.replace(/\.[^.]+$/, '');
  const pdfMatch = /PDF[\s_-]*([0-9]{2}-[0-9]{3}-[0-9]{4})/i.exec(stem);
  const pdfId = pdfMatch ? pdfMatch[1] : '';
  let phase = stem.replace(/[\s_-]*PDF[\s_-]*[0-9]{2}-[0-9]{3}-[0-9]{4}.*$/i, '').trim();
  phase = phase.replace(/\s*\(\d+\)$/, '').trim();
  return { phaseName: phase || stem, pdfId };
}

/** 化学式らしき文字列から元素記号を抽出する(組成候補判定の初期値提案用) */
export function elementsFromText(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(/[A-Z][a-z]?/g)) {
    if (KNOWN_ELEMENTS.has(m[0])) found.add(m[0]);
  }
  return [...found];
}

const KNOWN_ELEMENTS = new Set([
  'H', 'He', 'Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne', 'Na', 'Mg', 'Al', 'Si', 'P', 'S',
  'Cl', 'Ar', 'K', 'Ca', 'Sc', 'Ti', 'V', 'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn', 'Ga',
  'Ge', 'As', 'Se', 'Br', 'Kr', 'Rb', 'Sr', 'Y', 'Zr', 'Nb', 'Mo', 'Ru', 'Rh', 'Pd', 'Ag',
  'Cd', 'In', 'Sn', 'Sb', 'Te', 'I', 'Xe', 'Cs', 'Ba', 'La', 'Ce', 'Pr', 'Nd', 'Sm', 'Eu',
  'Gd', 'Tb', 'Dy', 'Ho', 'Er', 'Tm', 'Yb', 'Lu', 'Hf', 'Ta', 'W', 'Re', 'Os', 'Ir', 'Pt',
  'Au', 'Hg', 'Tl', 'Pb', 'Bi',
]);
