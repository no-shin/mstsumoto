/** MT 曲線の表示用変換と dM/dT・d²M/dT² 計算(キャッシュ付き) */

import type { MtTrace, Pt, Settings } from '../types';
import { sNum, sStr } from '../settings';
import {
  collapseDuplicateX,
  localPolynomialDerivativePoints,
  localPolynomialSmoothPoints,
  oddWindow,
  suppressImpulseNoise,
} from '../peaks/smooth';

export function mtDisplayName(t: MtTrace): string {
  return (t.displayName || t.name || t.rawName || '').trim();
}

export function mtAcceptedTcList(t: MtTrace) {
  return Array.isArray(t.adoptedTcList) ? t.adoptedTcList : [];
}

export function mtMassForTrace(t: MtTrace, settings: Settings): number | null {
  const mode = sStr(settings, 'mtMassMode', 'raw');
  if (mode === 'raw' || mode === 'norm') return null;
  if (mode === 'manual') {
    const m = sNum(settings, 'mtManualMass', NaN);
    return Number.isFinite(m) && m > 0 ? m : null;
  }
  const m = Number(t.mass);
  return Number.isFinite(m) && m > 0 ? m : null;
}

export function mtPlotPoints(t: MtTrace, settings: Settings): Pt[] {
  const mass = mtMassForTrace(t, settings);
  const mode = sStr(settings, 'mtMassMode', 'raw');
  let rawY = (t.points || []).map((p) => (mass ? p.mEmu / mass : p.mEmu));
  if (mode === 'norm' && rawY.length) {
    const mn = Math.min(...rawY);
    const mx = Math.max(...rawY);
    const span = Math.max(1e-12, mx - mn);
    rawY = rawY.map((v) => ((v - mn) / span) * 100);
  }
  const step = Math.max(1, Math.floor(sNum(settings, 'mtPointStep', 1)));
  const pts: Pt[] = [];
  for (let i = 0; i < (t.points || []).length; i++) {
    const p = t.points[i];
    const y = rawY[i];
    const x = p.temp;
    if (Number.isFinite(x) && Number.isFinite(y)) pts.push({ x, y });
  }
  pts.sort((a, b) => a.x - b.x);
  const smoothed = localPolynomialSmoothPoints(collapseDuplicateX(pts), settings['mtSmooth'], 2);
  return smoothed.filter((_, i) => i % step === 0);
}

export interface MtDerivatives {
  base: Pt[];
  d1: Pt[];
  d2: Pt[];
}

const derivativeCache = new Map<string, { key: string; value: MtDerivatives }>();

export function clearMtDerivativeCache(): void {
  derivativeCache.clear();
}

export function mtDerivatives(t: MtTrace, settings: Settings): MtDerivatives {
  const first = t.points?.[0];
  const last = t.points?.[t.points.length - 1];
  const cacheKey = [
    t.id,
    t.points?.length,
    first?.temp,
    first?.mEmu,
    last?.temp,
    last?.mEmu,
    settings['mtMassMode'],
    settings['mtManualMass'],
    t.mass,
    settings['mtSmooth'],
    settings['mtPointStep'],
    settings['mtDerivativeSmooth'],
    settings['mtD2PreSmooth'],
  ].join('|');
  const cached = derivativeCache.get(t.id);
  if (cached?.key === cacheKey) return cached.value;
  const base = mtPlotPoints(t, settings);
  const dSmooth = oddWindow(settings['mtDerivativeSmooth'], 21, base.length);
  const direct = localPolynomialDerivativePoints(base, dSmooth, 3);
  const d2Pre = oddWindow(settings['mtD2PreSmooth'], 51, base.length);
  const d2Input = localPolynomialSmoothPoints(suppressImpulseNoise(base), d2Pre, 3);
  const d2Fit = localPolynomialDerivativePoints(d2Input, dSmooth, 3);
  let d2 = d2Fit.d2;
  if (dSmooth > 3)
    d2 = localPolynomialSmoothPoints(d2, Math.max(5, Math.floor(dSmooth * 0.75) | 1), 2);
  const value: MtDerivatives = { base: direct.base.length ? direct.base : base, d1: direct.d1, d2 };
  derivativeCache.set(t.id, { key: cacheKey, value });
  return value;
}

export interface ScaledAuxPoint extends Pt {
  raw: number;
}

export function scaledAuxPoints(points: Pt[], baseline: number, amp: number): ScaledAuxPoint[] {
  if (!points.length) return [];
  const maxAbs = Math.max(1e-12, ...points.map((p) => Math.abs(p.y)).filter(Number.isFinite));
  return points.map((p) => ({ x: p.x, y: baseline + (p.y / maxAbs) * amp, raw: p.y }));
}
