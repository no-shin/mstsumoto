/**
 * スナップショット方式の undo/redo(深さ 80)。
 * state はイミュータブル更新なので、スナップショットは参照共有で安価。
 */

import type { AppState } from '../core/types';

export const HISTORY_LIMIT = 80;

export interface Store {
  present: AppState;
  past: AppState[];
  future: AppState[];
  /** 入力フォーカス時点の状態(最初の編集で undo 履歴に積む) */
  editSnapshot: AppState | null;
}

export type StoreAction =
  | { type: 'update'; recipe: (s: AppState) => AppState; record?: boolean | 'edit' }
  | { type: 'editBegin' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'restore'; state: AppState; record?: boolean };

export function createStore(initial: AppState): Store {
  return { present: initial, past: [], future: [], editSnapshot: null };
}

function pushPast(past: AppState[], snapshot: AppState): AppState[] {
  if (past.length && past[past.length - 1] === snapshot) return past;
  const next = [...past, snapshot];
  return next.length > HISTORY_LIMIT ? next.slice(next.length - HISTORY_LIMIT) : next;
}

export function storeReducer(store: Store, action: StoreAction): Store {
  switch (action.type) {
    case 'editBegin':
      return store.editSnapshot ? store : { ...store, editSnapshot: store.present };
    case 'update': {
      const next = action.recipe(store.present);
      if (next === store.present) return store;
      if (action.record === 'edit') {
        if (store.editSnapshot) {
          return {
            present: next,
            past: pushPast(store.past, store.editSnapshot),
            future: [],
            editSnapshot: null,
          };
        }
        return { ...store, present: next };
      }
      if (action.record) {
        return { present: next, past: pushPast(store.past, store.present), future: [], editSnapshot: null };
      }
      return { ...store, present: next };
    }
    case 'restore': {
      if (action.record === false) return { ...store, present: action.state };
      return {
        present: action.state,
        past: pushPast(store.past, store.present),
        future: [],
        editSnapshot: null,
      };
    }
    case 'undo': {
      if (!store.past.length) return store;
      const prev = store.past[store.past.length - 1];
      return {
        present: prev,
        past: store.past.slice(0, -1),
        future: [store.present, ...store.future],
        editSnapshot: null,
      };
    }
    case 'redo': {
      if (!store.future.length) return store;
      const [next, ...rest] = store.future;
      return {
        present: next,
        past: pushPast(store.past, store.present),
        future: rest,
        editSnapshot: null,
      };
    }
  }
}
