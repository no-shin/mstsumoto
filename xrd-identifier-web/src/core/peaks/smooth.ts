/** Savitzky-Golay 平滑化(2次多項式)。scipy.signal.savgol_filter 相当の最小実装 */

/**
 * 2次 Savitzky-Golay の畳み込み係数。
 * 対称窓での閉形式: c_i = (3(3m^2 + 3m - 1) - 15 i^2) / ((2m+3)(2m+1)(2m-1)) * 3 …
 * を使わず、明示的に最小二乗の正規方程式から求める(窓長変更に強い)。
 */
function savgolCoefficients(halfWidth: number): number[] {
  const m = halfWidth;
  // 中心値の推定は 0 次項のみなので、係数は (A^T A)^-1 A^T の第1行。
  // A の列: [1, i, i^2]
  let s0 = 0;
  let s2 = 0;
  let s4 = 0;
  for (let i = -m; i <= m; i++) {
    s0 += 1;
    s2 += i * i;
    s4 += i * i * i * i;
  }
  // (A^T A) = [[s0,0,s2],[0,s2,0],[s2,0,s4]] の逆行列第1行 = [a, 0, b]
  const det = s0 * s4 - s2 * s2;
  const a = s4 / det;
  const b = -s2 / det;
  const coeffs: number[] = [];
  for (let i = -m; i <= m; i++) coeffs.push(a + b * i * i);
  return coeffs;
}

/**
 * Savitzky-Golay 平滑化。windowPoints は奇数に丸められ、端は元値を使う。
 * データ長が窓より短い場合はコピーを返す。
 */
export function savitzkyGolay(y: number[], windowPoints = 21): number[] {
  const n = y.length;
  let win = Math.min(windowPoints, n % 2 === 1 ? n : n - 1);
  if (win % 2 === 0) win -= 1;
  if (win < 5) return y.slice();
  const m = (win - 1) / 2;
  const c = savgolCoefficients(m);
  const out = y.slice();
  for (let i = m; i < n - m; i++) {
    let acc = 0;
    for (let j = -m; j <= m; j++) acc += c[j + m] * y[i + j];
    out[i] = acc;
  }
  return out;
}
