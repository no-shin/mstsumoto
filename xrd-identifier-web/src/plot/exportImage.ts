/** SVG 要素の画像保存(SVG そのまま / canvas 経由 PNG) */

function triggerDownload(url: string, fileName: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
}

export function downloadText(text: string, fileName: string, mime = 'text/plain'): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, fileName);
  URL.revokeObjectURL(url);
}

function serializeSvg(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  return new XMLSerializer().serializeToString(clone);
}

export function downloadSvg(svg: SVGSVGElement, fileName: string): void {
  downloadText(serializeSvg(svg), fileName, 'image/svg+xml');
}

/** PNG 保存。scale で解像度を上げる(論文用は 2–3 推奨) */
export async function downloadPng(svg: SVGSVGElement, fileName: string, scale = 2): Promise<void> {
  const svgText = serializeSvg(svg);
  const svgUrl = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('SVG の画像化に失敗しました'));
      img.src = svgUrl;
    });
    const viewBox = svg.viewBox.baseVal;
    const w = (viewBox?.width || svg.clientWidth) * scale;
    const h = (viewBox?.height || svg.clientHeight) * scale;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2D コンテキストを取得できません');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const pngUrl = canvas.toDataURL('image/png');
    triggerDownload(pngUrl, fileName);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}
