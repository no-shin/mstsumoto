/** CSV 生成(文字列を返すだけ。ダウンロードは UI 層の責務) */

import type { AnalysisResult } from '../types';

function csvEscape(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: Array<Array<string | number>>): string {
  // Excel での文字化け対策に BOM を付ける
  return '﻿' + rows.map((r) => r.map(csvEscape).join(',')).join('\r\n') + '\r\n';
}

export function resultTableCsv(result: AnalysisResult): string {
  const rows: Array<Array<string | number>> = [
    [
      'rank', 'phase', 'pdf_id', 'score', 'score_position', 'score_strong', 'score_observed',
      'score_composition', 'score_intensity', 'zero_shift_deg', 'matched_ref_peaks',
      'ref_peaks_in_range', 'strong_matched', 'strong_ref', 'orientation', 'notes',
    ],
  ];
  result.results.forEach((r, i) => {
    rows.push([
      i + 1, r.phaseName, r.pdfId, r.score.toFixed(4),
      r.breakdown.position.toFixed(3), r.breakdown.strongExplained.toFixed(3),
      r.breakdown.observedExplained.toFixed(3), r.breakdown.composition.toFixed(3),
      r.breakdown.intensityCorr.toFixed(3), r.zeroShift.toFixed(4),
      r.matchedCount, r.refCountInRange, r.strongMatchedCount, r.strongRefCount,
      r.orientation.mode, r.notes.join(' / '),
    ]);
  });
  return toCsv(rows);
}

export function peakListCsv(result: AnalysisResult): string {
  const rows: Array<Array<string | number>> = [
    ['two_theta', 'intensity_corrected', 'intensity_raw', 'prominence', 'fwhm_deg'],
  ];
  for (const p of result.measuredPeaks) {
    rows.push([
      p.twoTheta.toFixed(4), p.intensity.toFixed(4), p.rawIntensity.toFixed(4),
      p.prominence.toFixed(4), p.fwhm.toFixed(4),
    ]);
  }
  return toCsv(rows);
}

export function unmatchedPeaksCsv(result: AnalysisResult): string {
  const rows: Array<Array<string | number>> = [
    ['two_theta', 'intensity_corrected', 'intensity_raw', 'prominence', 'fwhm_deg'],
  ];
  for (const p of result.unmatchedPeaks) {
    rows.push([
      p.twoTheta.toFixed(4), p.intensity.toFixed(4), p.rawIntensity.toFixed(4),
      p.prominence.toFixed(4), p.fwhm.toFixed(4),
    ]);
  }
  return toCsv(rows);
}
