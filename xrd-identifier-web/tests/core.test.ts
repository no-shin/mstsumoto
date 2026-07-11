import { describe, expect, it } from 'vitest';
import type { AppState, MhTrace, MtTrace } from '../src/core/types';
import { createInitialState } from '../src/state/appState';
import { detectPeaks, localMaxNear, observedMarkerSupport } from '../src/core/peaks/detect';
import { localPolynomialSmoothPoints, solveLinearSystem } from '../src/core/peaks/smooth';
import { solveHexLattice } from '../src/core/xrd/lattice';
import type { AlignmentRow } from '../src/core/xrd/lattice';
import { analyzeMHTrace } from '../src/core/mh/analysis';
import { mtDerivatives } from '../src/core/mt/derivative';
import { mtTcCandidates } from '../src/core/mt/tc';
import { richSpans, greekText } from '../src/core/text/richText';
import { buildDemoState } from '../src/core/demo';
import { analyze } from '../src/core/xrd/identify';
import { exportProjectJson, importProjectJson } from '../src/core/project/schema';
import { storeReducer, createStore } from '../src/state/history';

function gaussProfile(mu: number, amp = 100, width = 0.06) {
  const pts = [];
  for (let x = 20; x <= 70; x += 0.02) {
    pts.push({ x, y: amp * Math.exp(-0.5 * ((x - mu) / width) ** 2) + 1 });
  }
  return pts;
}

describe('peaks', () => {
  it('detectPeaks がガウスピークを検出する', () => {
    const peaks = detectPeaks(gaussProfile(30.5), 20, 70, 7, 0.18);
    expect(peaks).toHaveLength(1);
    expect(peaks[0].x).toBeCloseTo(30.5, 1);
  });
  it('localMaxNear / observedMarkerSupport', () => {
    const profile = gaussProfile(30.5);
    expect(localMaxNear(profile, 30.5, 0.3, 5)?.x).toBeCloseTo(30.5, 1);
    expect(localMaxNear(profile, 45, 0.3, 5)).toBeNull();
    expect(observedMarkerSupport(profile, 30.55, 0.35, 2, 1, true)).not.toBeNull();
  });
});

describe('smooth', () => {
  it('solveLinearSystem が連立方程式を解く', () => {
    const sol = solveLinearSystem(
      [
        [2, 1],
        [1, 3],
      ],
      [5, 10],
    );
    expect(sol![0]).toBeCloseTo(1);
    expect(sol![1]).toBeCloseTo(3);
  });
  it('localPolynomialSmoothPoints は直線を保存する', () => {
    const pts = Array.from({ length: 50 }, (_, i) => ({ x: i, y: 2 * i + 1 }));
    const sm = localPolynomialSmoothPoints(pts, 9, 2);
    expect(sm[25].y).toBeCloseTo(51, 5);
  });
});

describe('solveHexLattice', () => {
  it('既知の六方晶 a, c を復元する', () => {
    const a = 5.9;
    const c = 23.2;
    const rows = [
      { h: 1, k: 0, l: 0 },
      { h: 1, k: 1, l: 0 },
      { h: 0, k: 0, l: 4 },
      { h: 1, k: 0, l: 4 },
      { h: 2, k: 0, l: 3 },
    ].map((hkl, i) => {
      const inv = (4 / 3) * ((hkl.h * hkl.h + hkl.h * hkl.k + hkl.k * hkl.k) / (a * a)) + (hkl.l * hkl.l) / (c * c);
      return {
        key: String(i),
        referenceName: 'test',
        originalTwoTheta: 0,
        correctedTwoTheta: 0,
        matchedMeasuredPeakTwoTheta: 0,
        ...hkl,
        d: null,
        intensity: 1,
        use: true,
        dObs: 1 / Math.sqrt(inv),
      } as AlignmentRow;
    });
    const fit = solveHexLattice(rows);
    expect(fit.ok).toBe(true);
    expect(fit.a).toBeCloseTo(a, 4);
    expect(fit.c).toBeCloseTo(c, 4);
  });
});

describe('MH analysis', () => {
  it('理想ループの Hc / Mr / Ms を推定する', () => {
    const points = [];
    for (let h = -10000; h <= 10000; h += 100) points.push({ hOe: h, mEmu: Math.tanh((h + 1000) / 2000) });
    for (let h = 10000; h >= -10000; h -= 100) points.push({ hOe: h, mEmu: Math.tanh((h - 1000) / 2000) });
    const trace: MhTrace = {
      id: 'mh1',
      name: 't',
      rawName: 't.VSM',
      displayName: 't',
      visible: true,
      color: '#000',
      mass: null,
      points,
    };
    const r = analyzeMHTrace(trace, { mhMassMode: 'raw', mhSmooth: '0', mhPointStep: '1' })!;
    expect(r.hcMean).toBeCloseTo(1, 1); // kOe
    expect(r.ms).toBeGreaterThan(0.9);
    expect(r.mrMs).toBeGreaterThan(0.3);
  });
});

describe('MT derivative / Tc', () => {
  const mkTrace = (): MtTrace => {
    const points = [];
    for (let t = 0; t <= 600; t += 2) points.push({ temp: t, mEmu: 1 / (1 + Math.exp((t - 380) / 12)), hOe: null });
    return {
      id: 'mt1',
      name: 't',
      rawName: 't.VSM',
      displayName: 't',
      visible: true,
      color: '#000',
      mass: null,
      points,
      adoptedTcList: [],
    };
  };
  const settings = {
    mtMassMode: 'raw',
    mtManualMass: '0.02',
    mtSmooth: '5',
    mtPointStep: '1',
    mtDerivativeSmooth: '21',
    mtD2PreSmooth: '11',
    mtTcMin: '50',
    mtTcMax: '550',
    mtTcCandidateCount: '3',
  };
  it('dM/dT の最小が転移温度付近になる', () => {
    const d = mtDerivatives(mkTrace(), settings);
    const min = d.d1.reduce((a, b) => (a.y < b.y ? a : b));
    expect(min.x).toBeGreaterThan(360);
    expect(min.x).toBeLessThan(400);
  });
  it('Tc 候補が転移温度付近を含む', () => {
    const cands = mtTcCandidates(mkTrace(), settings);
    expect(cands.length).toBeGreaterThan(0);
    expect(cands.some((c) => Math.abs(c.temp - 380) < 30)).toBe(true);
  });
});

describe('richText', () => {
  it('\\theta をギリシャ文字へ変換する', () => {
    expect(greekText('\\theta test')).toBe('θ test');
  });
  it('T_C と Fe^{3+} を上付き/下付きへ分解する', () => {
    expect(richSpans('T_C')).toEqual([
      { text: 'T', mode: 'normal' },
      { text: 'C', mode: 'sub' },
    ]);
    expect(richSpans('Fe^{3+}')).toEqual([
      { text: 'Fe', mode: 'normal' },
      { text: '3+', mode: 'sup' },
    ]);
    expect(richSpans('900C_milled')).toEqual([{ text: '900C_milled', mode: 'normal' }]);
  });
});

describe('identify (demo data)', () => {
  it('デモデータで QS phase が最上位候補になる', () => {
    const state = buildDemoState(createInitialState());
    const analyses = analyze(state);
    expect(analyses).toHaveLength(6);
    const top = analyses[0].candidates[0];
    expect(top.phase).toBe('QS phase');
    expect(top.score).toBeGreaterThan(50);
  });
});

describe('project schema round-trip', () => {
  it('保存 → 読込で主要 state が保たれる', () => {
    const state: AppState = {
      ...buildDemoState(createInitialState()),
      mode: 'mt',
      xrdZoomView: { xMin: 25, xMax: 40, yMin: 0, yMax: 200 },
      mtTcAnnotations: { 'a:1': { x: 10, y: 20 } },
    };
    const json = exportProjectJson(state);
    const restored = importProjectJson(json, createInitialState());
    expect(restored.mode).toBe('mt');
    expect(restored.measured).toHaveLength(6);
    expect(restored.refs.map((r) => r.displayName)).toEqual(state.refs.map((r) => r.displayName));
    expect(restored.xrdZoomView).toEqual(state.xrdZoomView);
    expect(restored.mtTcAnnotations).toEqual(state.mtTcAnnotations);
    expect(restored.settings.xMin).toBe(state.settings.xMin);
  });
});

describe('undo/redo history', () => {
  it('update(record) → undo → redo', () => {
    const s0 = createInitialState();
    let store = createStore(s0);
    store = storeReducer(store, { type: 'update', recipe: (s) => ({ ...s, mode: 'mh' }), record: true });
    expect(store.present.mode).toBe('mh');
    store = storeReducer(store, { type: 'undo' });
    expect(store.present.mode).toBe('xrd');
    store = storeReducer(store, { type: 'redo' });
    expect(store.present.mode).toBe('mh');
  });
  it('editBegin は最初の編集だけ undo ポイントを積む', () => {
    const s0 = createInitialState();
    let store = createStore(s0);
    store = storeReducer(store, { type: 'editBegin' });
    store = storeReducer(store, {
      type: 'update',
      recipe: (s) => ({ ...s, settings: { ...s.settings, xMin: '25' } }),
      record: 'edit',
    });
    store = storeReducer(store, {
      type: 'update',
      recipe: (s) => ({ ...s, settings: { ...s.settings, xMin: '30' } }),
      record: 'edit',
    });
    expect(store.past).toHaveLength(1);
    store = storeReducer(store, { type: 'undo' });
    expect(store.present.settings.xMin).toBe('20');
  });
});
