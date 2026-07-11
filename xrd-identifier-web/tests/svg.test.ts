import { describe, expect, it } from 'vitest';
import type { MhTrace, MtTrace } from '../src/core/types';
import { createInitialState } from '../src/state/appState';
import { buildDemoState } from '../src/core/demo';
import { makeXrdSvg } from '../src/plot/svg/xrdSvg';
import { makeMHSvg } from '../src/plot/svg/mhSvg';
import { makeMTSvg } from '../src/plot/svg/mtSvg';
import { markerSvg } from '../src/plot/svg/build';

describe('makeXrdSvg', () => {
  it('デモ状態から測定トレースと参照マーカーを描画する', () => {
    const state = buildDemoState(createInitialState());
    const svg = makeXrdSvg(state);
    expect(svg).toContain('<svg');
    expect((svg.match(/class="trace"/g) || []).length).toBe(6);
    expect(svg).toContain('xrdRefMarker');
    expect(svg).toContain('Intensity (arb. units)');
  });
  it('probe マーカーが probeX クラスで出力される', () => {
    const state = { ...buildDemoState(createInitialState()), probe: { angle: 30.463 } };
    const svg = makeXrdSvg(state);
    expect(svg).toContain('probeX');
    expect(svg).toContain('30.463°');
  });
});

describe('makeMHSvg / makeMTSvg', () => {
  const mh: MhTrace = {
    id: 'mh1',
    name: 'loop',
    rawName: 'loop.VSM',
    displayName: 'loop',
    visible: true,
    color: '#e11d48',
    mass: null,
    points: Array.from({ length: 200 }, (_, i) => ({ hOe: (i - 100) * 100, mEmu: Math.tanh((i - 100) / 20) })),
  };
  const mt: MtTrace = {
    id: 'mt1',
    name: 'mt',
    rawName: 'mt.VSM',
    displayName: 'mt',
    visible: true,
    color: '#2563eb',
    mass: null,
    points: Array.from({ length: 300 }, (_, i) => ({ temp: i * 2, mEmu: 1 / (1 + Math.exp((i * 2 - 380) / 12)), hOe: null })),
    adoptedTcList: [{ temp: 380, method: 'manual' }],
  };
  it('MH ループを描画する', () => {
    const state = { ...createInitialState(), mode: 'mh' as const, mhTraces: [mh] };
    const r = makeMHSvg(state);
    expect(r.svg).toContain('mhTrace');
    expect(r.meta.count).toBe(1);
  });
  it('MT 曲線と Tc 注釈を描画する', () => {
    const state = {
      ...createInitialState(),
      mode: 'mt' as const,
      mtTraces: [mt],
      settings: { ...createInitialState().settings, mtShowD1: true, mtShowD2: true },
    };
    const r = makeMTSvg(state);
    expect(r.svg).toContain('mtTrace');
    expect(r.svg).toContain('data-derivative="d1"');
    expect(r.svg).toContain('data-derivative="d2"');
    expect(r.svg).toContain('tcArrow');
    expect(r.svg).toContain('T');
    expect(r.svg).toContain('= 380°C');
  });
});

describe('markerSvg', () => {
  it('全マーカー形状が有効な SVG 断片を返す', () => {
    for (const m of [
      'triangle_down', 'triangle_up', 'triangle_left', 'triangle_right', 'circle', 'diamond',
      'square', 'cross', 'plus', 'star', 'star6', 'wedge_down', 'wedge_up', 'wedge_left', 'wedge_right',
    ]) {
      const out = markerSvg(10, 10, m, '#000', 5);
      expect(out).toMatch(/^<(circle|polygon|rect|g)/);
    }
  });
});
