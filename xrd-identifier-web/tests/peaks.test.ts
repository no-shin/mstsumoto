import { describe, expect, it } from 'vitest';
import { savitzkyGolay } from '../src/core/peaks/smooth';
import { rollingMinimum } from '../src/core/peaks/baseline';
import { detectPeaks } from '../src/core/peaks/detect';
import { DEFAULT_PARAMS, type MeasuredPattern } from '../src/core/types';

/** ガウスピーク合成パターン生成 */
function synthetic(
  peaks: Array<{ pos: number; height: number; sigma?: number }>,
  noise = 0,
  background = (x: number) => 50 + x,
): MeasuredPattern {
  const twoTheta: number[] = [];
  const intensity: number[] = [];
  let seed = 42;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2 ** 31;
    return seed / 2 ** 31 - 0.5;
  };
  for (let x = 10; x <= 80; x += 0.02) {
    let y = background(x) + noise * rand();
    for (const p of peaks) {
      const s = p.sigma ?? 0.06;
      y += p.height * Math.exp(-((x - p.pos) ** 2) / (2 * s * s));
    }
    twoTheta.push(x);
    intensity.push(y);
  }
  return { sampleName: 'synthetic', twoTheta, intensity };
}

describe('savitzkyGolay', () => {
  it('preserves a constant signal', () => {
    const y = new Array(100).fill(7);
    expect(savitzkyGolay(y).every((v) => Math.abs(v - 7) < 1e-9)).toBe(true);
  });
  it('preserves a linear ramp (polynomial order 2)', () => {
    const y = Array.from({ length: 100 }, (_, i) => 2 * i + 3);
    const s = savitzkyGolay(y, 11);
    for (let i = 10; i < 90; i++) expect(s[i]).toBeCloseTo(y[i], 6);
  });
  it('returns copy for tiny input', () => {
    expect(savitzkyGolay([1, 2, 3])).toEqual([1, 2, 3]);
  });
});

describe('rollingMinimum', () => {
  it('matches naive implementation', () => {
    const y = [5, 3, 8, 1, 9, 2, 7, 4, 6, 0];
    const size = 3;
    const out = rollingMinimum(y, size);
    const half = Math.floor(size / 2);
    y.forEach((_, i) => {
      const lo = Math.max(0, i - half);
      const hi = Math.min(y.length - 1, i + half);
      expect(out[i]).toBe(Math.min(...y.slice(lo, hi + 1)));
    });
  });
});

describe('detectPeaks', () => {
  it('finds synthetic peaks at correct positions with fwhm', () => {
    const truth = [
      { pos: 25.0, height: 3000 },
      { pos: 32.15, height: 8000 },
      { pos: 34.1, height: 6000 },
      { pos: 55.5, height: 1500 },
    ];
    const pattern = synthetic(truth, 30);
    const found = detectPeaks(pattern, DEFAULT_PARAMS);
    for (const t of truth) {
      const hit = found.find((p) => Math.abs(p.twoTheta - t.pos) < 0.05);
      expect(hit, `peak at ${t.pos}`).toBeDefined();
      // ガウス σ=0.06 → FWHM ≈ 0.141
      expect(hit!.fwhm).toBeGreaterThan(0.08);
      expect(hit!.fwhm).toBeLessThan(0.3);
    }
  });

  it('auto prominence is scale-independent (normalized data still works)', () => {
    const pattern = synthetic([{ pos: 30, height: 5000 }, { pos: 45, height: 2500 }]);
    const maxI = Math.max(...pattern.intensity);
    const normalized: MeasuredPattern = {
      ...pattern,
      intensity: pattern.intensity.map((v) => v / maxI), // max=1 のデータ
    };
    const found = detectPeaks(normalized, DEFAULT_PARAMS);
    expect(found.some((p) => Math.abs(p.twoTheta - 30) < 0.05)).toBe(true);
    expect(found.some((p) => Math.abs(p.twoTheta - 45) < 0.05)).toBe(true);
  });

  it('respects minimum peak distance', () => {
    const pattern = synthetic([
      { pos: 30.0, height: 5000 },
      { pos: 30.05, height: 3000 }, // 0.15° 未満 → 統合されるべき
    ]);
    const found = detectPeaks(pattern, DEFAULT_PARAMS);
    const near30 = found.filter((p) => Math.abs(p.twoTheta - 30.02) < 0.2);
    expect(near30.length).toBe(1);
  });

  it('reports baseline-corrected intensity, not raw', () => {
    const pattern = synthetic([{ pos: 40, height: 1000 }], 0, (x) => 5000 - 30 * x);
    const found = detectPeaks(pattern, DEFAULT_PARAMS);
    const hit = found.find((p) => Math.abs(p.twoTheta - 40) < 0.05)!;
    expect(hit).toBeDefined();
    expect(hit.intensity).toBeLessThan(2000); // 補正後はほぼピーク高さのみ
    expect(hit.rawIntensity).toBeGreaterThan(4000); // 生値は背景込み
  });
});
