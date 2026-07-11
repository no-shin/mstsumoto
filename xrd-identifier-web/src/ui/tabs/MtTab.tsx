/** 「MT設定」タブ: 軸・微分・Tc解析・データ編集 */

import { useState } from 'react';
import type { MtTrace } from '../../core/types';
import { mtAcceptedTcList, mtDisplayName } from '../../core/mt/derivative';
import { mtTcCandidates } from '../../core/mt/tc';
import { CheckField, Fieldset, NumField, SelectField, TextField, useStore } from '../common';

function moveItem<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length || from < 0 || from >= arr.length) return arr;
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function MtTab() {
  const store = useStore();
  const { state, update } = store;
  const [tcSelections, setTcSelections] = useState<Record<string, string>>({});
  const patchTrace = (i: number, patch: Partial<MtTrace>, record: boolean | 'edit' = 'edit') =>
    update((s) => ({ ...s, mtTraces: s.mtTraces.map((t, j) => (j === i ? { ...t, ...patch } : t)) }), record);

  return (
    <Fieldset legend="MTデータ・表示設定">
      <div className="mtHint">
        MTのVSMファイルから <span className="mono">Temp.(℃)</span> と <span className="mono">M(emu)</span> を読み込みます。一次微分・二次微分は表示ON/OFF可能で、T<sub>C</sub>は二次微分の極大値から候補を自動提案します。
      </div>
      <div className="sectionLabel">軸範囲</div>
      <div className="grid3">
        <NumField id="mtXMin" label="T min / ℃" step="10" />
        <NumField id="mtXMax" label="T max / ℃" step="10" />
        <SelectField
          id="mtAutoY"
          label="Y軸範囲"
          options={[
            ['auto', '自動'],
            ['manual', '手動'],
          ]}
        />
      </div>
      <div className="grid3">
        <NumField id="mtYMin" label="M min" step="0.01" />
        <NumField id="mtYMax" label="M max" step="0.01" />
        <SelectField
          id="mtMassMode"
          label="磁化換算"
          options={[
            ['raw', 'M(emu)のまま'],
            ['auto', 'ファイル質量で emu/g'],
            ['manual', '指定質量で emu/g'],
            ['norm', '0–100に規格化'],
          ]}
        />
      </div>
      <div className="grid3">
        <NumField id="mtManualMass" label="指定質量 / g" step="0.0001" min="0" />
        <NumField id="mtSmooth" label="MT平滑化 window" step="2" min="1" />
        <NumField id="mtPointStep" label="点の間引き" min="1" step="1" />
      </div>
      <div className="sectionLabel">微分・Tc解析</div>
      <div className="grid3">
        <CheckField id="mtShowD1" label="dM/dTを表示" />
        <CheckField id="mtShowD2" label="d²M/dT²を表示" />
        <NumField id="mtDerivativeSmooth" label="微分フィット window" step="2" min="1" />
      </div>
      <div className="grid2">
        <NumField id="mtD2PreSmooth" label="二重微分 前平滑化 window" step="2" min="1" />
        <NumField id="mtTcLabelFont" label="Tcラベル文字サイズ / px" step="1" min="8" max="72" />
      </div>
      <div className="buttonbar">
        <button
          type="button"
          className="secondary"
          onClick={() => update((s) => ({ ...s, mtTcAnnotations: {} }), true)}
        >
          Tcラベル・矢印を自動配置に戻す
        </button>
      </div>
      <div className="grid2">
        <NumField id="mtD1Scale" label="dM/dT 表示倍率 / %" step="1" min="1" max="100" />
        <NumField id="mtD2Scale" label="d²M/dT² 表示倍率 / %" step="1" min="1" max="100" />
      </div>
      <div className="grid2">
        <NumField id="mtD1Pos" label="dM/dT 縦位置 / %" step="1" min="0" max="100" />
        <NumField id="mtD2Pos" label="d²M/dT² 縦位置 / %" step="1" min="0" max="100" />
      </div>
      <div className="grid3">
        <NumField id="mtTcMin" label="Tc探索 Tmin / ℃" step="10" />
        <NumField id="mtTcMax" label="Tc探索 Tmax / ℃" step="10" />
        <NumField id="mtTcCandidateCount" label="Tc候補数" step="1" min="1" max="10" />
      </div>
      <div className="sectionLabel">図設定</div>
      <div className="grid2">
        <TextField id="mtXAxisLabel" label="X軸ラベル" />
        <TextField id="mtYAxisLabel" label="Y軸ラベル" />
      </div>
      <div className="grid2">
        <NumField id="mtXTick" label="X major tick interval" step="10" min="0" />
        <NumField id="mtYTick" label="Y major tick interval" step="0.01" min="0" />
      </div>
      <div className="grid3">
        <NumField id="mtXLabelEvery" label="X 数値ラベル間隔（目盛ごと）" min="1" step="1" />
        <NumField id="mtYLabelEvery" label="Y 数値ラベル間隔（目盛ごと）" min="1" step="1" />
        <CheckField id="mtMinorTicks" label="補助目盛" bold />
      </div>
      <div className="grid2">
        <NumField id="mtSvgW" label="図幅" placeholder="全体設定" step="10" min="320" />
        <NumField id="mtSvgH" label="図高" placeholder="全体設定" step="10" min="240" />
      </div>
      <div className="grid2">
        <NumField id="mtMarginL" label="左余白" step="5" min="30" />
        <NumField id="mtMarginR" label="右余白" step="5" min="20" />
      </div>
      <div className="grid2">
        <NumField id="mtMarginT" label="上余白" step="5" min="10" />
        <NumField id="mtMarginB" label="下余白" step="5" min="40" />
      </div>
      <div className="grid2">
        <NumField id="mtFontSize" label="フォントサイズ" placeholder="全体設定" step="1" min="8" />
        <NumField id="mtLineWidth" label="線幅" placeholder="全体設定" step="0.1" min="0.2" />
      </div>
      <div className="grid2">
        <CheckField id="mtShowZero" label="0ラインを表示" />
        <CheckField id="mtMirrorTicks" label="上・右にも同じ目盛り" />
      </div>
      <div className="sectionLabel">Tc採用</div>
      <label>読み込み済みMTデータ</label>
      <div className="editbox">
        <table className="mtTable">
          <thead>
            <tr>
              <th className="center">使用</th>
              <th>順番</th>
              <th>色</th>
              <th>元ファイル</th>
              <th>凡例名</th>
              <th>質量(g)</th>
              <th>
                T<sub>C</sub>候補
              </th>
              <th>採用</th>
              <th>点数</th>
            </tr>
          </thead>
          <tbody>
            {state.mtTraces.map((t, i) => {
              const cands = mtTcCandidates(t, state.settings);
              const acceptedList = mtAcceptedTcList(t);
              const acceptedTemps = acceptedList.map((a) => Number(a.temp)).filter(Number.isFinite);
              const fallback = acceptedTemps.length
                ? String(acceptedTemps[acceptedTemps.length - 1])
                : cands[0]
                  ? String(cands[0].temp)
                  : '';
              const selected = tcSelections[t.id] ?? fallback;
              const accepted = acceptedTemps.length
                ? acceptedTemps.map((v) => `${v.toFixed(1)} degC`).join(', ')
                : '未採用';
              return (
                <tr key={t.id}>
                  <td className="center">
                    <input
                      type="checkbox"
                      checked={t.visible !== false}
                      onChange={(e) => patchTrace(i, { visible: e.target.checked }, true)}
                    />
                  </td>
                  <td className="traceTools">
                    <button type="button" onClick={() => update((s) => ({ ...s, mtTraces: moveItem(s.mtTraces, i, i - 1) }), true)}>↑</button>
                    <button type="button" onClick={() => update((s) => ({ ...s, mtTraces: moveItem(s.mtTraces, i, i + 1) }), true)}>↓</button>
                    <button type="button" onClick={() => update((s) => ({ ...s, mtTraces: s.mtTraces.filter((_, j) => j !== i) }), true)}>削除</button>
                  </td>
                  <td>
                    <input
                      className="mhColor"
                      type="color"
                      value={t.color}
                      onFocus={store.editBegin}
                      onChange={(e) => patchTrace(i, { color: e.target.value })}
                    />
                  </td>
                  <td className="mini">{t.rawName || ''}</td>
                  <td>
                    <input
                      type="text"
                      value={mtDisplayName(t)}
                      onFocus={store.editBegin}
                      onChange={(e) => patchTrace(i, { displayName: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={Number.isFinite(Number(t.mass)) && t.mass !== null ? String(t.mass) : ''}
                      step="0.0001"
                      min="0"
                      onFocus={store.editBegin}
                      onChange={(e) => {
                        const m = Number(e.target.value);
                        patchTrace(i, { mass: Number.isFinite(m) && m > 0 ? m : null });
                      }}
                    />
                  </td>
                  <td>
                    <select
                      value={selected}
                      onChange={(e) => setTcSelections((prev) => ({ ...prev, [t.id]: e.target.value }))}
                    >
                      {cands.length ? (
                        cands.map((c, ci) => {
                          const methodLabel =
                            c.method === 'steepest_slope'
                              ? 'dM/dT min'
                              : c.method === 'second_derivative_max'
                                ? 'd2 max'
                                : 'd2 min';
                          const conf = Number.isFinite(c.confidence)
                            ? ` / ${Math.round(c.confidence * 100)}%`
                            : '';
                          return (
                            <option key={ci} value={String(c.temp)}>
                              {ci + 1}: {c.temp.toFixed(1)} °C / {methodLabel}
                              {conf}
                            </option>
                          );
                        })
                      ) : (
                        <option value="">候補なし</option>
                      )}
                    </select>
                    <div className="mini">採用中: {accepted}</div>
                  </td>
                  <td className="traceTools">
                    <button
                      type="button"
                      onClick={() => {
                        const temp = Number(selected);
                        if (!Number.isFinite(temp)) return;
                        const cand =
                          cands.find((c) => Math.abs(Number(c.temp) - temp) < 1e-6) ||
                          ({ temp, method: 'manual', confidence: 0, score: undefined } as const);
                        if (acceptedList.some((a) => Math.abs(Number(a.temp) - temp) < 1e-6)) return;
                        patchTrace(
                          i,
                          {
                            adoptedTcList: [
                              ...acceptedList,
                              { temp, method: cand.method || 'manual', score: cand.score, confidence: cand.confidence },
                            ],
                          },
                          true,
                        );
                      }}
                    >
                      採用
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const temp = Number(selected);
                        if (Number.isFinite(temp) && acceptedList.length) {
                          patchTrace(
                            i,
                            { adoptedTcList: acceptedList.filter((a) => Math.abs(Number(a.temp) - temp) >= 1e-6) },
                            true,
                          );
                        } else {
                          patchTrace(i, { adoptedTcList: [] }, true);
                        }
                      }}
                    >
                      解除
                    </button>
                  </td>
                  <td className="right">{(t.points || []).length.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="small">
        候補のT<sub>C</sub>を採用すると、グラフ内に矢印と枠付きラベル <span className="mono">T_C = 377°C</span> のように表示します。左ドラッグで作った四角範囲を拡大、右クリックで1つ前のズームに戻せます。
      </p>
    </Fieldset>
  );
}
