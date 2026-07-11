/** アプリシェル: モード切替・タブ・スプリッター・履歴ドック・グラフと解析テーブル */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { GraphMode } from '../core/types';
import { clamp, num } from '../core/utils';
import { sNum, sStr } from '../core/settings';
import { analyze, probeCandidatesAt, visibleMeasured } from '../core/xrd/identify';
import { mhAnalysisRows } from '../core/mh/analysis';
import { mtAcceptedTcList, mtDisplayName } from '../core/mt/derivative';
import { makeXrdSvg } from '../plot/svg/xrdSvg';
import { makeMHSvg } from '../plot/svg/mhSvg';
import { makeMTSvg } from '../plot/svg/mtSvg';
import { markerLabel } from '../plot/svg/build';
import { ChartPanel } from '../plot/ChartPanel';
import { useAppStore } from '../state/useAppStore';
import { StoreContext } from './common';
import { LoadTab } from './tabs/LoadTab';
import { GraphTab } from './tabs/GraphTab';
import { IdentifyTab } from './tabs/IdentifyTab';
import { RefsTab } from './tabs/RefsTab';
import { ProbeTab } from './tabs/ProbeTab';
import { MhTab } from './tabs/MhTab';
import { MtTab } from './tabs/MtTab';
import { SaveTab } from './tabs/SaveTab';

type TabId = 'files' | 'mh' | 'mt' | 'graph' | 'refs' | 'probe' | 'id' | 'save';

const TAB_DEFS: { id: TabId; label: string; modes: GraphMode[] }[] = [
  { id: 'files', label: '読み込み', modes: ['xrd', 'mh', 'mt'] },
  { id: 'mh', label: 'MH設定', modes: ['mh'] },
  { id: 'mt', label: 'MT設定', modes: ['mt'] },
  { id: 'graph', label: '図設定', modes: ['xrd', 'mh', 'mt'] },
  { id: 'refs', label: '参照', modes: ['xrd'] },
  { id: 'probe', label: 'ピーク調査', modes: ['xrd'] },
  { id: 'id', label: '同定', modes: ['xrd'] },
  { id: 'save', label: '保存', modes: ['xrd', 'mh', 'mt'] },
];

function defaultTabForMode(mode: GraphMode): TabId {
  if (mode === 'mh') return 'mh';
  if (mode === 'mt') return 'mt';
  return 'files';
}

export function App() {
  const store = useAppStore();
  const { state, update } = store;
  const mode = state.mode;
  const [tab, setTab] = useState<TabId>('files');
  const [candidateSample, setCandidateSample] = useState('__all__');
  const mainRef = useRef<HTMLElement>(null);
  const splitterRef = useRef<HTMLDivElement>(null);

  const activeTab: TabId = TAB_DEFS.some((t) => t.id === tab && t.modes.includes(mode))
    ? tab
    : defaultTabForMode(mode);

  const analyses = useMemo(
    () => (mode === 'xrd' ? analyze(state) : []),
    [mode, state],
  );

  const svgText = useMemo(() => {
    if (mode === 'mh') return makeMHSvg(state).svg;
    if (mode === 'mt') return makeMTSvg(state).svg;
    return visibleMeasured(state).length ? makeXrdSvg(state) : '';
  }, [mode, state]);

  // レイアウトスプリッター
  const ratio = clamp(Math.round(sNum(state.settings, 'layoutRatio', 50)), 30, 70);
  useEffect(() => {
    const el = mainRef.current;
    if (el) {
      el.style.setProperty('--left-col', `${ratio}fr`);
      el.style.setProperty('--right-col', `${100 - ratio}fr`);
    }
    try {
      localStorage.setItem('xrd-layout-ratio', String(ratio));
    } catch { /* noop */ }
  }, [ratio]);
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem('xrd-layout-ratio'));
      if (Number.isFinite(saved) && saved >= 30 && saved <= 70)
        update((s) => ({ ...s, settings: { ...s.settings, layoutRatio: String(saved) } }));
    } catch { /* noop */ }
    // 初回のみ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const onSplitterDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const splitter = splitterRef.current;
    const mainEl = mainRef.current;
    if (!splitter || !mainEl) return;
    splitter.classList.add('dragging');
    const move = (ev: PointerEvent) => {
      const r = mainEl.getBoundingClientRect();
      const v = clamp(Math.round(((ev.clientX - r.left) / r.width) * 100), 30, 70);
      update((s) => ({ ...s, settings: { ...s.settings, layoutRatio: String(v) } }));
    };
    const up = () => {
      splitter.classList.remove('dragging');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  // ステータス
  const status = useMemo(() => {
    if (mode === 'mh') {
      const meta = makeMHSvg(state).meta;
      const rows = mhAnalysisRows(state.mhTraces, state.settings);
      const summary = rows
        .map((r) => `${r.name}: Hc=${r.hcMean.toFixed(3)} kOe, Mr/Ms=${r.mrMs.toFixed(3)}`)
        .join(' / ');
      return (
        <>
          <span className="pill">MH {meta.count}件 / {meta.points.toLocaleString()}点</span>
          <span className="pill">H: {meta.xMin.toFixed(2)}〜{meta.xMax.toFixed(2)} kOe</span>
          <span className="pill">M: {meta.yMin.toFixed(2)}〜{meta.yMax.toFixed(2)}</span>
          {state.mhZoomView && (<><br /><span className="pill">MHズーム中</span></>)}
          {summary && (<><br /><span className="pill">MH解析 {summary}</span></>)}
        </>
      );
    }
    if (mode === 'mt') {
      const meta = makeMTSvg(state).meta;
      const accepted = state.mtTraces
        .map((t) => {
          const vals = mtAcceptedTcList(t).map((a) => Number(a.temp)).filter(Number.isFinite);
          return vals.length ? `${mtDisplayName(t)}: ${vals.map((v) => v.toFixed(1)).join(', ')} ℃` : '';
        })
        .filter(Boolean)
        .join(' / ');
      return (
        <>
          <span className="pill">MT {meta.count}件 / {meta.points.toLocaleString()}点</span>
          <span className="pill">T: {meta.xMin.toFixed(1)}〜{meta.xMax.toFixed(1)} ℃</span>
          <span className="pill">M: {meta.yMin.toFixed(4)}〜{meta.yMax.toFixed(4)}</span>
          {state.mtZoomView && (<><br /><span className="pill">MTズーム中</span></>)}
          {accepted && (<><br /><span className="pill">採用T_C {accepted}</span></>)}
        </>
      );
    }
    const measured = visibleMeasured(state);
    const nRef = state.refs.reduce((acc, r) => acc + r.peaks.length, 0);
    if (!measured.length) {
      return (
        <>
          <span className="pill">内蔵/追加参照 {state.refs.length}相 / {nRef}ピーク</span>
          <br />
          必要な参照相にチェックを入れてから測定データを読み込んでください。
        </>
      );
    }
    const nPts = state.measured.reduce((acc, t) => acc + t.points.length, 0);
    return (
      <>
        <span className="pill">測定 {measured.length}件 / {nPts.toLocaleString()}点</span>
        <span className="pill">参照 {state.refs.filter((r) => r.visible).length}相 / {nRef}ピーク</span>
        <br />
        現在の描画範囲: <span className="mono">{sStr(state.settings, 'xMin', '20')}〜{sStr(state.settings, 'xMax', '70')} deg</span>
        {' '}/ 測定値・参照値とも相ごとに max = 100 へ規格化 / 候補%はメインピークと配向補正込みの目安
        {state.xrdZoomView ? ' / ズーム中' : ''}
      </>
    );
  }, [mode, state]);

  const probeRows = state.probe ? probeCandidatesAt(state, state.probe.angle) : [];
  const probeWindow = Math.max(0.01, sNum(state.settings, 'probeWindow', 0.35));
  const candidateLimit = Math.max(1, Math.floor(sNum(state.settings, 'candidateLimit', 12)));
  const visibleAnalyses =
    candidateSample === '__all__'
      ? analyses
      : analyses.filter((a) => String(a.sampleId) === String(candidateSample));

  return (
    <StoreContext.Provider value={store}>
      <header>
        <h1>
          XRD / MH / MT Graph Maker <span className="versionBadge">React/TS port 2026-07</span>
        </h1>
        <p>
          XRD測定データ、VSM/MHデータ、VSM/MTデータを読み込み、論文風のSVG/PNGグラフをブラウザ内で作成します。XRDは参照ピーク同定、MHは複数ループ重ね描き、MTは微分曲線とT<sub>C</sub>推定に対応します。
        </p>
      </header>
      <div className="historyDock" aria-label="履歴操作">
        <button type="button" className="secondary" disabled={!store.canUndo} onClick={store.undo}>
          ↶ 前に戻る
        </button>
        <button type="button" className="secondary" disabled={!store.canRedo} onClick={store.redo}>
          ↷ やり直す
        </button>
      </div>
      <main ref={mainRef}>
        <section className="card controls">
          <div className="modeBox">
            <div className="modeButtons" aria-label="XRD MH MT mode">
              {(['xrd', 'mh', 'mt'] as GraphMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={mode === m ? 'active' : ''}
                  onClick={() => {
                    store.setMode(m);
                    setTab(defaultTabForMode(m));
                  }}
                >
                  {m.toUpperCase()}
                  <span className="sub">{m === 'xrd' ? '解析・同定' : m === 'mh' ? '磁化曲線' : '温度依存・微分'}</span>
                </button>
              ))}
            </div>
            <div className="small">
              上のタブで作業対象を切り替えます。各タブのデータ、ズーム履歴、T<sub>C</sub>採用、微分線位置は保持されます。
            </div>
          </div>
          <div className="quickActions" aria-label="主要操作">
            <button type="button" onClick={() => setTab('files')}>読み込み</button>
            <button
              type="button"
              className="secondary"
              title="現在表示中のXRD・MH・MTだけを初期表示範囲へ戻します"
              onClick={() =>
                update((s) => {
                  if (s.mode === 'mh') return { ...s, mhZoomView: null, mhZoomHistory: [] };
                  if (s.mode === 'mt') return { ...s, mtZoomView: null, mtZoomHistory: [] };
                  return { ...s, xrdZoomView: null, xrdZoomHistory: [] };
                }, true)
              }
            >
              このモードのズーム解除
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => update((s) => ({ ...s, settings: { ...s.settings, layoutRatio: '50' } }))}
            >
              レイアウトを戻す
            </button>
            <button type="button" className="secondary" onClick={() => setTab('save')}>
              保存メニュー
            </button>
          </div>
          <div className="controlTabs" aria-label="設定カテゴリ">
            {TAB_DEFS.filter((t) => t.modes.includes(mode)).map((t) => (
              <button
                key={t.id + t.label}
                type="button"
                className={activeTab === t.id ? 'active' : ''}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
            {mode === 'xrd' && (
              <button type="button" className={activeTab === 'refs' ? 'active' : ''} onClick={() => setTab('refs')}>
                格子定数
              </button>
            )}
          </div>
          {activeTab === 'files' && <LoadTab mode={mode} />}
          {activeTab === 'mh' && <MhTab />}
          {activeTab === 'mt' && <MtTab />}
          {activeTab === 'graph' && <GraphTab mode={mode} />}
          {activeTab === 'refs' && <RefsTab />}
          {activeTab === 'probe' && <ProbeTab />}
          {activeTab === 'id' && <IdentifyTab />}
          {activeTab === 'save' && <SaveTab svgText={svgText} analyses={analyses} />}
          <div className="status">{status}</div>
        </section>

        <div
          id="layoutSplitter"
          ref={splitterRef}
          role="separator"
          aria-label="操作欄とグラフ欄の幅を調整"
          aria-orientation="vertical"
          onPointerDown={onSplitterDown}
        />
        <section className="card chartwrap">
          {svgText ? (
            <ChartPanel svgText={svgText} state={state} update={update} />
          ) : (
            <div id="svgHost">
              <div className="status">測定データを読み込んでください。</div>
            </div>
          )}
          <div className="chartInstruction">
            <span className="key">左ドラッグ</span> 四角で囲んだ範囲を拡大 <span className="key">右クリック</span> ズームを一段戻す{' '}
            {mode === 'mt' && (
              <>
                <span className="key">dM/dT・d²M/dT²</span> 線を掴んで上下移動
              </>
            )}
          </div>
          {mode === 'xrd' && (
            <div className="tables">
              <div className="tablebox">
                <div className="tableHeader">
                  <label htmlFor="candidateSampleSelect">候補相を表示する測定データ</label>
                  <select
                    id="candidateSampleSelect"
                    value={candidateSample}
                    onChange={(e) => setCandidateSample(e.target.value)}
                  >
                    <option value="__all__">すべて</option>
                    {analyses.map((a) => (
                      <option key={a.sampleId} value={a.sampleId}>
                        {a.sample}
                      </option>
                    ))}
                  </select>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>sample</th>
                      <th>候補相</th>
                      <th>可能性</th>
                      <th>メイン</th>
                      <th>一致</th>
                      <th>欠損</th>
                      <th>メモ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleAnalyses.flatMap((a) =>
                      a.candidates.slice(0, candidateLimit).map((c, i) => (
                        <tr key={`${a.sampleId}-${i}`}>
                          <td>{c.sample}</td>
                          <td>{c.phase}</td>
                          <td>{c.score.toFixed(1)}%</td>
                          <td>{c.main}</td>
                          <td>
                            {c.matched}/{c.expected}
                          </td>
                          <td>{c.missingStrong}</td>
                          <td>{c.note}</td>
                        </tr>
                      )),
                    )}
                  </tbody>
                </table>
              </div>
              <div className="tablebox">
                <table>
                  <thead>
                    <tr>
                      <th>sample</th>
                      <th>obs 2θ</th>
                      <th>I_norm</th>
                      <th>ref 2θ</th>
                      <th>phase</th>
                      <th>Δ2θ</th>
                      <th>hkl</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleAnalyses.flatMap((a) =>
                      a.peaks.map((p, i) => (
                        <tr key={`${a.sampleId}-pk-${i}`}>
                          <td>{a.sample}</td>
                          <td>{p.x.toFixed(3)}</td>
                          <td>{p.y.toFixed(1)}</td>
                          <td>{p.match ? p.match.ref.angle.toFixed(3) : 'Unknown'}</td>
                          <td>{p.match ? p.match.ref.phaseLabel || p.match.ref.phase : ''}</td>
                          <td>{p.match ? p.match.delta.toFixed(3) : ''}</td>
                          <td>
                            {p.match && p.match.ref.h != null
                              ? `${p.match.ref.h}${p.match.ref.k}${p.match.ref.l}`
                              : ''}
                          </td>
                        </tr>
                      )),
                    )}
                  </tbody>
                </table>
              </div>
              <div className="tablebox">
                <div className={`probeInfo${state.probe ? '' : ' probeEmpty'}`}>
                  {state.probe && Number.isFinite(state.probe.angle) ? (
                    <>
                      調査中: <b>{state.probe.angle.toFixed(3)}°</b> ± {probeWindow.toFixed(2)}° / 候補 {probeRows.length}件
                    </>
                  ) : (
                    'グラフ上の気になるピークをクリックすると、ここに全参照データから由来候補が出ます。'
                  )}
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>候補相</th>
                      <th>ref 2θ</th>
                      <th>Δ2θ</th>
                      <th>I</th>
                      <th>hkl</th>
                      <th>d</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.probe && !probeRows.length && (
                      <tr>
                        <td colSpan={6}>この範囲には、読み込み済み参照データ内で近いピークがありません。</td>
                      </tr>
                    )}
                    {probeRows.map((r, i) => (
                      <tr key={i}>
                        <td>
                          <span style={{ color: r.color }}>{markerLabel(r.marker)}</span> {r.phase}
                        </td>
                        <td>{r.angle.toFixed(3)}</td>
                        <td>{r.delta.toFixed(3)}</td>
                        <td>{num(r.intensity, 0).toFixed(0)}</td>
                        <td>{r.hkl}</td>
                        <td>{Number.isFinite(r.d as number) ? (r.d as number).toFixed(4) : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </main>
    </StoreContext.Provider>
  );
}
