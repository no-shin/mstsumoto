/** UI 共通部品(ストアコンテキスト・設定入力フィールド・折りたたみ fieldset) */

import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { AppStore } from '../state/useAppStore';
import { sBool, sStr } from '../core/settings';

export const StoreContext = createContext<AppStore | null>(null);

export function useStore(): AppStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error('StoreContext is not provided');
  return store;
}

interface FieldProps {
  id: string;
  label?: ReactNode;
  step?: string | number;
  min?: string | number;
  max?: string | number;
  placeholder?: string;
}

export function NumField({ id, label, step, min, max, placeholder }: FieldProps) {
  const store = useStore();
  return (
    <div>
      {label != null && <label htmlFor={id}>{label}</label>}
      <input
        id={id}
        type="number"
        value={sStr(store.state.settings, id, '')}
        step={step}
        min={min}
        max={max}
        placeholder={placeholder}
        onFocus={store.editBegin}
        onChange={(e) => store.setSetting(id, e.target.value)}
      />
    </div>
  );
}

export function TextField({ id, label, placeholder }: FieldProps) {
  const store = useStore();
  return (
    <div>
      {label != null && <label htmlFor={id}>{label}</label>}
      <input
        id={id}
        type="text"
        value={sStr(store.state.settings, id, '')}
        placeholder={placeholder}
        onFocus={store.editBegin}
        onChange={(e) => store.setSetting(id, e.target.value)}
      />
    </div>
  );
}

export function SelectField({
  id,
  label,
  options,
}: FieldProps & { options: [string, string][] }) {
  const store = useStore();
  return (
    <div>
      {label != null && <label htmlFor={id}>{label}</label>}
      <select
        id={id}
        value={sStr(store.state.settings, id, '')}
        onFocus={store.editBegin}
        onChange={(e) => store.setSetting(id, e.target.value)}
      >
        {options.map(([v, t]) => (
          <option key={v} value={v}>
            {t}
          </option>
        ))}
      </select>
    </div>
  );
}

export function CheckField({ id, label, bold = false }: FieldProps & { bold?: boolean }) {
  const store = useStore();
  return (
    <div className="row">
      <input
        id={id}
        type="checkbox"
        checked={sBool(store.state.settings, id, false)}
        onFocus={store.editBegin}
        onChange={(e) => store.setSetting(id, e.target.checked)}
      />
      <label htmlFor={id} style={{ margin: 0, fontWeight: bold ? 700 : 500 }}>
        {label}
      </label>
    </div>
  );
}

export function RangeField({ id, label, step, min, max }: FieldProps) {
  const store = useStore();
  return (
    <div>
      {label != null && <label htmlFor={id}>{label}</label>}
      <input
        id={id}
        type="range"
        value={sStr(store.state.settings, id, '')}
        step={step}
        min={min}
        max={max}
        onFocus={store.editBegin}
        onChange={(e) => store.setSetting(id, e.target.value)}
      />
    </div>
  );
}

export function Fieldset({
  legend,
  children,
  hidden,
}: {
  legend: ReactNode;
  children: ReactNode;
  hidden?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  if (hidden) return null;
  return (
    <fieldset data-collapsed={collapsed ? 'true' : 'false'}>
      <legend>
        {legend}
        <button type="button" className="collapseBtn" onClick={() => setCollapsed((c) => !c)}>
          {collapsed ? '開く' : '折りたたみ'}
        </button>
      </legend>
      {children}
    </fieldset>
  );
}
