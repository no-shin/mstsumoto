/** 「図設定」タブ: レイアウト・XRD表示範囲・共通図設定 */

import type { GraphMode } from '../../core/types';
import { CheckField, Fieldset, NumField, SelectField } from '../common';

export function GraphTab({ mode }: { mode: GraphMode }) {
  return (
    <>
      <Fieldset legend="画面レイアウト">
        <label>左の操作欄 / 右のグラフ欄の比率</label>
        <div className="small">中央の境界を左右にドラッグして幅を変更できます。</div>
      </Fieldset>
      {mode === 'xrd' && (
        <Fieldset legend="XRD表示範囲・積み上げ">
          <div className="grid2">
            <NumField id="xMin" label="2θ min" step="0.1" />
            <NumField id="xMax" label="2θ max" step="0.1" />
          </div>
          <div className="grid3">
            <NumField id="offset" label="縦オフセット" step="5" />
            <NumField id="yPad" label="下側グラフ余白" step="1" />
            <NumField id="topPad" label="上側グラフ余白" step="1" />
          </div>
          <div className="grid2">
            <SelectField
              id="order"
              label="描画順"
              options={[
                ['top', 'リスト順 : 上→下'],
                ['bottom', 'リスト順 : 下→上'],
              ]}
            />
            <SelectField
              id="labelPos"
              label="ラベル位置"
              options={[
                ['right', '右側'],
                ['left', '左側'],
                ['none', 'なし'],
              ]}
            />
          </div>
          <CheckField id="normalize" label="測定データを規格化する" />
          <CheckField id="baseline" label="表示範囲内の最小値を基準にする" />
        </Fieldset>
      )}
      <Fieldset legend="共通図設定">
        <div className="grid2">
          <NumField id="lineWidth" label="線幅" step="0.1" />
          <NumField id="fontSize" label="フォントサイズ" step="1" />
        </div>
        <div className="grid2">
          <NumField id="svgW" label="図幅 px" step="10" />
          <NumField id="svgH" label="図高 px" step="10" />
        </div>
        <CheckField id="showYTicks" label="Y軸数値を表示" />
        <CheckField id="showLegend" label="上部に凡例を表示" />
      </Fieldset>
    </>
  );
}
