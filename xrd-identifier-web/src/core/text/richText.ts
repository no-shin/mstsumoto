/**
 * 凡例・軸ラベル用の簡易リッチテキスト。
 * `\theta` などのギリシャ文字変換と `T_C` / `Fe^{3+}` の上付き/下付きを扱う。
 */

const GREEK: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', zeta: 'ζ', eta: 'η',
  theta: 'θ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ',
  omicron: 'ο', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', upsilon: 'υ', phi: 'φ',
  chi: 'χ', psi: 'ψ', omega: 'ω',
  Alpha: 'Α', Beta: 'Β', Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Mu: 'Μ',
  Pi: 'Π', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
};

export function greekText(s: unknown): string {
  return String(s ?? '').replace(/\\([A-Za-z]+)/g, (m, name: string) => GREEK[name] || m);
}

function readScriptToken(s: string, i: number): { text: string; end: number } | null {
  const next = s[i + 1];
  if (!next) return null;
  if (next === '{') {
    const end = s.indexOf('}', i + 2);
    if (end > i + 2) return { text: s.slice(i + 2, end), end: end + 1 };
    return null;
  }
  // T_s のような1文字添字だけ自動変換。900C_milled などのファイル名は崩さない。
  const after = s[i + 2] || '';
  if (!/[A-Za-z0-9]/.test(after)) return { text: next, end: i + 2 };
  return null;
}

export interface RichSpan {
  text: string;
  mode: 'normal' | 'sub' | 'sup';
}

export function richSpans(text: unknown): RichSpan[] {
  const s = greekText(text);
  const spans: RichSpan[] = [];
  let buf = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '_' || ch === '^') {
      const token = readScriptToken(s, i);
      if (token) {
        if (buf) {
          spans.push({ text: buf, mode: 'normal' });
          buf = '';
        }
        spans.push({ text: greekText(token.text), mode: ch === '_' ? 'sub' : 'sup' });
        i = token.end - 1;
        continue;
      }
    }
    buf += ch;
  }
  if (buf) spans.push({ text: buf, mode: 'normal' });
  return spans;
}

export function estimateRichTextWidth(text: unknown, fontSize: number): number {
  const plain = String(text ?? '')
    .replace(
      /\\(theta|alpha|beta|gamma|delta|Delta|mu|lambda|pi|phi|omega|Omega|sigma|tau|epsilon|kappa|rho|chi|psi)/g,
      'θ',
    )
    .replace(/[{}_^]/g, '');
  let w = 0;
  for (const ch of plain) {
    if (/[぀-ヿ㐀-鿿]/.test(ch)) w += fontSize * 0.95;
    else if (/[A-Z0-9]/.test(ch)) w += fontSize * 0.58;
    else if (/[a-z]/.test(ch)) w += fontSize * 0.48;
    else if (/\s/.test(ch)) w += fontSize * 0.34;
    else w += fontSize * 0.42;
  }
  return Math.max(fontSize * 1.5, w);
}

export function fitLegendText(text: unknown, maxWidth: number, fontSize: number): string {
  const raw = String(text ?? '');
  if (estimateRichTextWidth(raw, fontSize) <= maxWidth) return raw;
  const ell = '…';
  let out = raw;
  while (out.length > 4 && estimateRichTextWidth(out + ell, fontSize) > maxWidth) out = out.slice(0, -1);
  return out + ell;
}
