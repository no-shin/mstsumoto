import { describe, expect, it } from 'vitest';
import { parseMeasured } from '../src/core/parse/xrd';
import { parseReference } from '../src/core/parse/refPeaks';
import { parseMH } from '../src/core/parse/vsmMh';
import { parseMT } from '../src/core/parse/vsmMt';
import { buildBuiltinRefs } from '../src/core/refs/builtin';

describe('parseMeasured', () => {
  it('2列の数値表を読み、xでソートする', () => {
    const tr = parseMeasured('# comment\n30.0 120\n20.0, 100\n25.0\t110\n', 'sample.xy');
    expect(tr.points.map((p) => p.x)).toEqual([20, 25, 30]);
    expect(tr.displayName).toBe('sample');
  });
});

describe('parseReference', () => {
  it('l k h I 2θ d ヘッダ形式を読む', () => {
    const ref = parseReference('l k h I 2θ d\n0 1 1 13 32.509 2.75201\n2 0 0 37 35.418 2.53236\n', 'CuO.txt');
    expect(ref.peaks).toHaveLength(2);
    expect(ref.peaks[0].angle).toBeCloseTo(32.509);
    expect(ref.peaks[0].h).toBe(1); // ヘッダ順 l k h
    expect(ref.peaks[0].l).toBe(0);
    expect(ref.peaks[1].iNorm).toBeCloseTo(100);
  });

  it('d 2θ I fix h k l 形式を読む', () => {
    const ref = parseReference('d 2θ I fix h k l\n 2.96000 30.168 65 1 1 0\n 2.93200 30.463 100 1 0 4\n', 'QS.txt');
    expect(ref.peaks).toHaveLength(2);
    expect(ref.peaks[1].angle).toBeCloseTo(30.463);
    expect(ref.peaks[1].h).toBe(1);
    expect(ref.peaks[1].l).toBe(4);
  });
});

describe('buildBuiltinRefs', () => {
  it('内蔵参照13相をすべてパースできる', () => {
    const refs = buildBuiltinRefs();
    expect(refs).toHaveLength(13);
    for (const r of refs) expect(r.peaks.length).toBeGreaterThan(5);
    const qs = refs.find((r) => r.displayName === 'QS-type');
    expect(qs).toBeDefined();
    const main = qs!.peaks.reduce((a, b) => (a.iNorm >= b.iNorm ? a : b));
    expect(main.angle).toBeCloseTo(30.463);
  });
});

describe('parseMH', () => {
  it('sample weight と H/M 列を読む', () => {
    const text = 'sample name,foo\nsample weight,0.0213\nH(Oe),M(emu)\n-1000,-0.5\n0,0.01\n1000,0.5\n';
    const tr = parseMH(text, 'a.VSM');
    expect(tr.name).toBe('foo');
    expect(tr.mass).toBeCloseTo(0.0213);
    expect(tr.points).toHaveLength(3);
    expect(tr.points[0].hOe).toBe(-1000);
  });

  it('ヘッダなし数値表は kOe を Oe へ換算する', () => {
    const tr = parseMH('-10 -0.5\n0 0\n10 0.5\n', 'b.txt');
    expect(tr.points[0].hOe).toBe(-10000);
  });
});

describe('parseMT', () => {
  it('Temp./M 列を読み、温度でソートする', () => {
    const text = 'sample weight,0.02\nTemp.,H(Oe),M(emu)\n300,1000,0.5\n100,1000,0.9\n200,1000,0.7\n';
    const tr = parseMT(text, 'c.VSM');
    expect(tr.points.map((p) => p.temp)).toEqual([100, 200, 300]);
    expect(tr.mass).toBeCloseTo(0.02);
  });
});
