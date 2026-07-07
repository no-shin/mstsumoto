/**
 * テキストファイルから数値表を取り出す低レベルパーサ。
 * 区切りはタブ/カンマ/空白/全角カンマを自動判定する。
 */

export interface NumericTable {
  /** 最初の非数値行(ヘッダとみなす)。無ければ [] */
  headers: string[];
  /** 数値行。行ごとの列数は揃っているとは限らない */
  rows: number[][];
  /** 数値行の最頻列数 */
  columnCount: number;
  /** 読み飛ばした行数(コメント・非数値行) */
  skippedLines: number;
}

/** 1行をトークン列に分割する */
export function splitLine(line: string): string[] {
  const normalized = line.trim().replace(/，/g, ',');
  if (normalized === '') return [];
  if (normalized.includes(',')) {
    return normalized
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t !== '');
  }
  return normalized.split(/\s+/);
}

/** 数値として解釈を試みる(全角マイナス等を許容)。失敗なら null */
export function tryParseNumber(token: string): number | null {
  const t = token.trim().replace(/−/g, '-');
  if (t === '' || !/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(t)) return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
}

/**
 * テキスト全体を数値表として読む。
 * - '#' '//' 始まりの行と空行は無視
 * - 全トークンが数値の行のみをデータ行とする
 * - 最初の非数値行をヘッダとして保持
 */
export function parseNumericTable(text: string): NumericTable {
  const headers: string[] = [];
  const rows: number[][] = [];
  let skipped = 0;

  for (const raw of text.split(/\r\n|\r|\n/)) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#') || line.startsWith('//')) continue;
    const tokens = splitLine(line);
    if (tokens.length === 0) continue;
    const nums = tokens.map(tryParseNumber);
    if (nums.every((v) => v !== null)) {
      rows.push(nums as number[]);
    } else if (headers.length === 0) {
      headers.push(...tokens);
    } else {
      skipped += 1;
    }
  }

  return { headers, rows, columnCount: modeColumnCount(rows), skippedLines: skipped };
}

function modeColumnCount(rows: number[][]): number {
  const counts = new Map<number, number>();
  for (const r of rows) counts.set(r.length, (counts.get(r.length) ?? 0) + 1);
  let best = 0;
  let bestN = -1;
  for (const [len, n] of counts) {
    if (n > bestN) {
      best = len;
      bestN = n;
    }
  }
  return best;
}

/**
 * File/ArrayBuffer をテキスト化する。UTF-8 でデコードし、
 * 置換文字が多い場合は Shift_JIS を試す(装置出力対策)。
 */
export function decodeText(buffer: ArrayBuffer): string {
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
  const badCount = (utf8.match(/�/g) ?? []).length;
  if (badCount === 0) return stripBom(utf8);
  try {
    const sjis = new TextDecoder('shift_jis', { fatal: false }).decode(buffer);
    const sjisBad = (sjis.match(/�/g) ?? []).length;
    return stripBom(sjisBad < badCount ? sjis : utf8);
  } catch {
    return stripBom(utf8);
  }
}

function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}
