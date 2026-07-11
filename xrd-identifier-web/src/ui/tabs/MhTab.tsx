/** 「MH設定」タブ: 軸・換算・重ね描きデータ編集と解析表 */

import type { MhTrace } from '../../core/types';
import { mhAnalysisRows, mhDisplayName } from '../../core/mh/analysis';
import { CheckField, Fieldset, NumField, SelectField, TextField, useStore } from '../common';

function moveItem<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length || from < 0 || from >= arr.length) return arr;
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

const f = (v: number) => (Number.isFinite(v) ? Number(v).toFixed(5) : '—');

export function MhTab() {
  const store = useStore();
  const { state, update } = store;
  const patchTrace = (i: number, patch: Partial<MhTrace>, record: boolean | 'edit' = 'edit') =>
    update((s) => ({ ...s, mhTraces: s.mhTraces.map((t, j) => (j === i ? { ...t, ...patch } : t)) }), record);
  const analysis = mhAnalysisRows(state.mhTraces, state.settings);

  return (
    <Fieldset legend="MHデータ・表示設定">
      <div className="mhHint">
        VSMファイルの <span className="mono">sample weight</span> を読んで、M(emu) を質量で割って emu/g に換算します。H(Oe) は kOe に自動変換します。複数ファイルは同じ軸上に重ね描きされます。
      </div>
      <div className="sectionLabel">軸範囲</div>
      <div className="grid3">
        <NumField id="mhXMin" label="H min / kOe" step="0.5" />
        <NumField id="mhXMax" label="H max / kOe" step="0.5" />
        <SelectField
          id="mhAutoY"
          label="Y軸範囲"
          options={[
            ['manual', '手動'],
            ['auto', '自動'],
          ]}
        />
      </div>
      <div className="grid3">
        <NumField id="mhYMin" label="M min" step="5" />
        <NumField id="mhYMax" label="M max" step="5" />
        <SelectField
          id="mhMassMode"
          label="磁化換算"
          options={[
            ['auto', 'ファイル質量で emu/g'],
            ['manual', '指定質量で emu/g'],
            ['raw', 'M(emu)のまま'],
          ]}
        />
      </div>
      <div className="grid3">
        <NumField id="mhManualMass" label="指定質量 / g" step="0.0001" min="0" />
        <SelectField
          id="mhSmooth"
          label="平滑化"
          options={[
            ['0', 'なし'],
            ['3', '3点'],
            ['5', '5点'],
            ['9', '9点'],
          ]}
        />
        <NumField id="mhPointStep" label="点の間引き" min="1" step="1" />
      </div>
      <div className="sectionLabel">図設定</div>
      <div className="grid2">
        <TextField id="mhXAxisLabel" label="X軸ラベル" />
        <TextField id="mhYAxisLabel" label="Y軸ラベル" />
      </div>
      <div className="grid2">
        <NumField id="mhXTick" label="X major tick interval" step="0.5" min="0" />
        <NumField id="mhYTick" label="Y major tick interval" step="1" min="0" />
      </div>
      <div className="grid3">
        <NumField id="mhXLabelEvery" label="X 数値ラベル間隔（目盛ごと）" min="1" step="1" />
        <NumField id="mhYLabelEvery" label="Y 数値ラベル間隔（目盛ごと）" min="1" step="1" />
        <CheckField id="mhMinorTicks" label="補助目盛" bold />
      </div>
      <div className="grid2">
        <NumField id="mhSvgW" label="図幅" placeholder="全体設定" step="10" min="320" />
        <NumField id="mhSvgH" label="図高" placeholder="全体設定" step="10" min="240" />
      </div>
      <div className="grid2">
        <NumField id="mhMarginL" label="左余白" step="5" min="30" />
        <NumField id="mhMarginR" label="右余白" step="5" min="20" />
      </div>
      <div className="grid2">
        <NumField id="mhMarginT" label="上余白" step="5" min="10" />
        <NumField id="mhMarginB" label="下余白" step="5" min="40" />
      </div>
      <div className="grid2">
        <NumField id="mhFontSize" label="フォントサイズ" placeholder="全体設定" step="1" min="8" />
        <NumField id="mhLineWidth" label="線幅" placeholder="全体設定" step="0.1" min="0.2" />
      </div>
      <div className="grid2">
        <CheckField id="mhShowZero" label="0ラインを表示" />
        <CheckField id="mhMirrorTicks" label="上・右にも同じ目盛り" />
      </div>
      <div className="sectionLabel">重ね描きデータ</div>
      <label>読み込み済みMHデータ</label>
      <div className="editbox">
        <table className="mhTable">
          <thead>
            <tr>
              <th className="center">使用</th>
              <th>順番</th>
              <th>色</th>
              <th>元ファイル</th>
              <th>凡例名</th>
              <th>質量(g)</th>
              <th>点数</th>
            </tr>
          </thead>
          <tbody>
            {state.mhTraces.map((t, i) => (
              <tr key={t.id}>
                <td className="center">
                  <input
                    type="checkbox"
                    checked={t.visible !== false}
                    onChange={(e) => patchTrace(i, { visible: e.target.checked }, true)}
                  />
                </td>
                <td className="traceTools">
                  <button type="button" onClick={() => update((s) => ({ ...s, mhTraces: moveItem(s.mhTraces, i, i - 1) }), true)}>↑</button>
                  <button type="button" onClick={() => update((s) => ({ ...s, mhTraces: moveItem(s.mhTraces, i, i + 1) }), true)}>↓</button>
                  <button type="button" onClick={() => update((s) => ({ ...s, mhTraces: s.mhTraces.filter((_, j) => j !== i) }), true)}>削除</button>
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
                    value={mhDisplayName(t)}
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
                <td className="right">{(t.points || []).length.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="editbox" style={{ marginTop: 10 }}>
        <div className="sectionLabel">MH解析結果</div>
        <table>
          <thead>
            <tr>
              <th>sample</th>
              <th>Hc+ / kOe</th>
              <th>Hc- / kOe</th>
              <th>Hc平均 / kOe</th>
              <th>Mr+</th>
              <th>Mr-</th>
              <th>Mr平均</th>
              <th>Ms</th>
              <th>Mr/Ms</th>
              <th>loop area</th>
            </tr>
          </thead>
          <tbody>
            {analysis.length ? (
              analysis.map((r) => (
                <tr key={r.name}>
                  <td>{r.name}</td>
                  <td>{f(r.hcPlus)}</td>
                  <td>{f(r.hcMinus)}</td>
                  <td>{f(r.hcMean)}</td>
                  <td>{f(r.mrPlus)}</td>
                  <td>{f(r.mrMinus)}</td>
                  <td>{f(r.mrMean)}</td>
                  <td>{f(r.ms)}</td>
                  <td>{f(r.mrMs)}</td>
                  <td>{f(r.area)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={10}>解析可能なMHデータがありません。</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="small">
        凡例名には <span className="mono">T_s</span>、<span className="mono">Fe^{'{3+}'}</span>、
        <span className="mono">\theta</span> などが使えます。左ドラッグで作った四角範囲を拡大、右クリックで1つ前のズームに戻せます。
      </p>
    </Fieldset>
  );
}
