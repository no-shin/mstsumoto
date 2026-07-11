/**
 * アプリ全体で共有する型定義。
 * 「XRD / MH / MT Graph Maker」の state 構造を TypeScript 化したもの。
 */

export type GraphMode = 'xrd' | 'mh' | 'mt';

export interface Pt {
  x: number;
  y: number;
}

/** 参照相の1ピーク */
export interface RefPeak {
  d: number | null;
  angle: number;
  intensity: number;
  iNorm: number;
  h: number | null;
  k: number | null;
  l: number | null;
  phase: string;
}

/** 参照相(内蔵 or 読み込み) */
export interface RefPhase {
  id: string;
  name: string;
  rawName: string;
  displayName: string;
  visible: boolean;
  builtin: boolean;
  color: string;
  marker: string;
  peaks: RefPeak[];
}

/** XRD 測定データ */
export interface XrdTrace {
  id: string;
  name: string;
  rawName: string;
  displayName: string;
  comment: string;
  visible: boolean;
  points: Pt[];
  /** このグラフに表示する参照相 id */
  activeRefs: string[];
}

export interface MhPoint {
  hOe: number;
  mEmu: number;
}

export interface MhTrace {
  id: string;
  name: string;
  rawName: string;
  displayName: string;
  visible: boolean;
  color: string;
  mass: number | null;
  points: MhPoint[];
}

export interface MtPoint {
  temp: number;
  mEmu: number;
  hOe: number | null;
}

export interface TcAdoption {
  temp: number;
  method: string;
  score?: number;
  confidence?: number;
}

export interface MtTrace {
  id: string;
  name: string;
  rawName: string;
  displayName: string;
  visible: boolean;
  color: string;
  mass: number | null;
  points: MtPoint[];
  adoptedTcList: TcAdoption[];
}

export interface ZoomView {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface MarkerOffset {
  twoTheta?: number;
  yOffset?: number;
}

/** 参照ピークと実測ピークの対応(格子定数計算に使用) */
export interface PeakAlignment {
  key: string;
  referenceName: string;
  sampleName?: string;
  traceId?: string;
  originalTwoTheta: number;
  correctedTwoTheta: number;
  matchedMeasuredPeakTwoTheta: number;
  h: number | string | null;
  k: number | string | null;
  l: number | string | null;
  d: number | null;
  intensity: number | null;
  use: boolean;
  autoAssigned?: boolean;
}

export interface TcAnnotation {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  targetX?: number;
  targetY?: number;
}

export interface LegendPos {
  x: number;
  y: number;
}

export interface MtDerivativeLayout {
  d1BaseRatio: number;
  d2BaseRatio: number;
}

/** 全設定値(元アプリの SETTING_IDS に対応。checkbox は boolean、それ以外は string) */
export type Settings = Record<string, string | boolean>;

/** undo/redo・プロジェクト保存の対象となるアプリ状態 */
export interface AppState {
  mode: GraphMode;
  settings: Settings;
  measured: XrdTrace[];
  refs: RefPhase[];
  mhTraces: MhTrace[];
  mtTraces: MtTrace[];
  xrdZoomView: ZoomView | null;
  xrdZoomHistory: (ZoomView | null)[];
  mhZoomView: ZoomView | null;
  mhZoomHistory: (ZoomView | null)[];
  mtZoomView: ZoomView | null;
  mtZoomHistory: (ZoomView | null)[];
  xrdPeakAlignments: Record<string, PeakAlignment>;
  xrdMarkerOffsets: Record<string, MarkerOffset>;
  mtTcAnnotations: Record<string, TcAnnotation>;
  mtDerivativeLayout: MtDerivativeLayout;
  mhLegend: LegendPos | null;
  mtLegend: LegendPos | null;
  probe: { angle: number } | null;
  lastSelectedMarkerKey: string | null;
  lastSelectedMarkerPhase: string | null;
}

export const palette = [
  '#e11d48',
  '#2563eb',
  '#059669',
  '#8b5cf6',
  '#d97706',
  '#0f766e',
  '#dc2626',
  '#7c3aed',
];

export const markerOptions = [
  'triangle_down',
  'triangle_up',
  'triangle_left',
  'triangle_right',
  'circle',
  'diamond',
  'square',
  'cross',
  'plus',
  'star',
  'star6',
  'wedge_down',
  'wedge_up',
  'wedge_left',
  'wedge_right',
];
