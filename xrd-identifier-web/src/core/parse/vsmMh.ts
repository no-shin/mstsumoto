/** MH(VSM)データのパース。sample name / sample weight ヘッダと H/M 列を自動判定する。 */

import type { MhPoint, MhTrace } from '../types';
import { palette } from '../types';
import { extractNumericFields, splitCSVLine, uniqueId } from '../utils';

export function parseMH(text: string, filename: string, existingCount = 0): MhTrace {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  let sampleName = '';
  let mass = NaN;
  let headerIndex = -1;
  let hIdx = -1;
  let mIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const low = raw.toLowerCase();
    if (low.startsWith('sample name')) {
      const a = splitCSVLine(raw);
      sampleName = (a[1] || '').trim();
    }
    if (low.startsWith('sample weight')) {
      const a = splitCSVLine(raw);
      mass = Number(a[1]);
    }
    const cells = splitCSVLine(raw);
    const lows = cells.map((c) => c.toLowerCase().replace(/\s+/g, ''));
    const h = lows.findIndex(
      (c) => c === 'h' || c === 'h(oe)' || c === 'h(koe)' || c.startsWith('magneticfield'),
    );
    const m = lows.findIndex(
      (c) => c === 'm' || c === 'm(emu)' || c === 'm(emu/g)' || c.startsWith('magnetization'),
    );
    if (h >= 0 && m >= 0 && h !== m) {
      headerIndex = i;
      hIdx = h;
      mIdx = m;
      break;
    }
  }
  let rawPoints: MhPoint[] = [];
  if (headerIndex >= 0) {
    for (let i = headerIndex + 1; i < lines.length; i++) {
      const cells = splitCSVLine(lines[i]);
      const h = Number(cells[hIdx]);
      const m = Number(cells[mIdx]);
      if (Number.isFinite(h) && Number.isFinite(m)) rawPoints.push({ hOe: h, mEmu: m });
    }
  } else {
    const numericRows: number[][] = [];
    for (const line of lines) {
      const nums = extractNumericFields(line);
      if (nums.length >= 2) numericRows.push(nums.slice(0, 2));
    }
    const maxAbsH = numericRows.reduce((a, r) => Math.max(a, Math.abs(r[0])), 0);
    const factor = maxAbsH > 100 ? 1 : 1000;
    rawPoints = numericRows.map((r) => ({ hOe: r[0] * factor, mEmu: r[1] }));
  }
  const name = sampleName || filename.replace(/\.[^.]+$/, '');
  return {
    id: uniqueId('mh'),
    name,
    rawName: filename,
    displayName: name,
    visible: true,
    color: palette[existingCount % palette.length],
    mass: Number.isFinite(mass) && mass > 0 ? mass : null,
    points: rawPoints,
  };
}
