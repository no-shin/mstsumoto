/** バックグラウンド(ベースライン)推定: rolling minimum + 平滑化 */

import { savitzkyGolay } from './smooth';

/** スライディング最小値(サイズ size の窓)。単調キューで O(n)。 */
export function rollingMinimum(y: number[], size: number): number[] {
  const n = y.length;
  const half = Math.floor(size / 2);
  const out = new Array<number>(n);
  const deque: number[] = []; // インデックスの単調増加キュー(値は単調非減少)
  let right = 0;
  for (let i = 0; i < n; i++) {
    const windowEnd = Math.min(n - 1, i + half);
    while (right <= windowEnd) {
      while (deque.length > 0 && y[deque[deque.length - 1]] >= y[right]) deque.pop();
      deque.push(right);
      right += 1;
    }
    const windowStart = Math.max(0, i - half);
    while (deque.length > 0 && deque[0] < windowStart) deque.shift();
    out[i] = y[deque[0]];
  }
  return out;
}

/**
 * ベースライン推定。窓幅は 2θ で約 1.2°(旧実装と同等の考え方)。
 * 戻り値: [補正後(負値は0), ベースライン]
 */
export function estimateBaseline(
  twoTheta: number[],
  ySmoothed: number[],
): { corrected: number[]; baseline: number[] } {
  const n = ySmoothed.length;
  if (n < 7) {
    return { corrected: ySmoothed.slice(), baseline: new Array<number>(n).fill(0) };
  }
  const step = medianStep(twoTheta);
  let winPts = Math.max(51, Math.round(1.2 / Math.max(step, 1e-6)));
  winPts = Math.min(winPts, Math.max(3, Math.floor(n / 3)));
  let baseline = rollingMinimum(ySmoothed, winPts);
  const smoothWin = Math.max(11, Math.floor(winPts / 5)) | 1;
  baseline = savitzkyGolay(baseline, smoothWin);
  const corrected = ySmoothed.map((v, i) => Math.max(0, v - baseline[i]));
  return { corrected, baseline };
}

export function medianStep(x: number[]): number {
  if (x.length < 3) return 0.02;
  const diffs = [];
  for (let i = 1; i < x.length; i++) diffs.push(x[i] - x[i - 1]);
  diffs.sort((a, b) => a - b);
  return diffs[Math.floor(diffs.length / 2)];
}
