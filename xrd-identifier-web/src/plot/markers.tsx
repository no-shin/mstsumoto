/** SVG マーカー描画(matplotlib のマーカー相当) */

import type { JSX } from 'react';
import type { MarkerShape } from '../core/types';

export const MARKER_LABELS: Record<MarkerShape, string> = {
  circle: '○ 丸',
  'triangle-down': '▼ 下三角',
  'triangle-up': '▲ 上三角',
  diamond: '◆ ひし形',
  square: '■ 四角',
  cross: '× バツ',
  plus: '+ プラス',
  star: '* 星',
};

/** (cx, cy) 中心・大きさ size のマーカー1個の SVG 要素を返す */
export function markerElement(
  shape: MarkerShape,
  cx: number,
  cy: number,
  size: number,
  color: string,
  key?: string | number,
): JSX.Element {
  const s = size;
  const common = { stroke: color, fill: 'none', strokeWidth: 1.4 } as const;
  switch (shape) {
    case 'circle':
      return <circle key={key} {...common} cx={cx} cy={cy} r={s / 2} />;
    case 'triangle-down':
      return (
        <polygon
          key={key} {...common}
          points={`${cx - s / 2},${cy - s / 2} ${cx + s / 2},${cy - s / 2} ${cx},${cy + s / 2}`}
        />
      );
    case 'triangle-up':
      return (
        <polygon
          key={key} {...common}
          points={`${cx - s / 2},${cy + s / 2} ${cx + s / 2},${cy + s / 2} ${cx},${cy - s / 2}`}
        />
      );
    case 'diamond':
      return (
        <polygon
          key={key} {...common}
          points={`${cx},${cy - s / 2} ${cx + s / 2},${cy} ${cx},${cy + s / 2} ${cx - s / 2},${cy}`}
        />
      );
    case 'square':
      return <rect key={key} {...common} x={cx - s / 2} y={cy - s / 2} width={s} height={s} />;
    case 'cross':
      return (
        <path
          key={key} {...common}
          d={`M${cx - s / 2},${cy - s / 2} L${cx + s / 2},${cy + s / 2} M${cx + s / 2},${cy - s / 2} L${cx - s / 2},${cy + s / 2}`}
        />
      );
    case 'plus':
      return (
        <path
          key={key} {...common}
          d={`M${cx},${cy - s / 2} L${cx},${cy + s / 2} M${cx - s / 2},${cy} L${cx + s / 2},${cy}`}
        />
      );
    case 'star': {
      const pts: string[] = [];
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? s / 2 : s / 5;
        const a = (Math.PI / 5) * i - Math.PI / 2;
        pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`);
      }
      return <polygon key={key} {...common} points={pts.join(' ')} />;
    }
  }
}
