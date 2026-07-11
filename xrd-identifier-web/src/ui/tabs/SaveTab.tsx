/** 「保存」タブ: 図・CSV・プロジェクト・参照ライブラリの保存/読込 */

import { useRef } from 'react';
import type { Analysis } from '../../core/xrd/identify';
import { currentGraphStem, makeMhCsv, makeMtCsv, makeXrdCsv } from '../../core/export/csv';
import {
  exportProjectJson,
  exportRefLibraryJson,
  importProjectJson,
  importRefLibraryJson,
  mergeRefs,
} from '../../core/project/schema';
import { safeFileStem } from '../../core/utils';
import { sStr } from '../../core/settings';
import { downloadText, exportSvgText, savePng } from '../../plot/exportImage';
import { Fieldset, TextField, useStore } from '../common';

export function SaveTab({ svgText, analyses }: { svgText: string; analyses: Analysis[] }) {
  const store = useStore();
  const { state, update, dispatch } = store;
  const projectFile = useRef<HTMLInputElement>(null);
  const refLibraryFile = useRef<HTMLInputElement>(null);

  const saveCsv = () => {
    if (state.mode === 'mt') {
      downloadText(`${currentGraphStem(state)}_data.csv`, makeMtCsv(state), 'text/csv');
    } else if (state.mode === 'mh') {
      downloadText(`${currentGraphStem(state)}_data.csv`, makeMhCsv(state), 'text/csv');
    } else {
      downloadText('xrd_peak_analysis.csv', makeXrdCsv(state, analyses), 'text/csv');
    }
  };

  return (
    <Fieldset legend="保存">
      <div className="grid2">
        <TextField id="projectName" label="プロジェクト名" placeholder="例: QS_1200C_series" />
        <div>
          <label>保存形式</label>
          <div className="small" style={{ padding: '8px 0' }}>
            作業状態は .xrdproj.json、参照だけは .xrdrefs.json で保存します。
          </div>
        </div>
      </div>
      <div className="buttonbar">
        <button type="button" className="secondary" disabled={!store.canUndo} onClick={store.undo}>
          前に戻る Ctrl+Z
        </button>
        <button type="button" className="secondary" disabled={!store.canRedo} onClick={store.redo}>
          やり直す Ctrl+Y
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => {
            const clean = exportSvgText(svgText);
            if (clean) downloadText(`${currentGraphStem(state)}.svg`, clean, 'image/svg+xml');
          }}
        >
          SVG保存
        </button>
        <button type="button" className="secondary" onClick={() => savePng(svgText, `${currentGraphStem(state)}.png`)}>
          PNG保存
        </button>
        <button type="button" className="secondary" onClick={saveCsv}>
          解析CSV
        </button>
      </div>
      <div className="buttonbar">
        <button
          type="button"
          className="secondary"
          onClick={() =>
            downloadText(
              `${safeFileStem(sStr(state.settings, 'projectName', 'xrd_project'))}.xrdproj.json`,
              exportProjectJson(state),
              'application/json',
            )
          }
        >
          作業状態を保存
        </button>
        <button type="button" className="secondary" onClick={() => projectFile.current?.click()}>
          作業状態を読込
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() =>
            downloadText(
              `${safeFileStem(sStr(state.settings, 'projectName', 'xrd_references') + '_refs', 'xrd_references')}.xrdrefs.json`,
              exportRefLibraryJson(state.refs),
              'application/json',
            )
          }
        >
          参照データだけ保存
        </button>
        <button type="button" className="secondary" onClick={() => refLibraryFile.current?.click()}>
          参照データを追加読込
        </button>
        <input
          ref={projectFile}
          type="file"
          accept=".json,.xrdproj,application/json"
          style={{ display: 'none' }}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              const text = await f.text();
              dispatch({ type: 'restore', state: importProjectJson(text, state) });
            } catch (err) {
              alert('プロジェクト読込に失敗しました: ' + (err as Error).message);
            }
            e.target.value = '';
          }}
        />
        <input
          ref={refLibraryFile}
          type="file"
          accept=".json,.xrdrefs,application/json"
          style={{ display: 'none' }}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              const text = await f.text();
              const refs = importRefLibraryJson(text);
              update((s) => ({ ...s, refs: mergeRefs(s.refs, refs) }), true);
            } catch (err) {
              alert('参照データ読込に失敗しました: ' + (err as Error).message);
            }
            e.target.value = '';
          }}
        />
      </div>
      <p className="small">
        測定データ、参照データ、表示名やコメント、線色、マーカー、表示範囲、ズーム状態まで1つのプロジェクトファイルに保存できます。後から参照データを追加した場合も、そのまま作業状態として保存できます。
      </p>
    </Fieldset>
  );
}
