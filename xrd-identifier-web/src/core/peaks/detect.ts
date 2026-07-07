/**
 * ピーク検出。scipy.signal.find_peaks 相当の最小実装
 * (局所極大 → prominence 計算 → 最小間隔フィルタ → 半値幅計算)。
 */

import type { AnalysisParams, MeasuredPattern, MeasuredPeak } from '../types';
import { estimateBaseline, medianStep } from './baseline';
import { savitzkyGolay } from './smooth';

/** 局所極大のインデックス(プラトーは中央) */
function localMaxima(y: number[]): number[] {
  const idx: number[] = [];
  let i = 1;
  const n = y.length;
  while (i < n - 1) {
    if (y[i] > y[i - 1]) {
      let j = i;
      while (j < n - 1 && y[j + 1] === y[i]) j += 1;
      if (j < n - 1 && y[j + 1] < y[i]) {
        idx.push(Math.floor((i + j) / 2));
        i = j + 1;
        continue;
      }
      i = j + 1;
    } else {
      i += 1;
    }
  }
  return idx;
}

/** scipy 方式の prominence: 左右で「より高い点に出会うまで」の区間最小値のうち高い方との差 */
function prominences(y: number[], peaks: number[]): number[] {
  return peaks.map((p) => {
    let leftMin = y[p];
    for (let i = p - 1; i >= 0; i--) {
      if (y[i] > y[p]) break;
      if (y[i] < leftMin) leftMin = y[i];
    }
    let rightMin = y[p];
    for (let i = p + 1; i < y.length; i++) {
      if (y[i] > y[p]) break;
      if (y[i] < rightMin) rightMin = y[i];
    }
    return y[p] - Math.max(leftMin, rightMin);
  });
}

/** 最小間隔フィルタ: prominence の高い順に採用し、近すぎるものを除外 */
function enforceDistance(peaks: number[], proms: number[], minDistancePts: number): number[] {
  const order = peaks
    .map((_, i) => i)
    .sort((a, b) => proms[b] - proms[a]);
  const keep = new Array<boolean>(peaks.length).fill(true);
  for (const i of order) {
    if (!keep[i]) continue;
    for (let j = 0; j < peaks.length; j++) {
      if (j !== i && keep[j] && Math.abs(peaks[j] - peaks[i]) < minDistancePts && proms[j] <= proms[i]) {
        keep[j] = false;
      }
    }
  }
  return peaks.map((_, i) => i).filter((i) => keep[i]);
}

/** 半値(ピーク高さ - prominence/2)での幅を線形補間で求める(deg) */
function fwhmAt(x: number[], y: number[], peak: number, prom: number): number {
  const half = y[peak] - prom / 2;
  let left = x[peak];
  for (let i = peak - 1; i >= 0; i--) {
    if (y[i] <= half) {
      const t = (y[i + 1] - half) / (y[i + 1] - y[i]);
      left = x[i + 1] + t * (x[i] - x[i + 1]);
      break;
    }
    left = x[i];
  }
  let right = x[peak];
  for (let i = peak + 1; i < y.length; i++) {
    if (y[i] <= half) {
      const t = (y[i - 1] - half) / (y[i - 1] - y[i]);
      right = x[i - 1] + t * (x[i] - x[i - 1]);
      break;
    }
    right = x[i];
  }
  return Math.max(0, right - left);
}

/**
 * 測定パターンからピークを検出する。
 * 自動 prominence はスケール非依存: 補正後データのダイナミックレンジの 3%。
 */
export function detectPeaks(pattern: MeasuredPattern, params: AnalysisParams): MeasuredPeak[] {
  const { twoTheta: x, intensity: yRaw } = pattern;
  if (x.length < 7) return [];

  const ySmooth = params.smoothing ? savitzkyGolay(yRaw) : yRaw.slice();
  const { corrected } = params.baselineCorrection
    ? estimateBaseline(x, ySmooth)
    : { corrected: ySmooth };

  let minProm = params.prominence ?? Number.NaN;
  if (!Number.isFinite(minProm) || minProm <= 0) {
    const maxV = Math.max(...corrected);
    const sorted = corrected.slice().sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    // 3% だと強ピークの肩(重畳ピーク)を落とすため 1.5% とする
    minProm = Math.max((maxV - median) * 0.015, 1e-12);
  }

  const step = medianStep(x);
  const minDistPts = Math.max(1, Math.round(params.minDistanceDeg / Math.max(step, 1e-6)));

  const maxima = localMaxima(corrected);
  const proms = prominences(corrected, maxima);
  const strong = maxima
    .map((p, i) => ({ p, prom: proms[i] }))
    .filter(({ prom }) => prom >= minProm);
  const keptIdx = enforceDistance(
    strong.map((s) => s.p),
    strong.map((s) => s.prom),
    minDistPts,
  );

  const peaks: MeasuredPeak[] = keptIdx.map((i) => {
    const p = strong[i].p;
    const prom = strong[i].prom;
    return {
      twoTheta: x[p],
      intensity: corrected[p],
      rawIntensity: yRaw[p],
      prominence: prom,
      fwhm: fwhmAt(x, corrected, p, prom),
    };
  });
  peaks.sort((a, b) => a.twoTheta - b.twoTheta);
  return peaks;
}

/** UI 表示用にベースライン等の中間結果も返す版 */
export function processPattern(pattern: MeasuredPattern, params: AnalysisParams) {
  const ySmooth = params.smoothing ? savitzkyGolay(pattern.intensity) : pattern.intensity.slice();
  const { corrected, baseline } = params.baselineCorrection
    ? estimateBaseline(pattern.twoTheta, ySmooth)
    : { corrected: ySmooth, baseline: new Array<number>(ySmooth.length).fill(0) };
  return { smoothed: ySmooth, corrected, baseline };
}
