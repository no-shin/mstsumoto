/** プロジェクト(.xrdproj.json)・参照ライブラリ(.xrdrefs.json)のシリアライズ */

import type { AppState, GraphMode, RefPhase } from '../types';
import { DEFAULT_SETTINGS } from '../settings';
import { uniqueId } from '../utils';
import { simplifyPhaseLabel, suggestMarker } from '../refs/labels';

export const PROJECT_VERSION = 9;

export function exportProjectJson(state: AppState): string {
  const project = {
    app: 'XRD / MH / MT Graph Maker',
    version: PROJECT_VERSION,
    savedAt: new Date().toISOString(),
    mode: state.mode,
    settings: state.settings,
    measured: state.measured,
    refs: state.refs,
    mhTraces: state.mhTraces,
    mtTraces: state.mtTraces,
    xrdZoomView: state.xrdZoomView,
    xrdZoomHistory: state.xrdZoomHistory,
    mhZoomView: state.mhZoomView,
    mhZoomHistory: state.mhZoomHistory,
    mtZoomView: state.mtZoomView,
    mtZoomHistory: state.mtZoomHistory,
    mtDerivativeLayout: state.mtDerivativeLayout,
    mtTcAnnotations: state.mtTcAnnotations,
    xrdMarkerOffsets: state.xrdMarkerOffsets,
    xrdPeakAlignments: state.xrdPeakAlignments,
    mhLegend: state.mhLegend,
    mtLegend: state.mtLegend,
  };
  return JSON.stringify(project, null, 2);
}

/** 読み込んだ参照相を正規化(id/displayName/marker の補完) */
export function normalizeRef(r: Partial<RefPhase>): RefPhase {
  return {
    id: r.id || uniqueId('ref'),
    name: r.name || '',
    rawName: r.rawName || r.name || '',
    displayName: r.displayName || simplifyPhaseLabel(r.name || r.rawName),
    visible: r.visible ?? true,
    builtin: Boolean(r.builtin),
    color: r.color || '#e11d48',
    marker: r.marker || suggestMarker(r.displayName || r.name),
    peaks: Array.isArray(r.peaks) ? r.peaks : [],
  };
}

export function importProjectJson(text: string, current: AppState): AppState {
  const project = JSON.parse(text);
  const mode: GraphMode = ['xrd', 'mh', 'mt'].includes(project.mode) ? project.mode : current.mode;
  return {
    ...current,
    mode,
    settings: { ...DEFAULT_SETTINGS, ...(project.settings || {}) },
    measured: Array.isArray(project.measured) ? project.measured : current.measured,
    refs: Array.isArray(project.refs) ? project.refs.map(normalizeRef) : current.refs,
    mhTraces: Array.isArray(project.mhTraces) ? project.mhTraces : current.mhTraces,
    mtTraces: Array.isArray(project.mtTraces)
      ? project.mtTraces.map((t: Record<string, unknown>) => ({
          ...t,
          adoptedTcList: Array.isArray(t.adoptedTcList)
            ? t.adoptedTcList
            : Array.isArray(t.tcAccepted)
              ? t.tcAccepted
              : [],
        }))
      : current.mtTraces,
    xrdZoomView: project.xrdZoomView ? { ...project.xrdZoomView } : project.zoomView ? { ...project.zoomView } : null,
    xrdZoomHistory: Array.isArray(project.xrdZoomHistory)
      ? project.xrdZoomHistory
      : Array.isArray(project.zoomHistory)
        ? project.zoomHistory
        : [],
    mhZoomView: project.mhZoomView ? { ...project.mhZoomView } : null,
    mhZoomHistory: Array.isArray(project.mhZoomHistory) ? project.mhZoomHistory : [],
    mtZoomView: project.mtZoomView ? { ...project.mtZoomView } : null,
    mtZoomHistory: Array.isArray(project.mtZoomHistory) ? project.mtZoomHistory : [],
    mtDerivativeLayout: project.mtDerivativeLayout || { d1BaseRatio: 0.2, d2BaseRatio: 0.34 },
    mtTcAnnotations: project.mtTcAnnotations || {},
    xrdMarkerOffsets: project.xrdMarkerOffsets || {},
    xrdPeakAlignments: project.xrdPeakAlignments || {},
    mhLegend: project.mhLegend ? { ...project.mhLegend } : null,
    mtLegend: project.mtLegend ? { ...project.mtLegend } : null,
    probe: null,
  };
}

export function exportRefLibraryJson(refs: RefPhase[]): string {
  return JSON.stringify(
    {
      app: 'XRD Graph Maker reference library',
      version: 1,
      savedAt: new Date().toISOString(),
      refs,
    },
    null,
    2,
  );
}

export function importRefLibraryJson(text: string): RefPhase[] {
  const data = JSON.parse(text);
  const refs = Array.isArray(data) ? data : Array.isArray(data.refs) ? data.refs : [];
  if (!refs.length) throw new Error('参照データが見つかりません。');
  return refs.map(normalizeRef);
}

/** 同名参照の重複を避けて追加 */
export function mergeRefs(existing: RefPhase[], added: RefPhase[]): RefPhase[] {
  const out = [...existing];
  for (const ref of added) {
    const key = `${ref.rawName}|${ref.displayName || ref.name}`;
    const exists = out.some((r) => `${r.rawName}|${r.displayName || r.name}` === key);
    if (!exists) out.push(ref);
  }
  return out;
}
