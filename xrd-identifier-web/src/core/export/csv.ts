/** 解析結果のモード別 CSV 生成 */

import type { AppState } from '../types';
import { sBool, sStr } from '../settings';
import type { Analysis } from '../xrd/identify';
import { mhAnalysisRows, mhDisplayName, mhMassForTrace, mhPlotPoints } from '../mh/analysis';
import { mtAcceptedTcList, mtDerivatives, mtDisplayName, mtMassForTrace, mtPlotPoints } from '../mt/derivative';
import { solveHexLattice, xrdAlignmentRows } from '../xrd/lattice';

function toCsv(rows: (string | number | boolean | null | undefined)[][]): string {
  return rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
}

export function makeMtCsv(state: AppState): string {
  const s = state.settings;
  const rows: (string | number | boolean)[][] = [
    ['sample', 'Temperature_C', 'M', 'mass_g', 'source_file', 'series'],
  ];
  state.mtTraces
    .filter((t) => t.visible !== false)
    .forEach((t) => {
      const base = mtPlotPoints(t, s);
      const mass = mtMassForTrace(t, s);
      base.forEach((p) =>
        rows.push([mtDisplayName(t), p.x.toFixed(6), p.y.toExponential(8), mass || '', t.rawName || '', 'M']),
      );
      if (sBool(s, 'mtShowD1', false))
        mtDerivatives(t, s).d1.forEach((p) =>
          rows.push([mtDisplayName(t), p.x.toFixed(6), p.y.toExponential(8), mass || '', t.rawName || '', 'dM/dT']),
        );
      if (sBool(s, 'mtShowD2', false))
        mtDerivatives(t, s).d2.forEach((p) =>
          rows.push([mtDisplayName(t), p.x.toFixed(6), p.y.toExponential(8), mass || '', t.rawName || '', 'd2M/dT2']),
        );
    });
  rows.push([]);
  rows.push(['tc_sample', 'Tc_C', 'method', 'confidence', 'mtSmooth', 'mtDerivativeSmooth', 'mtD2PreSmooth', 'adopted']);
  state.mtTraces
    .filter((t) => t.visible !== false)
    .forEach((t) => {
      mtAcceptedTcList(t).forEach((a) =>
        rows.push([
          mtDisplayName(t),
          a.temp,
          a.method || 'manual',
          a.confidence ?? '',
          sStr(s, 'mtSmooth', ''),
          sStr(s, 'mtDerivativeSmooth', ''),
          sStr(s, 'mtD2PreSmooth', ''),
          true,
        ]),
      );
    });
  return toCsv(rows);
}

export function makeMhCsv(state: AppState): string {
  const s = state.settings;
  const rows: (string | number | boolean)[][] = [['sample', 'H_kOe', 'M', 'mass_g', 'source_file']];
  state.mhTraces
    .filter((t) => t.visible !== false)
    .forEach((t) => {
      const pts = mhPlotPoints(t, s);
      const mass = mhMassForTrace(t, s);
      pts.forEach((p) => rows.push([mhDisplayName(t), p.x.toFixed(6), p.y.toExponential(8), mass || '', t.rawName || '']));
    });
  rows.push([]);
  rows.push([
    'analysis_sample',
    'Hc_plus_kOe',
    'Hc_minus_kOe',
    'Hc_mean_kOe',
    'Mr_plus',
    'Mr_minus',
    'Mr_mean',
    'Ms',
    'Mr_over_Ms',
    'loop_area',
  ]);
  mhAnalysisRows(state.mhTraces, s).forEach((r) =>
    rows.push([r.name, r.hcPlus, r.hcMinus, r.hcMean, r.mrPlus, r.mrMinus, r.mrMean, r.ms, r.mrMs, r.area]),
  );
  return toCsv(rows);
}

export function makeXrdCsv(state: AppState, analyses: Analysis[]): string {
  const rows: (string | number | boolean)[][] = [
    [
      'section',
      'sample',
      'phase',
      'score_percent',
      'main_peak',
      'matched',
      'expected',
      'missing_strong',
      'note',
      'obs_2theta',
      'intensity_norm',
      'ref_2theta',
      'delta_2theta',
      'h',
      'k',
      'l',
      'matched_peak',
    ],
  ];
  for (const a of analyses) {
    for (const c of a.candidates || []) {
      rows.push([
        'candidate',
        c.sample,
        c.phase,
        c.score.toFixed(3),
        c.main,
        c.matched,
        c.expected,
        c.missingStrong,
        c.note,
        '', '', '', '', '', '', '', '',
      ]);
    }
    for (const p of a.peaks) {
      const m = p.match;
      rows.push([
        'peak',
        a.sample,
        m ? m.ref.phaseLabel || m.ref.phase || '' : '',
        '', '', '', '', '', '',
        p.x.toFixed(5),
        p.y.toFixed(3),
        m ? m.ref.angle.toFixed(5) : '',
        m ? m.delta.toFixed(5) : '',
        m ? (m.ref.h ?? '') : '',
        m ? (m.ref.k ?? '') : '',
        m ? (m.ref.l ?? '') : '',
        Boolean(m),
      ]);
    }
  }
  const latticeRows = xrdAlignmentRows(state);
  const latticeFit = solveHexLattice(latticeRows);
  const residuals = new Map((latticeFit.used || []).map((r) => [r.key, r.residual]));
  if (latticeFit.ok) {
    rows.push([
      'lattice_fit',
      '', '', '', '', '', '', '',
      `a=${latticeFit.a!.toFixed(5)}; c=${latticeFit.c!.toFixed(5)}; n=${latticeFit.used.length}; rms=${latticeFit.rms!.toExponential(4)}`,
      '', '', '', '', '', '', '', '',
    ]);
  }
  for (const r of latticeRows) {
    const residual = residuals.get(r.key);
    rows.push([
      'lattice_peak',
      '',
      r.referenceName || '',
      '', '', '', '', '',
      `use=${r.use !== false}; d_obs=${Number.isFinite(r.dObs) ? r.dObs.toFixed(5) : ''}; residual=${Number.isFinite(residual as number) ? (residual as number).toExponential(4) : ''}`,
      '', '',
      Number(r.originalTwoTheta).toFixed(5),
      Number(r.correctedTwoTheta).toFixed(5),
      r.h ?? '',
      r.k ?? '',
      r.l ?? '',
      Number.isFinite(Number(r.matchedMeasuredPeakTwoTheta))
        ? Number(r.matchedMeasuredPeakTwoTheta).toFixed(5)
        : '',
    ]);
  }
  return toCsv(rows);
}

export function makeLatticeCsv(state: AppState): string {
  const rows = xrdAlignmentRows(state);
  const fit = solveHexLattice(rows);
  const out: (string | number | boolean)[][] = [
    ['section', 'phase', 'original_2theta', 'corrected_2theta', 'matched_peak_2theta', 'h', 'k', 'l', 'd_obs_A', 'residual'],
  ];
  if (fit.ok)
    out.push([
      'fit',
      '', '', '', '', '', '', '', '',
      `a=${fit.a}; c=${fit.c}; c/a=${fit.c! / fit.a!}; n=${fit.used.length}; rms=${fit.rms}`,
    ]);
  const residuals = new Map((fit.used || []).map((r) => [r.key, r.residual]));
  rows.forEach((r) =>
    out.push([
      'peak',
      r.referenceName || '',
      r.originalTwoTheta,
      r.correctedTwoTheta,
      r.matchedMeasuredPeakTwoTheta,
      r.h ?? '',
      r.k ?? '',
      r.l ?? '',
      r.dObs,
      residuals.get(r.key) ?? '',
    ]),
  );
  return toCsv(out);
}

export function currentGraphStem(state: AppState): string {
  const project = sStr(state.settings, 'projectName', 'graph').trim() || 'graph';
  const stem = project.replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_') || 'graph';
  if (state.mode === 'mh') return `${stem}_mh_graph`;
  if (state.mode === 'mt') return `${stem}_mt_graph`;
  return `${stem}_xrd_graph`;
}
