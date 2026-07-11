/** XRD 測定データ(.xy/.txt/.csv)のパース */

import type { Pt, XrdTrace } from '../types';
import { cleanName, uniqueId } from '../utils';

export function parseMeasured(text: string, name = 'sample', activeRefs: string[] = []): XrdTrace {
  const pts: Pt[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const vals = line
      .replace(/,/g, ' ')
      .split(/\s+/)
      .map(Number)
      .filter(Number.isFinite);
    if (vals.length >= 2) {
      const x = vals[0];
      const y = vals[1];
      if (x > -100 && x < 200 && Number.isFinite(y)) pts.push({ x, y });
    }
  }
  pts.sort((a, b) => a.x - b.x);
  const nm = cleanName(name);
  return {
    id: uniqueId('meas'),
    name: nm,
    rawName: name,
    displayName: nm,
    comment: nm,
    visible: true,
    points: pts,
    activeRefs,
  };
}
