/**
 * 原料組成(元素集合)からの候補相フィルタ・組成妥当性スコア。
 * 参照相の elements が試料元素の部分集合なら生成可能性が高い。
 */

const AMBIENT_ELEMENTS = new Set(['O', 'C', 'H', 'N']); // 大気・炭酸塩等で入り得る元素

/**
 * 組成妥当性スコア (0–1)。
 * - 試料元素が未入力: 中立 0.5
 * - 参照相の元素が全て試料側に含まれる(O,C,H,N は常に許容): 1.0
 * - 含まれない元素がある: その割合に応じて減点(最低 0)
 */
export function compositionScore(sampleElements: string[], phaseElements: string[]): number {
  if (sampleElements.length === 0 || phaseElements.length === 0) return 0.5;
  const sample = new Set(sampleElements);
  const relevant = phaseElements.filter((e) => !AMBIENT_ELEMENTS.has(e));
  if (relevant.length === 0) return 0.5;
  const missing = relevant.filter((e) => !sample.has(e));
  return Math.max(0, 1 - missing.length / relevant.length);
}

/** 候補として推奨するか(UI の初期チェック状態に使用) */
export function isPlausibleCandidate(sampleElements: string[], phaseElements: string[]): boolean {
  return compositionScore(sampleElements, phaseElements) >= 0.999 || sampleElements.length === 0;
}

/** "Ba, Cu, Fe" / "Ba Cu Fe" / "Ba3Cu2Fe24O41" いずれの入力も元素集合にする */
export function parseElementsInput(input: string): string[] {
  const found = new Set<string>();
  for (const m of input.matchAll(/[A-Z][a-z]?/g)) found.add(m[0]);
  return [...found];
}
