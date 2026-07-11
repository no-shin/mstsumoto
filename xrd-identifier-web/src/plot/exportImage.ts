/** SVG/PNG/テキストのダウンロード(probe 要素は保存時に除去) */

export function downloadText(filename: string, text: string, type = 'text/plain'): void {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 調査マーカー(probeX)を除いた SVG テキストを返す */
export function exportSvgText(svgText: string): string {
  if (!svgText) return '';
  try {
    const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
    doc.querySelectorAll('.probeX').forEach((el) => el.remove());
    return new XMLSerializer().serializeToString(doc.documentElement);
  } catch {
    return svgText
      .replace(/<[^>]*class="[^"]*probeX[^"]*"[^>]*>[^<]*<\/[^>]+>/g, '')
      .replace(/<[^>]*class="[^"]*probeX[^"]*"[^>]*\/>/g, '');
  }
}

export function savePng(svgText: string, filename: string): void {
  const clean = exportSvgText(svgText);
  if (!clean) return;
  const svg = new Blob([clean], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svg);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = img.width * 2;
    canvas.height = img.height * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(2, 2);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, 'image/png');
  };
  img.src = url;
}
