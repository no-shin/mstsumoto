/** 初期状態ファクトリ */

import type { AppState } from '../core/types';
import { DEFAULT_SETTINGS } from '../core/settings';
import { buildBuiltinRefs } from '../core/refs/builtin';

export function createInitialState(): AppState {
  return {
    mode: 'xrd',
    settings: { ...DEFAULT_SETTINGS },
    measured: [],
    refs: buildBuiltinRefs(),
    mhTraces: [],
    mtTraces: [],
    xrdZoomView: null,
    xrdZoomHistory: [],
    mhZoomView: null,
    mhZoomHistory: [],
    mtZoomView: null,
    mtZoomHistory: [],
    xrdPeakAlignments: {},
    xrdMarkerOffsets: {},
    mtTcAnnotations: {},
    mtDerivativeLayout: { d1BaseRatio: 0.2, d2BaseRatio: 0.34 },
    mhLegend: null,
    mtLegend: null,
    probe: null,
    lastSelectedMarkerKey: null,
    lastSelectedMarkerPhase: null,
  };
}
