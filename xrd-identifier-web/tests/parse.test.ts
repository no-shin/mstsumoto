import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseNumericTable, splitLine, tryParseNumber } from '../src/core/parse/tokenize';
import { previewMeasurement, buildMeasurement, sampleNameFromFileName } from '../src/core/parse/measurement';
import { guessColumnMapping, braggMismatchRatio } from '../src/core/parse/columnGuess';
import { buildReferencePeaks, phaseNameFromFileName, elementsFromText } from '../src/core/parse/reference';

const SAMPLE_DIR = join(__dirname, '..', 'sample_data');
const MEAS = readFileSync(join(SAMPLE_DIR, '007_Ba3Cu2Fe24O41_1050C.TXT'), 'utf-8');
const REF = readFileSync(join(SAMPLE_DIR, 'M-type BaFe12O19 PDF 00-039-1433.txt'), 'utf-8');

describe('tokenize', () => {
  it('splits tab/space/comma lines', () => {
    expect(splitLine('10\t43.3')).toEqual(['10', '43.3']);
    expect(splitLine('1, 2, 3')).toEqual(['1', '2', '3']);
    expect(splitLine('a  b')).toEqual(['a', 'b']);
  });
  it('parses numbers with unicode minus, rejects garbage', () => {
    expect(tryParseNumber('−1.5')).toBe(-1.5);
    expect(tryParseNumber('1e3')).toBe(1000);
    expect(tryParseNumber('abc')).toBeNull();
    expect(tryParseNumber('')).toBeNull();
  });
  it('keeps header and numeric rows separately', () => {
    const t = parseNumericTable('l k h I 2θ d\n1 0 1 7 17.766 4.98843\n2 0 1 14 18.973 4.67371');
    expect(t.headers).toEqual(['l', 'k', 'h', 'I', '2θ', 'd']);
    expect(t.rows).toHaveLength(2);
    expect(t.columnCount).toBe(6);
  });
});

describe('measurement parsing (real sample)', () => {
  it('reads the sample measurement file', () => {
    const prev = previewMeasurement(MEAS);
    expect(prev.needsColumnConfirmation).toBe(false);
    const m = buildMeasurement(prev.table, prev.suggestedTwoThetaCol, prev.suggestedIntensityCol, 'sample');
    expect(m.twoTheta[0]).toBeCloseTo(10, 5);
    expect(m.twoTheta.length).toBe(m.intensity.length);
    // 昇順ソート済み
    for (let i = 1; i < m.twoTheta.length; i++) {
      expect(m.twoTheta[i]).toBeGreaterThan(m.twoTheta[i - 1]);
    }
  });
  it('extracts sample name from file name', () => {
    expect(sampleNameFromFileName('007_Ba3Cu2Fe24O41_1050C.TXT')).toBe('007_Ba3Cu2Fe24O41_1050C');
  });
});

describe('reference parsing (real l k h I 2θ d file)', () => {
  const table = parseNumericTable(REF);
  const guess = guessColumnMapping(table);

  it('guesses the non-standard l k h order from the header', () => {
    expect(guess.mapping).toMatchObject({ l: 0, k: 1, h: 2, intensity: 3, twoTheta: 4, d: 5 });
    expect(guess.confident).toBe(true);
  });

  it('bragg check passes with the correct mapping and fails when 2θ/d are swapped', () => {
    expect(braggMismatchRatio(table, guess.mapping)!).toBeLessThan(0.05);
    const swapped = { ...guess.mapping, twoTheta: 5, d: 4 };
    expect(braggMismatchRatio(table, swapped)!).toBeGreaterThan(0.5);
  });

  it('normalizes intensities to max=100 and sorts by 2θ', () => {
    const peaks = buildReferencePeaks(table, guess.mapping);
    expect(Math.max(...peaks.map((p) => p.intensity))).toBeCloseTo(100, 6);
    // 最強ピークは 32.149° (7 0 1)
    const strongest = peaks.find((p) => p.intensity === 100)!;
    expect(strongest.twoTheta).toBeCloseTo(32.149, 3);
    expect(strongest.h).toBe(1); // l k h 順なので h は3列目=1
    expect(strongest.l).toBe(7);
  });

  it('extracts phase name and PDF id from file name', () => {
    const { phaseName, pdfId } = phaseNameFromFileName('M-type BaFe12O19 PDF 00-039-1433.txt');
    expect(phaseName).toBe('M-type BaFe12O19');
    expect(pdfId).toBe('00-039-1433');
  });

  it('extracts elements from formula text', () => {
    expect(elementsFromText('M-type BaFe12O19').sort()).toEqual(['Ba', 'Fe', 'O']);
  });
});
