/** 配向モードの判定と参照ピーク重み */

import type { OrientationSetting, RefPeak } from '../types';

export function orientationAllows(
  h: number,
  k: number,
  l: number,
  setting: OrientationSetting,
): boolean {
  switch (setting.mode) {
    case 'none':
      return true;
    case '00l':
      return h === 0 && k === 0 && l !== 0;
    case 'h00':
      return h !== 0 && k === 0 && l === 0;
    case '0k0':
      return h === 0 && k !== 0 && l === 0;
    case 'hk0':
      return l === 0;
    case 'custom': {
      const rule = setting.custom;
      if (!rule) return true;
      const check = (v: number, cond: 'zero' | 'nonzero' | 'any') =>
        cond === 'any' ? true : cond === 'zero' ? v === 0 : v !== 0;
      return check(h, rule.h) && check(k, rule.k) && check(l, rule.l);
    }
  }
}

export function hasOrientation(setting: OrientationSetting): boolean {
  return setting.mode !== 'none';
}

/** 位置一致スコア用の参照ピーク重み。配向仮定時は該当面を強調・非該当面を減衰 */
export function refWeight(peak: RefPeak, setting: OrientationSetting): number {
  const base = Math.max(peak.intensity, 1);
  if (!hasOrientation(setting)) return base;
  return orientationAllows(peak.h, peak.k, peak.l, setting) ? base * 1.5 : base * 0.35;
}
