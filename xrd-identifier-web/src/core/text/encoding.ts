/** ファイル読み込み(UTF-8 → 文字化け検出時に Shift_JIS へフォールバック) */

export function decodeBuffer(buf: ArrayBuffer): string {
  const utf = new TextDecoder('utf-8').decode(buf);
  const bad = (utf.match(/�/g) || []).length;
  if (bad > 2) {
    try {
      return new TextDecoder('shift_jis').decode(buf);
    } catch {
      // shift_jis 非対応環境では UTF-8 のまま返す
    }
  }
  return utf;
}

export async function readFileText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  return decodeBuffer(buf);
}
