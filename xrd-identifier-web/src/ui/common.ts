/** UI 共通ユーティリティ */

import type { MarkerShape, ReferencePhase } from '../core/types';

/** 相分類ごとの初期色・マーカー提案(ユーザーは編集画面で自由に変更できる) */
export function suggestStyle(phaseName: string, phaseFamily: string): { color: string; marker: MarkerShape } {
  const key = `${phaseName} ${phaseFamily}`.toLowerCase();
  // 誤爆しやすい部分文字列(cuo 等)は単語境界で判定する
  const has = (re: RegExp) => re.test(key);
  if (has(/m-type|bafe12o19/)) return { color: '#1d4ed8', marker: 'circle' };
  if (has(/z-type|ba3\w*fe24o41/)) return { color: '#dc2626', marker: 'triangle-down' };
  if (has(/y-type/)) return { color: '#7c3aed', marker: 'triangle-up' };
  if (has(/w-type/)) return { color: '#ea580c', marker: 'diamond' };
  if (has(/spinel|cufe2o4\b|fe3o4\b/)) return { color: '#16a34a', marker: 'square' };
  if (has(/\bcuo\b/)) return { color: '#0891b2', marker: 'cross' };
  if (has(/\bbaco3\b/)) return { color: '#6b7280', marker: 'plus' };
  if (has(/fe2o3|hematite/)) return { color: '#92400e', marker: 'star' };
  return { color: '#0f766e', marker: 'circle' };
}

export function newId(): string {
  return crypto.randomUUID();
}

export function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return file.arrayBuffer();
}

/** ReferencePhase の空テンプレート */
export function emptyPhase(): Omit<ReferencePhase, 'peaks' | 'columnMapping'> {
  return {
    id: newId(),
    phaseName: '',
    pdfId: '',
    elements: [],
    phaseFamily: '',
    color: '#0f766e',
    marker: 'circle',
    orientation: { mode: 'none' },
    sourceFileName: '',
    importedAt: new Date().toISOString(),
  };
}
