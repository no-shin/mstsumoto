/** 測定 XRD データ(2θ–強度)のパース */

import type { MeasuredPattern } from '../types';
import { parseNumericTable, type NumericTable } from './tokenize';

export interface MeasurementPreview {
  table: NumericTable;
  /** 推定した 2θ 列 / 強度列(UI で人間が確定する) */
  suggestedTwoThetaCol: number;
  suggestedIntensityCol: number;
  /** 列が 3 つ以上あり人間の確認が必要か */
  needsColumnConfirmation: boolean;
}

/** パース第1段: 表を読み、列の推定だけして返す(確定は UI 側) */
export function previewMeasurement(text: string): MeasurementPreview {
  const table = parseNumericTable(text);
  if (table.rows.length === 0) {
    throw new Error('数値データ行が見つかりません。ファイル形式を確認してください。');
  }
  if (table.columnCount < 2) {
    throw new Error('測定データには少なくとも2列(2θ, 強度)が必要です。');
  }
  // 2θ 列の推定: 単調増加かつ 5–180 の範囲に収まる列を優先。既定は 0 列目。
  let twoThetaCol = 0;
  for (let c = 0; c < table.columnCount; c++) {
    const vals = columnValues(table, c);
    if (isMonotonicIncreasing(vals) && vals[0] >= 0 && vals[vals.length - 1] <= 180) {
      twoThetaCol = c;
      break;
    }
  }
  const intensityCol = twoThetaCol === 0 ? 1 : 0;
  return {
    table,
    suggestedTwoThetaCol: twoThetaCol,
    suggestedIntensityCol: intensityCol,
    needsColumnConfirmation: table.columnCount > 2,
  };
}

/** パース第2段: 列を確定して MeasuredPattern を作る */
export function buildMeasurement(
  table: NumericTable,
  twoThetaCol: number,
  intensityCol: number,
  sampleName: string,
): MeasuredPattern {
  const pairs: Array<[number, number]> = [];
  for (const row of table.rows) {
    if (twoThetaCol < row.length && intensityCol < row.length) {
      pairs.push([row[twoThetaCol], row[intensityCol]]);
    }
  }
  if (pairs.length < 10) {
    throw new Error('有効なデータ点が少なすぎます(10点未満)。列指定を確認してください。');
  }
  pairs.sort((a, b) => a[0] - b[0]);
  return {
    sampleName,
    twoTheta: pairs.map((p) => p[0]),
    intensity: pairs.map((p) => p[1]),
  };
}

/** ファイル名から試料名を取る(拡張子除去) */
export function sampleNameFromFileName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '');
}

function columnValues(table: NumericTable, col: number): number[] {
  return table.rows.filter((r) => col < r.length).map((r) => r[col]);
}

function isMonotonicIncreasing(vals: number[]): boolean {
  if (vals.length < 2) return false;
  for (let i = 1; i < vals.length; i++) {
    if (vals[i] <= vals[i - 1]) return false;
  }
  return true;
}
