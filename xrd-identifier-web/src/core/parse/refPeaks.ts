/**
 * 参照ピークデータのパース。
 * `d 2θ I fix h k l` / `l k h I 2θ d` などの列順をヘッダとブラッグ整合性から自動判定する。
 */

import type { RefPeak, RefPhase } from '../types';
import { cleanName, uniqueId } from '../utils';
import { simplifyPhaseLabel, suggestMarker } from '../refs/labels';

function firstIndex(idx: Record<string, number>, names: string[]): number | null {
  for (const n of names) {
    if (idx[n] != null) return idx[n];
  }
  return null;
}

function isAngle(v: number): boolean {
  return Number.isFinite(v) && v > 0 && v < 180;
}

function braggScore(d: number, angle: number): number {
  if (!Number.isFinite(d) || !Number.isFinite(angle) || d <= 0 || !isAngle(angle)) return 9;
  const lambda = 1.5406;
  const theta = (angle * Math.PI) / 360;
  const dCalc = lambda / (2 * Math.sin(theta));
  return Math.abs(dCalc - d) / Math.max(d, 1e-9);
}

function makeRefPeak(
  d: number | null | undefined,
  angle: number,
  intensity: number,
  h: number | null | undefined,
  k: number | null | undefined,
  l: number | null | undefined,
  name: string,
): RefPeak | null {
  if (!isAngle(angle) || !Number.isFinite(intensity) || intensity < 0) return null;
  const cleanInt = (v: number | null | undefined) => (Number.isFinite(v as number) ? Math.round(v as number) : null);
  return {
    d: Number.isFinite(d as number) ? (d as number) : null,
    angle,
    intensity,
    iNorm: 0,
    h: cleanInt(h),
    k: cleanInt(k),
    l: cleanInt(l),
    phase: cleanName(name),
  };
}

function parseRefValues(vals: number[], header: string[] | null, name: string): RefPeak | null {
  if (vals.length < 2) return null;
  if (header && vals.length >= header.length) {
    const idx: Record<string, number> = Object.fromEntries(header.map((h, i) => [h, i]));
    const angleIdx = firstIndex(idx, ['2theta', '2th', 'twotheta', 'angle']);
    const intIdx = firstIndex(idx, ['i', 'intensity', 'inten', 'relativeintensity']);
    const dIdx = firstIndex(idx, ['d', 'dspacing', 'd_spacing']);
    const hIdx = idx.h;
    const kIdx = idx.k;
    const lIdx = idx.l;
    if (angleIdx != null && intIdx != null) {
      return makeRefPeak(
        dIdx != null ? vals[dIdx] : null,
        vals[angleIdx],
        vals[intIdx],
        hIdx != null ? vals[hIdx] : null,
        kIdx != null ? vals[kIdx] : null,
        lIdx != null ? vals[lIdx] : null,
        name,
      );
    }
  }
  interface Cand {
    d: number | null;
    angle: number;
    intensity: number;
    h: number | null;
    k: number | null;
    l: number | null;
    score: number;
  }
  const candidates: Cand[] = [];
  if (vals.length >= 7)
    candidates.push({ d: vals[0], angle: vals[1], intensity: vals[2], h: vals[4], k: vals[5], l: vals[6], score: braggScore(vals[0], vals[1]) - 0.2 });
  if (vals.length >= 6)
    candidates.push({ d: vals[0], angle: vals[1], intensity: vals[2], h: vals[3], k: vals[4], l: vals[5], score: braggScore(vals[0], vals[1]) });
  if (vals.length >= 6)
    candidates.push({ d: vals[5], angle: vals[4], intensity: vals[3], h: vals[0], k: vals[1], l: vals[2], score: braggScore(vals[5], vals[4]) + 0.05 });
  if (vals.length >= 6)
    candidates.push({ d: vals[5], angle: vals[4], intensity: vals[3], h: vals[2], k: vals[1], l: vals[0], score: braggScore(vals[5], vals[4]) + 0.1 });
  if (vals.length >= 5)
    candidates.push({ d: null, angle: vals[0], intensity: vals[1], h: vals[2], k: vals[3], l: vals[4], score: isAngle(vals[0]) ? 0.55 : 9 });
  if (vals.length >= 2)
    candidates.push({ d: null, angle: vals[0], intensity: vals[1], h: null, k: null, l: null, score: isAngle(vals[0]) ? 0.9 : 9 });
  candidates.sort((a, b) => a.score - b.score);
  const c = candidates.find((c) => isAngle(c.angle) && Number.isFinite(c.intensity) && c.intensity >= 0);
  return c ? makeRefPeak(c.d, c.angle, c.intensity, c.h, c.k, c.l, name) : null;
}

export interface ParseReferenceOpts {
  displayName?: string;
  visible?: boolean;
  builtin?: boolean;
  marker?: string;
}

export function parseReference(
  text: string,
  name = 'reference',
  color = '#e11d48',
  opts: ParseReferenceOpts = {},
): RefPhase {
  const peaks: RefPeak[] = [];
  let header: string[] | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('//') || line.startsWith(';')) continue;
    if (/[a-zA-ZθΘａ-ｚＡ-Ｚ]/.test(line) && !/^[-+\d.]/.test(line)) {
      header = line
        .toLowerCase()
        .replaceAll('2θ', '2theta')
        .replaceAll('2Θ', '2theta')
        .replaceAll('2ｼｰﾀ', '2theta')
        .replace(/[(),]/g, ' ')
        .split(/\s+/)
        .filter(Boolean);
      continue;
    }
    const vals =
      line
        .replace(/,/g, ' ')
        .match(/[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?/g)
        ?.map(Number) || [];
    const peak = parseRefValues(vals, header, name);
    if (peak) peaks.push(peak);
  }
  const maxI = Math.max(1, ...peaks.map((p) => p.intensity));
  peaks.forEach((p) => {
    p.iNorm = (p.intensity / maxI) * 100;
  });
  return {
    id: uniqueId('ref'),
    name: cleanName(name),
    rawName: name,
    displayName: opts.displayName ? simplifyPhaseLabel(opts.displayName) : '',
    visible: opts.visible ?? true,
    builtin: Boolean(opts.builtin),
    color,
    marker: opts.marker || suggestMarker(opts.displayName || name),
    peaks,
  };
}

export function hklText(p: { h: number | string | null; k: number | string | null; l: number | string | null }): string {
  if (p.h == null || p.k == null || p.l == null || p.h === '' || p.k === '' || p.l === '') return '';
  return `${p.h}${p.k}${p.l}`.replace(/\.0/g, '');
}
