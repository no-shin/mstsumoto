/**
 * core 全体で共有する型定義。
 * core/ 以下は React に依存しない純粋ロジックのみを置く。
 */

/** 測定パターン(2θ 昇順ソート済み) */
export interface MeasuredPattern {
  /** 試料名(ファイル名由来) */
  sampleName: string;
  twoTheta: number[];
  intensity: number[];
}

/** 検出された測定ピーク */
export interface MeasuredPeak {
  twoTheta: number;
  /** ベースライン補正後の強度(スコアリングに使用) */
  intensity: number;
  /** 生データの強度(表示・出力用) */
  rawIntensity: number;
  prominence: number;
  /** 半値幅(deg)。推定不能なら 0 */
  fwhm: number;
}

/** 参照ピーク(1本) */
export interface RefPeak {
  h: number;
  k: number;
  l: number;
  /** max=100 に正規化済みの相対強度 */
  intensity: number;
  twoTheta: number;
  d: number | null;
}

/** 配向モード */
export type OrientationMode = 'none' | '00l' | 'h00' | '0k0' | 'hk0' | 'custom';

/** custom 配向の条件: h,k,l それぞれ 'zero'(=0) / 'nonzero'(≠0) / 'any' */
export interface CustomOrientationRule {
  h: 'zero' | 'nonzero' | 'any';
  k: 'zero' | 'nonzero' | 'any';
  l: 'zero' | 'nonzero' | 'any';
}

export interface OrientationSetting {
  mode: OrientationMode;
  custom?: CustomOrientationRule;
}

/** 参照ファイルの列マッピング(-1 = その列なし) */
export interface ColumnMapping {
  h: number;
  k: number;
  l: number;
  intensity: number;
  twoTheta: number;
  d: number;
}

/** 参照相(DB に保存される単位) */
export interface ReferencePhase {
  /** IndexedDB キー(UUID) */
  id: string;
  phaseName: string;
  pdfId: string;
  /** 含まれる元素記号(組成候補判定に使用) */
  elements: string[];
  /** 相分類(例: "M-type hexaferrite", "spinel", "raw material") */
  phaseFamily: string;
  color: string;
  /** SVG マーカー種 */
  marker: MarkerShape;
  orientation: OrientationSetting;
  peaks: RefPeak[];
  /** インポート時に確定した列マッピング(再インポート時の初期値) */
  columnMapping: ColumnMapping;
  sourceFileName: string;
  importedAt: string; // ISO 8601
}

export type MarkerShape =
  | 'circle'
  | 'triangle-down'
  | 'triangle-up'
  | 'diamond'
  | 'square'
  | 'cross'
  | 'plus'
  | 'star';

/** 1本の参照ピークと観測ピークの対応 */
export interface PeakMatch {
  refTwoTheta: number;
  obsTwoTheta: number;
  obsIntensity: number;
  refIntensity: number;
  /** obs - (ref + zeroShift) */
  diff: number;
  h: number;
  k: number;
  l: number;
}

/** 相ごとの照合結果 */
export interface PhaseResult {
  phaseId: string;
  phaseName: string;
  pdfId: string;
  score: number;
  /** スコア内訳(UI で根拠表示するため保持) */
  breakdown: ScoreBreakdown;
  zeroShift: number;
  matches: PeakMatch[];
  matchedCount: number;
  refCountInRange: number;
  strongMatchedCount: number;
  strongRefCount: number;
  orientation: OrientationSetting;
  color: string;
  marker: MarkerShape;
  notes: string[];
}

export interface ScoreBreakdown {
  position: number;
  strongExplained: number;
  observedExplained: number;
  composition: number;
  intensityCorr: number;
}

/** 解析パラメータ(UI から渡す) */
export interface AnalysisParams {
  /** 2θ 照合許容幅 (deg) */
  toleranceDeg: number;
  /** ゼロシフト探索窓 (deg) */
  shiftWindowDeg: number;
  /** ピーク prominence。null なら自動 */
  prominence: number | null;
  /** 最小ピーク間隔 (deg) */
  minDistanceDeg: number;
  smoothing: boolean;
  baselineCorrection: boolean;
  /** 原料組成の元素集合(空なら組成スコアは中立) */
  sampleElements: string[];
  /** 未説明ピーク判定に使う「有力相」のスコア閾値 */
  unmatchedScoreThreshold: number;
}

export const DEFAULT_PARAMS: AnalysisParams = {
  toleranceDeg: 0.25,
  shiftWindowDeg: 0.5,
  prominence: null,
  minDistanceDeg: 0.15,
  smoothing: true,
  baselineCorrection: true,
  sampleElements: [],
  unmatchedScoreThreshold: 0.4,
};

/** 解析全体の結果 */
export interface AnalysisResult {
  sampleName: string;
  params: AnalysisParams;
  measuredPeaks: MeasuredPeak[];
  /** 全相共通のゼロシフト (deg) */
  globalZeroShift: number;
  results: PhaseResult[];
  unmatchedPeaks: MeasuredPeak[];
  /** 解析全体への警告(UI バナー表示用) */
  warnings: string[];
}
