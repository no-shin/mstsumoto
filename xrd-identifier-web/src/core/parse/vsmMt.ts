/** MT(VSM)データのパース。Temp./M 列を自動判定し、単純数値表にもフォールバックする。 */

import type { MtPoint, MtTrace } from '../types';
import { palette } from '../types';
import { splitCSVLine, uniqueId } from '../utils';

export function parseMT(text: string, filename: string, existingCount = 0): MtTrace {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  let sampleName = '';
  let mass = NaN;
  let headerIndex = -1;
  let tIdx = -1;
  let mIdx = -1;
  let hIdx = -1;
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
    const lows = cells.map((c) => c.toLowerCase().replace(/\s+/g, '').replace('℃', '°'));
    const ti = lows.findIndex((c) => c === 't' || c.startsWith('temp') || c.includes('temperature'));
    const mi = lows.findIndex(
      (c) => c === 'm' || c === 'm(emu)' || c === 'm(emu/g)' || c.startsWith('magnetization'),
    );
    const hi = lows.findIndex(
      (c) => c === 'h' || c === 'h(oe)' || c === 'h(koe)' || c.startsWith('magneticfield'),
    );
    if (ti >= 0 && mi >= 0 && ti !== mi) {
      headerIndex = i;
      tIdx = ti;
      mIdx = mi;
      hIdx = hi;
      break;
    }
  }
  let rawPoints: MtPoint[] = [];
  if (headerIndex >= 0) {
    for (let i = headerIndex + 1; i < lines.length; i++) {
      const cells = splitCSVLine(lines[i]);
      const temp = Number(cells[tIdx]);
      const m = Number(cells[mIdx]);
      const h = hIdx >= 0 ? Number(cells[hIdx]) : NaN;
      if (Number.isFinite(temp) && Number.isFinite(m))
        rawPoints.push({ temp, mEmu: m, hOe: Number.isFinite(h) ? h : null });
    }
  } else {
    // Fallback: Temp, M または Temp, H, M の単純数値表を受け付ける。
    for (const line of lines) {
      const cells = splitCSVLine(line);
      const nums = cells.map((c) => Number(c)).filter(Number.isFinite);
      if (nums.length >= 2) {
        const temp = nums[0];
        const m = nums.length >= 3 ? nums[2] : nums[1];
        const h = nums.length >= 3 ? nums[1] : null;
        if (Number.isFinite(temp) && Number.isFinite(m)) rawPoints.push({ temp, mEmu: m, hOe: h });
      }
    }
  }
  rawPoints = rawPoints
    .filter((p) => Number.isFinite(p.temp) && Number.isFinite(p.mEmu))
    .sort((a, b) => a.temp - b.temp);
  const name = sampleName || filename.replace(/\.[^.]+$/, '');
  return {
    id: uniqueId('mt'),
    name,
    rawName: filename,
    displayName: name,
    visible: true,
    color: palette[existingCount % palette.length],
    mass: Number.isFinite(mass) && mass > 0 ? mass : null,
    points: rawPoints,
    adoptedTcList: [],
  };
}
