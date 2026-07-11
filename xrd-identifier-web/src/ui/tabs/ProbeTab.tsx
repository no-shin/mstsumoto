/** 「ピーク調査」タブ */

import { Fieldset, NumField, SelectField, useStore } from '../common';

export function ProbeTab() {
  const { update } = useStore();
  return (
    <Fieldset legend="ピーク調査">
      <div className="stickyNote">
        グラフ上の気になるピークをクリックすると、その2θ付近にある参照ピーク候補を一覧表示します。候補検索は表示ON/OFFに関係なく、読み込み済みの参照データ全体から行います。図を書き出すとき、この黒い調査マーカーは自動で消えます。
      </div>
      <div className="grid2">
        <NumField id="probeWindow" label="候補探索幅 / deg" step="0.01" min="0.01" />
        <SelectField
          id="probeSnap"
          label="クリック時のピーク吸着"
          options={[
            ['on', 'ON'],
            ['off', 'OFF'],
          ]}
        />
      </div>
      <div className="buttonbar">
        <button type="button" className="secondary" onClick={() => update((s) => ({ ...s, probe: null }))}>
          ピーク調査マーカーを消す
        </button>
      </div>
    </Fieldset>
  );
}
