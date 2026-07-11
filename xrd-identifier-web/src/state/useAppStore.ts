/** アプリ状態ストア(useReducer + undo/redo + Ctrl+Z/Y) */

import { useEffect, useMemo, useReducer } from 'react';
import type { AppState, GraphMode, Settings } from '../core/types';
import { createInitialState } from './appState';
import { createStore, storeReducer } from './history';
import type { StoreAction } from './history';

export interface AppStore {
  state: AppState;
  canUndo: boolean;
  canRedo: boolean;
  dispatch: (action: StoreAction) => void;
  /** record=true で undo ポイントを積んでから更新 */
  update: (recipe: (s: AppState) => AppState, record?: boolean | 'edit') => void;
  setSetting: (id: string, value: string | boolean) => void;
  setMode: (mode: GraphMode) => void;
  undo: () => void;
  redo: () => void;
  editBegin: () => void;
}

export function setSettingIn(state: AppState, id: string, value: string | boolean): AppState {
  const settings: Settings = { ...state.settings, [id]: value };
  let next: AppState = { ...state, settings };
  // 微分曲線の縦位置は state.mtDerivativeLayout と同期させる
  if (id === 'mtD1Pos' || id === 'mtD2Pos') {
    const v = Number(value);
    if (Number.isFinite(v)) {
      const ratio = Math.max(0, Math.min(1, v / 100));
      next = {
        ...next,
        mtDerivativeLayout: {
          ...next.mtDerivativeLayout,
          [id === 'mtD1Pos' ? 'd1BaseRatio' : 'd2BaseRatio']: ratio,
        },
      };
    }
  }
  return next;
}

export function useAppStore(): AppStore {
  const [store, dispatch] = useReducer(storeReducer, undefined, () => createStore(createInitialState()));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = String(e.key || '').toLowerCase();
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: 'undo' });
      } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
        e.preventDefault();
        dispatch({ type: 'redo' });
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return useMemo(
    () => ({
      state: store.present,
      canUndo: store.past.length > 0,
      canRedo: store.future.length > 0,
      dispatch,
      update: (recipe, record) => dispatch({ type: 'update', recipe, record }),
      setSetting: (id, value) =>
        dispatch({ type: 'update', recipe: (s) => setSettingIn(s, id, value), record: 'edit' }),
      setMode: (mode) => dispatch({ type: 'update', recipe: (s) => ({ ...s, mode }) }),
      undo: () => dispatch({ type: 'undo' }),
      redo: () => dispatch({ type: 'redo' }),
      editBegin: () => dispatch({ type: 'editBegin' }),
    }),
    [store],
  );
}
