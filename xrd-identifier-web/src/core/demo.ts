/** 内蔵デモデータ(QS 相 + 副相の合成パターン) */

import type { AppState, RefPhase, XrdTrace } from './types';
import { palette } from './types';
import { uniqueId } from './utils';
import { normalizeRef } from './project/schema';

export function buildDemoState(state: AppState): AppState {
  const xs: number[] = [];
  for (let x = 20; x <= 70.0001; x += 0.04) xs.push(x);
  const qsRef = [24.907, 25.51, 30.168, 30.463, 30.797, 35.656, 39.893, 53.751, 57.677, 62.681, 63.348];
  const qsI = [6, 10, 65, 100, 16, 70, 31, 61, 31, 35, 35];
  const qsAmp = [8, 12, 52, 100, 18, 65, 32, 58, 30, 34, 29];
  const minorRef = [28.6, 33.1, 36.9, 49.5, 54.8, 57.0];
  const minorI = [100, 80, 60, 40, 45, 35];
  const minorAmp = [8, 10, 7, 5, 6, 4];
  const gauss = (x: number, mu: number, a: number, w: number) => a * Math.exp(-0.5 * ((x - mu) / w) ** 2);
  const refs: RefPhase[] = [
    normalizeRef({
      name: 'BaSn0.9Fe5.47O11',
      rawName: 'BaSn0.9Fe5.47O11.txt',
      displayName: 'QS phase',
      visible: true,
      color: palette[0],
      peaks: qsRef.map((angle, i) => ({
        d: null,
        angle,
        intensity: qsI[i],
        iNorm: qsI[i],
        h: null,
        k: null,
        l: null,
        phase: 'QS phase',
      })),
    }),
    normalizeRef({
      name: 'Minor phase',
      rawName: 'minor_phase.txt',
      displayName: 'minor phase',
      visible: true,
      color: palette[1],
      peaks: minorRef.map((angle, i) => ({
        d: null,
        angle,
        intensity: minorI[i],
        iNorm: minorI[i],
        h: [1, 1, 2, 3, 2, 1][i],
        k: [0, 1, 0, 1, 2, 1][i],
        l: [0, 0, 1, 0, 0, 2][i],
        phase: 'minor phase',
      })),
    }),
  ];
  const refIds = refs.map((r) => r.id);
  const measured: XrdTrace[] = [-0.1, 0, 0.2, 0.5, -0.1, 0].map((val, i) => {
    const pts = xs.map((x) => {
      let y = 8 + 1.2 * Math.sin(x * 0.8 + i * 0.3);
      qsRef.forEach((mu, j) => {
        y += gauss(x, mu + (i - 2) * 0.012, qsAmp[j], 0.055 + 0.02 * (j % 3));
      });
      minorRef.forEach((mu, j) => {
        y += gauss(x, mu + (i - 2) * 0.01, minorAmp[j], 0.1);
      });
      y += (Math.random() - 0.5) * 1.1;
      return { x, y };
    });
    const name = `x = ${val}`;
    return {
      id: uniqueId('meas'),
      name: `demo_${i + 1}`,
      rawName: `sample_${i + 1}.xy`,
      displayName: name,
      comment: name,
      visible: true,
      points: pts,
      activeRefs: [...refIds],
    };
  });
  return { ...state, measured, refs };
}
