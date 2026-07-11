/** 「同定」タブ: 配向・同定スコア設定 */

import { CheckField, Fieldset, NumField, SelectField } from '../common';

export function IdentifyTab() {
  return (
    <Fieldset legend="配向・同定スコア設定">
      <div className="stickyNote">
        候補相の%は、ピーク位置の一致だけでなく、メインピークの有無と相対強度のつじつまを含めた目安です。配向を選ぶと、その面族のピークだけ強く出る可能性を許容します。
      </div>
      <div className="grid3">
        <SelectField
          id="textureMode"
          label="配向補正"
          options={[
            ['none', '配向なし'],
            ['h00', 'h00 配向'],
            ['0k0', '0k0 配向'],
            ['00l', '00l 配向'],
            ['hk0', 'hk0 面内'],
            ['h0l', 'h0l 面内'],
            ['0kl', '0kl 面内'],
          ]}
        />
        <NumField id="textureBoost" label="配向ピーク許容倍率" step="0.1" min="1" />
        <NumField id="candidateLimit" label="候補表示数" step="1" min="1" />
      </div>
      <div className="grid3">
        <NumField id="minPeakI" label="測定ピーク閾値" step="1" min="0" max="100" />
        <SelectField
          id="autoShift"
          label="自動2θ補正"
          options={[
            ['on', 'ON'],
            ['off', 'OFF'],
          ]}
        />
        <NumField id="maxShift" label="最大ずれ / deg" step="0.01" min="0" />
      </div>
      <CheckField id="mainPeakRequired" label="メインピークが無い相は候補から落とす" />
    </Fieldset>
  );
}
