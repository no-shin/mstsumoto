/**
 * 参照相 DB(IndexedDB ラッパ)。
 * ブラウザ内に永続化されるため、一度インポートすれば次回起動時も残る。
 * JSON エクスポート/インポートでバックアップ・共有も可能。
 */

import type { ReferencePhase } from '../core/types';

const DB_NAME = 'xrd-identifier';
const DB_VERSION = 1;
const STORE = 'referencePhases';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB を開けませんでした'));
  });
}

function requestToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB 操作に失敗しました'));
  });
}

export async function listPhases(): Promise<ReferencePhase[]> {
  const db = await openDb();
  try {
    const store = db.transaction(STORE, 'readonly').objectStore(STORE);
    const all = await requestToPromise(store.getAll() as IDBRequest<ReferencePhase[]>);
    return all.sort((a, b) => a.phaseName.localeCompare(b.phaseName, 'ja'));
  } finally {
    db.close();
  }
}

export async function savePhase(phase: ReferencePhase): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(phase);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('保存に失敗しました'));
    });
  } finally {
    db.close();
  }
}

export async function deletePhase(id: string): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('削除に失敗しました'));
    });
  } finally {
    db.close();
  }
}

/** DB 全体を JSON 文字列にする(バックアップ/PC間共有用) */
export async function exportAllAsJson(): Promise<string> {
  const phases = await listPhases();
  return JSON.stringify({ format: 'xrd-identifier-refdb', version: 1, phases }, null, 2);
}

/** JSON からインポート(同じ id は上書き)。取り込んだ件数を返す */
export async function importFromJson(json: string): Promise<number> {
  const data = JSON.parse(json) as { format?: string; phases?: ReferencePhase[] };
  if (data.format !== 'xrd-identifier-refdb' || !Array.isArray(data.phases)) {
    throw new Error('参照DBの JSON 形式ではありません。');
  }
  for (const p of data.phases) await savePhase(p);
  return data.phases.length;
}
