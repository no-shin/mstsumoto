/** 「読み込み」タブ: 測定/参照ファイルの読み込みと表示名編集テーブル */

import { useRef } from 'react';
import type { GraphMode, MhTrace, MtTrace, RefPhase, XrdTrace } from '../../core/types';
import { palette, markerOptions } from '../../core/types';
import { readFileText } from '../../core/text/encoding';
import { parseMeasured } from '../../core/parse/xrd';
import { parseReference } from '../../core/parse/refPeaks';
import { parseMH } from '../../core/parse/vsmMh';
import { parseMT } from '../../core/parse/vsmMt';
import { buildBuiltinRefs } from '../../core/refs/builtin';
import { referenceMatchesElementFilter } from '../../core/refs/elements';
import { mergeRefs } from '../../core/project/schema';
import { buildDemoState } from '../../core/demo';
import { phaseLabel } from '../../core/xrd/identify';
import { sStr } from '../../core/settings';
import { markerLabel } from '../../plot/svg/build';
import { Fieldset, useStore } from '../common';

function moveItem<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length || from < 0 || from >= arr.length) return arr;
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function LoadTab({ mode }: { mode: GraphMode }) {
  const store = useStore();
  const { state, update } = store;
  const measFiles = useRef<HTMLInputElement>(null);
  const refFiles = useRef<HTMLInputElement>(null);
  const mhFiles = useRef<HTMLInputElement>(null);
  const mtFiles = useRef<HTMLInputElement>(null);

  const loadXrd = async () => {
    const mf = [...(measFiles.current?.files || [])];
    const rf = [...(refFiles.current?.files || [])];
    if (!mf.length && !rf.length) return;
    const defaults = state.refs.filter((r) => r.visible).map((r) => r.id);
    const traces: XrdTrace[] = [];
    for (const f of mf) {
      const tr = parseMeasured(await readFileText(f), f.name, defaults);
      if (tr.points.length) traces.push(tr);
    }
    const loadedRefs: RefPhase[] = [];
    for (let i = 0; i < rf.length; i++) {
      const f = rf[i];
      const ref = parseReference(await readFileText(f), f.name, palette[(state.refs.length + i) % palette.length], {
        visible: true,
      });
      if (ref.peaks.length) loadedRefs.push(ref);
    }
    update(
      (s) => ({ ...s, measured: [...s.measured, ...traces], refs: mergeRefs(s.refs, loadedRefs) }),
      true,
    );
    if (measFiles.current) measFiles.current.value = '';
    if (refFiles.current) refFiles.current.value = '';
  };

  const loadMH = async () => {
    const files = [...(mhFiles.current?.files || [])];
    if (!files.length) return;
    const traces: MhTrace[] = [];
    for (let i = 0; i < files.length; i++) {
      const tr = parseMH(await readFileText(files[i]), files[i].name, state.mhTraces.length + i);
      if (tr.points.length) traces.push(tr);
    }
    update((s) => ({ ...s, mhTraces: [...s.mhTraces, ...traces], mode: 'mh' }), true);
    if (mhFiles.current) mhFiles.current.value = '';
  };

  const loadMT = async () => {
    const files = [...(mtFiles.current?.files || [])];
    if (!files.length) return;
    const traces: MtTrace[] = [];
    for (let i = 0; i < files.length; i++) {
      const tr = parseMT(await readFileText(files[i]), files[i].name, state.mtTraces.length + i);
      if (tr.points.length) traces.push(tr);
    }
    update((s) => ({ ...s, mtTraces: [...s.mtTraces, ...traces], mode: 'mt' }), true);
    if (mtFiles.current) mtFiles.current.value = '';
  };

  const updateMeasured = (i: number, patch: Partial<XrdTrace>, record: boolean | 'edit' = 'edit') =>
    update(
      (s) => ({ ...s, measured: s.measured.map((m, j) => (j === i ? { ...m, ...patch } : m)) }),
      record,
    );
  const updateRef = (i: number, patch: Partial<RefPhase>, record: boolean | 'edit' = 'edit') =>
    update((s) => ({ ...s, refs: s.refs.map((r, j) => (j === i ? { ...r, ...patch } : r)) }), record);

  const refQuery = sStr(state.settings, 'refSearch', '').trim().toLowerCase();
  const elementFilter = sStr(state.settings, 'refElementFilter', '');

  return (
    <>
      <Fieldset legend="読み込み">
        {mode === 'xrd' && (
          <div>
            <div className="stickyNote">
              XRDタブでは測定データと参照ピークを読み込みます。候補相、参照マーカー、ピーク調査はXRD専用です。
            </div>
            <label>測定データ .xy / .txt / .csv（複数可、2列: 2θ intensity）</label>
            <input ref={measFiles} type="file" multiple accept=".xy,.txt,.csv,.dat" />
            <label>参照ピーク .txt / .csv（追加読み込み可、d 2θ I fix h k l 形式など）</label>
            <input ref={refFiles} type="file" multiple accept=".txt,.csv,.dat" />
            <div className="buttonbar">
              <button type="button" onClick={loadXrd}>XRD読み込み/測定追加</button>
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  update(
                    (s) => ({ ...s, refs: [...buildBuiltinRefs(), ...s.refs.filter((r) => !r.builtin)] }),
                    true,
                  )
                }
              >
                内蔵参照を復元
              </button>
              <button type="button" className="secondary" onClick={() => update((s) => buildDemoState(s), true)}>
                内蔵デモ
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => update((s) => ({ ...s, measured: [] }), true)}
              >
                XRD測定クリア
              </button>
            </div>
            <p className="small">
              測定データは表示範囲内で <span className="mono">min→0, max→100</span> に規格化します。参照データも各相ごとに最大強度100へ自動規格化します。
            </p>
          </div>
        )}
        {mode === 'mh' && (
          <div>
            <div className="mhHint">MHタブではVSM/MHデータを読み込み、H–Mループを重ね描きします。</div>
            <label>MH / VSM データ .VSM / .txt / .csv（複数可、H(Oe), M(emu) を自動読取）</label>
            <input ref={mhFiles} type="file" multiple accept=".VSM,.vsm,.txt,.csv,.dat" />
            <div className="buttonbar">
              <button type="button" onClick={loadMH}>MH読み込み/追加</button>
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  update((s) => ({ ...s, mhTraces: [], mhZoomView: null, mhZoomHistory: [] }), true)
                }
              >
                MHクリア
              </button>
            </div>
          </div>
        )}
        {mode === 'mt' && (
          <div>
            <div className="mtHint">
              MTタブではVSM/MTデータを読み込み、dM/dT・d²M/dT²とT<sub>C</sub>候補を求めます。
            </div>
            <label>MT / VSM データ .VSM / .txt / .csv（複数可、Temp., M(emu) を自動読取）</label>
            <input ref={mtFiles} type="file" multiple accept=".VSM,.vsm,.txt,.csv,.dat" />
            <div className="buttonbar">
              <button type="button" onClick={loadMT}>MT読み込み/追加</button>
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  update((s) => ({ ...s, mtTraces: [], mtZoomView: null, mtZoomHistory: [] }), true)
                }
              >
                MTクリア
              </button>
            </div>
          </div>
        )}
      </Fieldset>
      {mode === 'xrd' && (
        <Fieldset legend="XRDデータ・参照相の表示名">
          <div className="stickyNote">
            測定データはリスト順に縦積みされます。順番ボタンで上下を入れ替えられます。表示名の文字が各グラフ右側に表示されます。参照相はグラフごとに個別指定できます。
          </div>
          <label>測定データ</label>
          <div className="editbox">
            <table>
              <thead>
                <tr>
                  <th className="center">使用</th>
                  <th>順番</th>
                  <th>元ファイル</th>
                  <th>表示名/コメント</th>
                  <th>このグラフに表示する参照相</th>
                </tr>
              </thead>
              <tbody>
                {state.measured.map((m, i) => (
                  <tr key={m.id}>
                    <td className="center">
                      <input
                        type="checkbox"
                        checked={m.visible}
                        onChange={(e) => updateMeasured(i, { visible: e.target.checked }, true)}
                      />
                    </td>
                    <td>
                      <div className="traceTools">
                        <button
                          type="button"
                          title="上へ"
                          onClick={() => update((s) => ({ ...s, measured: moveItem(s.measured, i, i - 1) }), true)}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          title="下へ"
                          onClick={() => update((s) => ({ ...s, measured: moveItem(s.measured, i, i + 1) }), true)}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          title="削除"
                          onClick={() =>
                            update((s) => ({ ...s, measured: s.measured.filter((_, j) => j !== i) }), true)
                          }
                        >
                          削除
                        </button>
                      </div>
                    </td>
                    <td>
                      <div>{m.rawName}</div>
                      <div className="mini mono">元ファイル</div>
                    </td>
                    <td>
                      <input
                        className="nameInput"
                        type="text"
                        value={m.displayName}
                        placeholder="例: 1200C"
                        onFocus={store.editBegin}
                        onChange={(e) =>
                          updateMeasured(i, {
                            displayName: e.target.value,
                            name: e.target.value,
                            comment: e.target.value,
                          })
                        }
                      />
                    </td>
                    <td>
                      <div className="refchips">
                        {state.refs.map((r) => (
                          <label className="refchip" key={r.id} title={phaseLabel(r)}>
                            <input
                              type="checkbox"
                              checked={m.activeRefs.includes(r.id)}
                              onChange={(e) => {
                                const set = new Set(m.activeRefs);
                                if (e.target.checked) set.add(r.id);
                                else set.delete(r.id);
                                updateMeasured(i, { activeRefs: [...set] }, true);
                              }}
                            />
                            <span style={{ color: r.color }}>{markerLabel(r.marker || 'triangle_down')}</span>
                            {phaseLabel(r)}
                          </label>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <label style={{ marginTop: 10 }}>参照データ</label>
          <div className="grid2">
            <div>
              <input
                id="refSearch"
                type="search"
                placeholder="表示名・ファイル名・phaseで検索"
                value={sStr(state.settings, 'refSearch', '')}
                onChange={(e) => store.setSetting('refSearch', e.target.value)}
              />
            </div>
            <div>
              <input
                id="refElementFilter"
                type="text"
                placeholder="元素フィルター 例: Ba Sn Fe O"
                value={elementFilter}
                onFocus={store.editBegin}
                onChange={(e) => store.setSetting('refElementFilter', e.target.value)}
              />
              <div className="small">空欄: 全相 / 入力元素をすべて含む相だけ表示・同定に使用</div>
            </div>
          </div>
          <div className="buttonbar" style={{ margin: 0 }}>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                store.setSetting('refSearch', '');
                store.setSetting('refElementFilter', '');
              }}
            >
              検索・元素フィルターをクリア
            </button>
          </div>
          <div className="editbox">
            <table>
              <thead>
                <tr>
                  <th className="center">使用</th>
                  <th>色</th>
                  <th>記号</th>
                  <th>元ファイル</th>
                  <th>表示名</th>
                </tr>
              </thead>
              <tbody>
                {state.refs.map((r, i) => {
                  const searchable = [r.displayName, r.name, r.rawName, phaseLabel(r)].join(' ').toLowerCase();
                  if (
                    (refQuery && !searchable.includes(refQuery)) ||
                    !referenceMatchesElementFilter(r, elementFilter)
                  )
                    return null;
                  return (
                    <tr key={r.id}>
                      <td className="center">
                        <input
                          type="checkbox"
                          checked={r.visible}
                          onChange={(e) => updateRef(i, { visible: e.target.checked }, true)}
                        />
                      </td>
                      <td className="center">
                        <input
                          type="color"
                          value={r.color}
                          onFocus={store.editBegin}
                          onChange={(e) => updateRef(i, { color: e.target.value })}
                        />
                      </td>
                      <td>
                        <select
                          value={r.marker || 'triangle_down'}
                          onFocus={store.editBegin}
                          onChange={(e) => updateRef(i, { marker: e.target.value })}
                        >
                          {markerOptions.map((m) => (
                            <option key={m} value={m}>
                              {markerLabel(m)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <div>{r.rawName}</div>
                        <div className="mini mono">{r.name}</div>
                      </td>
                      <td>
                        <input
                          type="text"
                          value={phaseLabel(r)}
                          placeholder="例: M-type"
                          onFocus={store.editBegin}
                          onChange={(e) => updateRef(i, { displayName: e.target.value })}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Fieldset>
      )}
    </>
  );
}
