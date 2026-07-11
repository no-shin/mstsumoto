/** Tc 候補推定(dM/dT の最急降下 + d²M/dT² の卓立極値) */

import type { MtTrace, Settings } from '../types';
import { sNum } from '../settings';
import { mtDerivatives } from './derivative';

export interface TcCandidate {
  temp: number;
  score: number;
  confidence: number;
  method: string;
  prominence?: number;
}

export function mtTcCandidates(t: MtTrace, settings: Settings): TcCandidate[] {
  const { d1, d2 } = mtDerivatives(t, settings);
  const tMin = sNum(settings, 'mtTcMin', 50);
  const tMax = sNum(settings, 'mtTcMax', 550);
  const lim = Math.max(1, Math.floor(sNum(settings, 'mtTcCandidateCount', 3)));
  const d1Range = d1.filter(
    (p) => p.x >= Math.min(tMin, tMax) && p.x <= Math.max(tMin, tMax) && Number.isFinite(p.y),
  );
  const inRange = d2.filter(
    (p) => p.x >= Math.min(tMin, tMax) && p.x <= Math.max(tMin, tMax) && Number.isFinite(p.y),
  );
  if (d1Range.length < 5 && inRange.length < 5) return [];
  const candidates: TcCandidate[] = [];
  if (d1Range.length >= 5) {
    const vals = d1Range.map((p) => p.y).sort((a, b) => a - b);
    const median = vals[Math.floor(vals.length / 2)];
    const minVal = vals[0];
    const maxVal = vals[vals.length - 1];
    const span = Math.max(1e-12, maxVal - minVal);
    const minGap = Math.max(15, (Math.max(tMin, tMax) - Math.min(tMin, tMax)) * 0.04);
    const slopePeaks: TcCandidate[] = [];
    for (let i = 1; i < d1Range.length - 1; i++) {
      const p = d1Range[i];
      if (p.y <= d1Range[i - 1].y && p.y < d1Range[i + 1].y && p.y < median - span * 0.12) {
        slopePeaks.push({
          temp: p.x,
          score: p.y,
          confidence: Math.min(1, Math.abs(p.y - median) / span),
          method: 'steepest_slope',
        });
      }
    }
    slopePeaks.sort((a, b) => a.score - b.score);
    for (const p of slopePeaks) {
      if (candidates.every((q) => Math.abs(q.temp - p.temp) >= minGap)) candidates.push(p);
      if (
        candidates.filter((c) => c.method === 'steepest_slope').length >=
        Math.max(1, Math.min(2, lim))
      )
        break;
    }
  }
  if (inRange.length < 5) return candidates.slice(0, lim);
  const ys = inRange.map((p) => p.y).sort((a, b) => a - b);
  const median = ys[Math.floor(ys.length / 2)];
  const mad =
    ys.map((v) => Math.abs(v - median)).sort((a, b) => a - b)[Math.floor(ys.length / 2)] || 0;
  const span = Math.max(1e-12, Math.max(...ys) - Math.min(...ys));
  const minProminence = Math.max(mad * 2.0, span * 0.025);
  const local: TcCandidate[] = [];
  const look = Math.max(3, Math.floor(inRange.length * 0.035));
  for (let i = 1; i < inRange.length - 1; i++) {
    const p = inRange[i];
    const isMax = p.y > inRange[i - 1].y && p.y >= inRange[i + 1].y && p.y > median;
    const isMin = p.y < inRange[i - 1].y && p.y <= inRange[i + 1].y && p.y < median;
    if (!isMax && !isMin) continue;
    let leftMin = p.y;
    let rightMin = p.y;
    let leftMax = p.y;
    let rightMax = p.y;
    for (let j = Math.max(0, i - look); j < i; j++) {
      leftMin = Math.min(leftMin, inRange[j].y);
      leftMax = Math.max(leftMax, inRange[j].y);
    }
    for (let j = i + 1; j <= Math.min(inRange.length - 1, i + look); j++) {
      rightMin = Math.min(rightMin, inRange[j].y);
      rightMax = Math.max(rightMax, inRange[j].y);
    }
    const prominence = isMax ? p.y - Math.max(leftMin, rightMin) : Math.min(leftMax, rightMax) - p.y;
    if (prominence >= minProminence)
      local.push({
        temp: p.x,
        score: p.y,
        prominence,
        confidence: Math.min(1, prominence / span),
        method: isMax ? 'second_derivative_max' : 'second_derivative_min',
      });
  }
  const sorted = local.sort(
    (a, b) => (b.prominence || 0) - (a.prominence || 0) || Math.abs(b.score) - Math.abs(a.score),
  );
  const minGap = Math.max(15, (Math.max(tMin, tMax) - Math.min(tMin, tMax)) * 0.04);
  for (const p of sorted) {
    if (candidates.every((q) => Math.abs(q.temp - p.temp) >= minGap)) candidates.push(p);
    if (candidates.length >= lim) break;
  }
  return candidates.slice(0, lim);
}
