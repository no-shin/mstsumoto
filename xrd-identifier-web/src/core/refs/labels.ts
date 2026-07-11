/** 相名の簡略ラベル化とマーカー形状の自動提案 */

export function simplifyPhaseLabel(name: unknown): string {
  const s = String(name || '')
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const lower = s.toLowerCase();
  if (/\bm[- ]?type\b/.test(lower)) return 'M-type';
  if (/\bz[- ]?type\b/.test(lower)) return 'Z-type';
  if (/\by[- ]?type\b/.test(lower)) return 'Y-type';
  if (/\bx[- ]?type\b/.test(lower)) return 'X-type';
  if (/\bw[- ]?type\b/.test(lower)) return 'W-type';
  if (/\bqs[- ]?type\b/.test(lower) || lower.includes('basn0.9fe5.47o11')) return 'QS-type';
  if (lower.includes('cuo')) return 'CuO';
  if (lower.includes('feo') && !lower.includes('fe2o4') && !lower.includes('fe2o3')) return 'FeO';
  if (lower.includes('spinel') || (lower.includes('cu') && lower.includes('fe2') && lower.includes('o4')))
    return 'spinel CuFe2O4';
  if (lower.includes('αfe2o3') || lower.includes('alphafe2o3') || lower.includes('fe2o3')) return 'α-Fe2O3';
  if (lower.includes('baco3')) return 'BaCO3';
  if (lower.includes('bafe2o4')) return 'BaFe2O4';
  if (lower.includes('caco3')) return 'CaCO3';
  return s.replace(/\s*PDF\s*[-0-9A-Za-z() ]*$/, '').trim() || s;
}

export function suggestMarker(name: unknown): string {
  const s = String(name || '').toLowerCase();
  if (s.includes('m-type') || s.includes('m type')) return 'circle';
  if (s.includes('z-type') || s.includes('z type')) return 'triangle_down';
  if (s.includes('qs')) return 'diamond';
  if (s.includes('spinel')) return 'square';
  if (s.includes('feo') || s.includes('fe2o3')) return 'triangle_up';
  return 'triangle_down';
}
