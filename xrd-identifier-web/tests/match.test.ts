import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assignMatches } from '../src/core/match/assign';
import { orientationAllows } from '../src/core/match/orientation';
import { compositionScore, parseElementsInput } from '../src/core/candidates/composition';
import { analyze } from '../src/core/analyze';
import { parseNumericTable } from '../src/core/parse/tokenize';
import { previewMeasurement, buildMeasurement } from '../src/core/parse/measurement';
import { guessColumnMapping } from '../src/core/parse/columnGuess';
import { buildReferencePeaks } from '../src/core/parse/reference';
import {
  DEFAULT_PARAMS,
  type MeasuredPeak,
  type ReferencePhase,
  type RefPeak,
} from '../src/core/types';

function obs(twoTheta: number, intensity = 100): MeasuredPeak {
  return { twoTheta, intensity, rawIntensity: intensity, prominence: intensity, fwhm: 0.1 };
}
function ref(twoTheta: number, intensity = 100, h = 1, k = 0, l = 0): RefPeak {
  return { twoTheta, intensity, h, k, l, d: null };
}

describe('assignMatches (1対1割り当て)', () => {
  it('does not let one observed peak explain multiple reference peaks', () => {
    // 観測 1 本の近くに参照 3 本 → マッチは 1 件だけになるべき(旧実装は 3 件)
    const matches = assignMatches(
      [ref(30.0, 100), ref(30.1, 80), ref(30.2, 60)],
      [obs(30.05)],
      0,
      0.25,
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].refTwoTheta).toBe(30.0); // 最強の参照ピークが優先
  });

  it('assigns nearest available peak within tolerance', () => {
    const matches = assignMatches(
      [ref(30.0, 100), ref(31.0, 90)],
      [obs(30.05), obs(31.02)],
      0,
      0.25,
    );
    expect(matches).toHaveLength(2);
  });

  it('applies zero shift', () => {
    const matches = assignMatches([ref(30.0)], [obs(30.2)], 0.2, 0.05);
    expect(matches).toHaveLength(1);
    expect(matches[0].diff).toBeCloseTo(0, 6);
  });
});

describe('orientation', () => {
  it('handles standard modes', () => {
    expect(orientationAllows(0, 0, 8, { mode: '00l' })).toBe(true);
    expect(orientationAllows(1, 0, 8, { mode: '00l' })).toBe(false);
    expect(orientationAllows(2, 1, 0, { mode: 'hk0' })).toBe(true);
  });
  it('handles custom rule', () => {
    const setting = {
      mode: 'custom' as const,
      custom: { h: 'zero' as const, k: 'any' as const, l: 'nonzero' as const },
    };
    expect(orientationAllows(0, 3, 2, setting)).toBe(true);
    expect(orientationAllows(1, 3, 2, setting)).toBe(false);
  });
});

describe('composition', () => {
  it('parses element input in several formats', () => {
    expect(parseElementsInput('Ba, Cu, Fe').sort()).toEqual(['Ba', 'Cu', 'Fe']);
    expect(parseElementsInput('Ba3Cu2Fe24O41').sort()).toEqual(['Ba', 'Cu', 'Fe', 'O']);
  });
  it('scores subset phases high, foreign-element phases low', () => {
    const sample = ['Ba', 'Cu', 'Fe', 'O'];
    expect(compositionScore(sample, ['Ba', 'Fe', 'O'])).toBe(1);
    expect(compositionScore(sample, ['Sn', 'O'])).toBe(0);
    expect(compositionScore([], ['Ba', 'Fe', 'O'])).toBe(0.5); // 未入力は中立
  });
});

describe('analyze end-to-end (real sample data)', () => {
  const SAMPLE_DIR = join(__dirname, '..', 'sample_data');
  const measText = readFileSync(join(SAMPLE_DIR, '007_Ba3Cu2Fe24O41_1050C.TXT'), 'utf-8');
  const refText = readFileSync(join(SAMPLE_DIR, 'M-type BaFe12O19 PDF 00-039-1433.txt'), 'utf-8');

  const prev = previewMeasurement(measText);
  const pattern = buildMeasurement(prev.table, 0, 1, '007_Ba3Cu2Fe24O41_1050C');
  const refTable = parseNumericTable(refText);
  const mapping = guessColumnMapping(refTable).mapping;

  const mtype: ReferencePhase = {
    id: 'test-mtype',
    phaseName: 'M-type BaFe12O19',
    pdfId: '00-039-1433',
    elements: ['Ba', 'Fe', 'O'],
    phaseFamily: 'M-type hexaferrite',
    color: '#1f4fd8',
    marker: 'circle',
    orientation: { mode: 'none' },
    peaks: buildReferencePeaks(refTable, mapping),
    columnMapping: mapping,
    sourceFileName: 'M-type BaFe12O19 PDF 00-039-1433.txt',
    importedAt: '2026-07-08T00:00:00Z',
  };
  // 存在しないはずのダミー相(全ピークが観測と合わない)
  const bogus: ReferencePhase = {
    ...mtype,
    id: 'test-bogus',
    phaseName: 'Bogus phase',
    pdfId: '',
    elements: ['Sn', 'O'],
    peaks: [ref(11.13, 100), ref(13.77, 90), ref(19.31, 80), ref(27.53, 70), ref(59.87, 60)],
  };

  const result = analyze(pattern, [mtype, bogus], {
    ...DEFAULT_PARAMS,
    sampleElements: ['Ba', 'Cu', 'Fe', 'O'],
  });

  it('detects a reasonable number of peaks', () => {
    expect(result.measuredPeaks.length).toBeGreaterThan(10);
    expect(result.measuredPeaks.length).toBeLessThan(200);
  });

  it('ranks M-type above the bogus phase with a clear margin', () => {
    expect(result.results[0].phaseName).toBe('M-type BaFe12O19');
    expect(result.results[0].score).toBeGreaterThan(0.5);
    expect(result.results[0].score - result.results[1].score).toBeGreaterThan(0.2);
  });

  it('matches the known strong M-type peaks (30.8, 32.1, 34.1)', () => {
    const m = result.results[0];
    for (const target of [30.8, 32.149, 34.09]) {
      expect(
        m.matches.some((x) => Math.abs(x.refTwoTheta - target) < 0.01),
        `ref peak ${target}`,
      ).toBe(true);
    }
  });

  it('keeps zero shift small for this well-calibrated sample', () => {
    expect(Math.abs(result.globalZeroShift)).toBeLessThan(0.2);
  });

  it('lists unmatched peaks (sample is Z-type so many peaks are unexplained by M-type alone)', () => {
    expect(result.unmatchedPeaks.length).toBeGreaterThan(0);
  });
});
