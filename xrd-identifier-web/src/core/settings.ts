/**
 * 全設定のデフォルト値とアクセサ。
 * 元アプリでは DOM の input 値を直接読んでいたが、ここでは
 * Settings レコード(id → 値)として state に保持する。
 */

import type { Settings } from './types';
import { num } from './utils';

export const DEFAULT_SETTINGS: Settings = {
  projectName: 'xrd_project',
  layoutRatio: '50',
  // XRD 表示
  xMin: '20',
  xMax: '70',
  offset: '120',
  yPad: '45',
  topPad: '55',
  order: 'top',
  labelPos: 'right',
  normalize: true,
  baseline: true,
  // 参照・同定
  refSelect: 'all',
  orientationMode: 'all',
  textureMode: 'none',
  textureBoost: '3.0',
  candidateLimit: '12',
  minPeakI: '5',
  autoShift: 'on',
  maxShift: '0.50',
  mainPeakRequired: true,
  tol: '0.20',
  refMinI: '8',
  markerSize: '12',
  markerScale: '0.75',
  autoMarkerScale: 'on',
  markerLift: '15',
  hklMinI: '60',
  showMarkers: true,
  hideUnmatchedMarkers: true,
  markerPeakWindow: '0.35',
  markerPeakMin: '2.0',
  markerPeakProminence: '1.0',
  markerShoulderDetect: true,
  probeWindow: '0.35',
  probeSnap: 'on',
  markerMode: 'curve',
  markerJitter: '0',
  markerEach: true,
  showSticks: false,
  hklLabel: false,
  xrdLambda: '1.54056',
  markerDragSnap: true,
  markerDragSnapTol: '0.10',
  markerDragMaxShift: '5.0',
  showOriginalMarkers: true,
  latticeFitMode: 'direct',
  latticeAutoTol: '0.20',
  refElementFilter: '',
  refSearch: '',
  // 共通図設定
  lineWidth: '1.4',
  fontSize: '34',
  svgW: '760',
  svgH: '600',
  showYTicks: false,
  showLegend: true,
  // MH
  mhXMin: '-15',
  mhXMax: '15',
  mhAutoY: 'manual',
  mhYMin: '-80',
  mhYMax: '80',
  mhMassMode: 'auto',
  mhManualMass: '0.02',
  mhSmooth: '0',
  mhPointStep: '1',
  mhXAxisLabel: 'Magnetic field (kOe)',
  mhYAxisLabel: 'Magnetization (emu/g)',
  mhXTick: '0',
  mhYTick: '0',
  mhXLabelEvery: '1',
  mhYLabelEvery: '1',
  mhMinorTicks: false,
  mhSvgW: '',
  mhSvgH: '',
  mhMarginL: '170',
  mhMarginR: '64',
  mhMarginT: '36',
  mhMarginB: '116',
  mhFontSize: '',
  mhLineWidth: '',
  mhShowZero: true,
  mhMirrorTicks: true,
  // MT
  mtXMin: '0',
  mtXMax: '600',
  mtAutoY: 'auto',
  mtYMin: '0',
  mtYMax: '1',
  mtMassMode: 'raw',
  mtManualMass: '0.02',
  mtSmooth: '41',
  mtPointStep: '1',
  mtShowD1: false,
  mtShowD2: false,
  mtDerivativeScale: '18',
  mtDerivativeSmooth: '21',
  mtD2PreSmooth: '51',
  mtTcLabelFont: '20',
  mtD1Scale: '18',
  mtD2Scale: '22',
  mtD1Pos: '20',
  mtD2Pos: '34',
  mtTcMin: '50',
  mtTcMax: '550',
  mtTcCandidateCount: '3',
  mtXAxisLabel: 'Temperature (°C)',
  mtYAxisLabel: 'Magnetization (arb.units)',
  mtXTick: '0',
  mtYTick: '0',
  mtXLabelEvery: '1',
  mtYLabelEvery: '1',
  mtMinorTicks: false,
  mtSvgW: '',
  mtSvgH: '',
  mtMarginL: '170',
  mtMarginR: '64',
  mtMarginT: '36',
  mtMarginB: '116',
  mtFontSize: '',
  mtLineWidth: '',
  mtShowZero: false,
  mtMirrorTicks: true,
};

/** 数値設定(空文字や不正値は fallback) */
export function sNum(s: Settings, id: string, fallback = 0): number {
  return num(s[id], fallback);
}

/** 空欄なら fallback を返す数値設定(「全体設定」プレースホルダ用) */
export function sOptNum(s: Settings, id: string, fallback: number): number {
  const v = s[id];
  if (v === undefined || String(v).trim() === '') return fallback;
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

export function sStr(s: Settings, id: string, fallback = ''): string {
  const v = s[id];
  return v === undefined ? fallback : String(v);
}

export function sBool(s: Settings, id: string, fallback = false): boolean {
  const v = s[id];
  return v === undefined ? fallback : Boolean(v);
}
