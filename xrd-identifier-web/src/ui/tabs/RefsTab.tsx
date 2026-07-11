/** 「参照 / 格子定数」タブ: 参照マーカー表示設定と格子定数フィット */

import { hklText } from '../../core/parse/refPeaks';
import { phaseLabel } from '../../core/xrd/identify';
import {
  autoAssignLatticePeaks,
  solveHexLattice,
  xrdAlignmentRows,
} from '../../core/xrd/lattice';
import { makeLatticeCsv } from '../../core/export/csv';
import { safeFileStem } from '../../core/utils';
import { sStr } from '../../core/settings';
import { downloadText } from '../../plot/exportImage';
import { CheckField, Fieldset, NumField, RangeField, SelectField, useStore } from '../common';

export function RefsTab() {
  const store = useStore();
  const { state, update } = store;
  const rows = xrdAlignmentRows(state);
  const fit = solveHexLattice(rows);
  const residuals = new Map((fit.used || []).map((r) => [r.key, r.residual]));

  return (
    <Fieldset legend="参照マーカー・表示設定">
      <div className="grid2">
        <SelectField
          id="refSelect"
          label="表示する参照相"
          options={[['all', 'すべて表示'], ...state.refs.map((r): [string, string] => [r.id, phaseLabel(r)])]}
        />
        <SelectField
          id="orientationMode"
          label="表示フィルタ"
          options={[
            ['all', 'すべて'],
            ['h00', 'h00 のみ'],
            ['0k0', '0k0 のみ'],
            ['00l', '00l のみ'],
            ['hk0', 'hk0 のみ'],
            ['h0l', 'h0l のみ'],
            ['0kl', '0kl のみ'],
          ]}
        />
      </div>
      <div className="grid3">
        <NumField id="tol" label="許容差 / deg" step="0.01" />
        <NumField id="refMinI" label="最小参照強度" step="1" min="0" max="100" />
        <NumField id="markerSize" label="マーカー基準サイズ（全相まとめて）" step="1" min="1" />
      </div>
      <div className="grid2">
        <div>
          <RangeField id="markerScale" label="全マーカー倍率" min="0.25" max="1.50" step="0.05" />
          <div className="small">倍率 {Number(sStr(state.settings, 'markerScale', '0.75')).toFixed(2)}x</div>
        </div>
        <SelectField
          id="autoMarkerScale"
          label="積み上げ時の自動縮小"
          options={[
            ['on', 'ON'],
            ['off', 'OFF'],
          ]}
        />
      </div>
      <div className="grid2">
        <NumField id="markerLift" label="ピーク上距離" step="1" />
        <NumField id="hklMinI" label="強いピークの hkl 表示閾値" step="1" min="0" max="100" />
      </div>
      <CheckField id="showMarkers" label="参照マーカーを表示" />
      <CheckField id="hideUnmatchedMarkers" label="実測ピークが無い角度の参照マーカーを隠す" />
      <div className="grid3">
        <NumField id="markerPeakWindow" label="実測ピーク判定幅 / deg" step="0.01" min="0.01" />
        <NumField id="markerPeakMin" label="小ピーク判定しきい値" step="0.5" min="0" max="100" />
        <NumField id="markerPeakProminence" label="盛り上がり判定 / %" step="0.1" min="0" />
      </div>
      <CheckField id="markerShoulderDetect" label="肩ピーク・幅広ピークも参照マーカー表示の対象にする" />
      <div className="grid2">
        <SelectField
          id="markerMode"
          label="マーカー配置"
          options={[
            ['curve', '測定曲線の上'],
            ['fixed', '各段の上端に固定'],
          ]}
        />
        <NumField id="markerJitter" label="マーカー横ずらし" step="1" />
      </div>
      <div className="grid2">
        <CheckField id="markerDragSnap" label="移動後に実測ピークへ吸着" />
        <NumField id="markerDragSnapTol" label="ピーク吸着幅 / ±deg" step="0.01" min="0.01" max="0.50" />
      </div>
      <div className="grid2">
        <NumField id="markerDragMaxShift" label="参照マーカー最大横移動 / ±deg" step="0.1" min="0.1" max="10" />
        <CheckField id="showOriginalMarkers" label="元の参照位置を薄く表示" />
      </div>
      <p className="small">
        小さいピークの参照マーカーが消える場合は「実測ピーク判定幅」を少し広げるか、「小ピーク判定しきい値」を下げてください。ノイズまで拾う場合は「盛り上がり判定」を上げます。
      </p>
      <CheckField id="markerEach" label="各測定データにマーカーを表示" />
      <CheckField id="showSticks" label="下部に参照スティックを表示（通常はOFF）" />
      <CheckField id="hklLabel" label="強い参照ピークに hkl を表示" />
      <div className="sectionLabel">ピーク位置合わせ・格子定数</div>
      <div className="grid2">
        <SelectField
          id="latticeFitMode"
          label="格子定数計算方法"
          options={[
            ['direct', '通常: 1/d² 最小二乗'],
            ['extrapolation', '精密: extrapolation'],
          ]}
        />
        <NumField id="latticeAutoTol" label="自動対応許容差 Δ2θ / deg" step="0.01" min="0.01" max="0.50" />
      </div>
      <div className="buttonbar">
        <button
          type="button"
          onClick={() => update((s) => ({ ...s, xrdPeakAlignments: autoAssignLatticePeaks(s) }), true)}
        >
          ピークを自動対応
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() =>
            update((s) => {
              const k = s.lastSelectedMarkerKey;
              if (!k) return s;
              const offsets = { ...s.xrdMarkerOffsets };
              const aligns = { ...s.xrdPeakAlignments };
              delete offsets[k];
              delete aligns[k];
              return { ...s, xrdMarkerOffsets: offsets, xrdPeakAlignments: aligns };
            }, true)
          }
        >
          選択マーカーを戻す
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() =>
            update((s) => {
              const phase = s.lastSelectedMarkerPhase;
              if (!phase) return s;
              const offsets = { ...s.xrdMarkerOffsets };
              const aligns = { ...s.xrdPeakAlignments };
              for (const k of Object.keys(aligns)) {
                if (String(aligns[k]?.referenceName || '') === phase) {
                  delete offsets[k];
                  delete aligns[k];
                }
              }
              return { ...s, xrdMarkerOffsets: offsets, xrdPeakAlignments: aligns };
            }, true)
          }
        >
          選択相のマーカーを戻す
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => update((s) => ({ ...s, xrdPeakAlignments: {}, xrdMarkerOffsets: {} }), true)}
        >
          全マーカーを戻す
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() =>
            downloadText(
              `${safeFileStem(sStr(state.settings, 'projectName', 'xrd'))}_lattice.csv`,
              makeLatticeCsv(state),
              'text/csv',
            )
          }
        >
          格子定数CSV
        </button>
      </div>
      <div className="grid2">
        <NumField id="xrdLambda" label="Cu Kα λ / Å" step="0.00001" min="0.1" />
        <div className="status">
          {fit.ok ? (
            <>
              <span className="pill">a = {fit.a!.toFixed(4)} Å</span>
              <span className="pill">c = {fit.c!.toFixed(4)} Å</span>
              <span className="pill">n = {fit.used.length}</span>
              <span className="pill">RMS = {fit.rms!.toExponential(2)}</span>
            </>
          ) : (
            fit.reason
          )}
        </div>
      </div>
      <p className="small">
        グラフ上の参照ピークマーカーを左ドラッグすると補正後2θを保存します。六方晶の式で a, c を最小二乗推定します。
      </p>
      <div className="editbox">
        <table>
          <thead>
            <tr>
              <th>使用</th>
              <th>相</th>
              <th>元2θ</th>
              <th>補正2θ</th>
              <th>測定ピーク</th>
              <th>hkl</th>
              <th>d(obs)</th>
              <th>残差</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((r) => (
                <tr key={r.key}>
                  <td className="center">
                    <input
                      type="checkbox"
                      checked={r.use !== false}
                      onChange={(e) =>
                        update(
                          (s) => ({
                            ...s,
                            xrdPeakAlignments: {
                              ...s.xrdPeakAlignments,
                              [r.key]: { ...s.xrdPeakAlignments[r.key], use: e.target.checked },
                            },
                          }),
                          true,
                        )
                      }
                    />
                  </td>
                  <td>{r.referenceName || ''}</td>
                  <td>{Number(r.originalTwoTheta).toFixed(3)}</td>
                  <td>{Number(r.correctedTwoTheta).toFixed(3)}</td>
                  <td>
                    {Number.isFinite(Number(r.matchedMeasuredPeakTwoTheta))
                      ? Number(r.matchedMeasuredPeakTwoTheta).toFixed(3)
                      : ''}
                  </td>
                  <td>{hklText(r)}</td>
                  <td>{Number.isFinite(r.dObs) ? r.dObs.toFixed(4) : ''}</td>
                  <td>
                    {Number.isFinite(residuals.get(r.key) as number)
                      ? (residuals.get(r.key) as number).toExponential(2)
                      : ''}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8}>参照マーカーをドラッグすると対応表が作成されます。</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Fieldset>
  );
}
