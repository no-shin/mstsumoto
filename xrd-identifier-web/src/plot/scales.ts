/** 軸スケールと目盛り計算(純関数。SVG コンポーネントから使用) */

export interface LinearScale {
  domain: [number, number];
  range: [number, number];
  scale: (v: number) => number;
}

export function linearScale(domain: [number, number], range: [number, number]): LinearScale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0);
  return { domain, range, scale: (v: number) => r0 + (v - d0) * k };
}

/** きりの良い目盛り値を返す(1/2/5 系列) */
export function niceTicks(min: number, max: number, targetCount = 8): number[] {
  if (!(max > min)) return [min];
  const rawStep = (max - min) / targetCount;
  const mag = 10 ** Math.floor(Math.log10(rawStep));
  const candidates = [1, 2, 5, 10].map((m) => m * mag);
  const step = candidates.find((c) => c >= rawStep) ?? candidates[3];
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 1e-9; v += step) {
    ticks.push(Number(v.toFixed(10)));
  }
  return ticks;
}
