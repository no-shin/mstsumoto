/**
 * XRD 同定結果プロット(自作 SVG)。
 * - 黒線: 測定パターン
 * - 相ごとの色付きマーカー: 根拠ピーク位置(観測強度の少し上)
 * - 下段スティック: 参照パターン(照合の目視検証用)
 * - グレー菱形: 未説明ピーク(ON/OFF 可)
 */

import { useMemo } from 'react';
import type { AnalysisResult, MeasuredPattern, PhaseResult } from '../core/types';
import { linearScale, niceTicks } from './scales';
import { markerElement } from './markers';

export interface PlotOptions {
  xMin: number | null;
  xMax: number | null;
  yMin: number | null;
  yMax: number | null;
  showUnmatched: boolean;
  showReferenceSticks: boolean;
  /** マーカーを表示する相 ID(null なら全相のうちスコア上位) */
  visiblePhaseIds: Set<string>;
}

export const DEFAULT_PLOT_OPTIONS: Omit<PlotOptions, 'visiblePhaseIds'> = {
  xMin: null,
  xMax: null,
  yMin: null,
  yMax: null,
  showUnmatched: true,
  showReferenceSticks: true,
};

interface Props {
  pattern: MeasuredPattern;
  result: AnalysisResult;
  options: PlotOptions;
  /** phaseId → 参照ピーク一覧(スティック描画用。無い相は根拠ピークのみ描画) */
  referencePeaks?: Record<string, Array<{ twoTheta: number; intensity: number }>>;
  width?: number;
  height?: number;
}

const MARGIN = { top: 16, right: 16, bottom: 48, left: 64 };
const STICK_AREA = 60; // 参照スティック表示領域の高さ

export function XrdPlot({ pattern, result, options, referencePeaks, width = 900, height = 520 }: Props) {
  const phases = result.results.filter((r) => options.visiblePhaseIds.has(r.phaseId));
  const stickArea = options.showReferenceSticks && phases.length > 0 ? STICK_AREA : 0;

  const xDomain: [number, number] = [
    options.xMin ?? pattern.twoTheta[0],
    options.xMax ?? pattern.twoTheta[pattern.twoTheta.length - 1],
  ];
  const yDataMax = Math.max(...pattern.intensity);
  const yDomain: [number, number] = [options.yMin ?? 0, options.yMax ?? yDataMax * 1.12];

  const plotW = width - MARGIN.left - MARGIN.right;
  const plotH = height - MARGIN.top - MARGIN.bottom - stickArea;
  const sx = linearScale(xDomain, [MARGIN.left, MARGIN.left + plotW]);
  const sy = linearScale(yDomain, [MARGIN.top + plotH, MARGIN.top]);

  const linePath = useMemo(() => {
    const parts: string[] = [];
    let pen = false;
    for (let i = 0; i < pattern.twoTheta.length; i++) {
      const x = pattern.twoTheta[i];
      if (x < xDomain[0] || x > xDomain[1]) {
        pen = false;
        continue;
      }
      const px = sx.scale(x).toFixed(2);
      const py = sy.scale(Math.min(Math.max(pattern.intensity[i], yDomain[0]), yDomain[1])).toFixed(2);
      parts.push(`${pen ? 'L' : 'M'}${px},${py}`);
      pen = true;
    }
    return parts.join('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pattern, xDomain[0], xDomain[1], yDomain[0], yDomain[1], width, height, stickArea]);

  const xTicks = niceTicks(xDomain[0], xDomain[1], 8);
  const yTicks = niceTicks(yDomain[0], yDomain[1], 6);

  /** 観測強度の少し上にマーカーを置くための y 値 */
  const markerY = (obsTwoTheta: number): number => {
    let nearest = 0;
    let bestDist = Infinity;
    for (let i = 0; i < pattern.twoTheta.length; i++) {
      const d = Math.abs(pattern.twoTheta[i] - obsTwoTheta);
      if (d < bestDist) {
        bestDist = d;
        nearest = i;
      }
    }
    return Math.min(pattern.intensity[nearest] + yDataMax * 0.03, yDomain[1]);
  };

  const inX = (v: number) => v >= xDomain[0] && v <= xDomain[1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      style={{ background: 'white', maxWidth: '100%', height: 'auto' }}
      fontFamily="Arial, sans-serif"
    >
      {/* 軸 */}
      <rect
        x={MARGIN.left}
        y={MARGIN.top}
        width={plotW}
        height={plotH}
        fill="none"
        stroke="#222"
        strokeWidth={1}
      />
      {xTicks.map((t) => (
        <g key={`xt${t}`}>
          <line
            x1={sx.scale(t)}
            x2={sx.scale(t)}
            y1={MARGIN.top + plotH}
            y2={MARGIN.top + plotH + 5}
            stroke="#222"
          />
          <text x={sx.scale(t)} y={MARGIN.top + plotH + 20} fontSize={12} textAnchor="middle" fill="#111">
            {t}
          </text>
        </g>
      ))}
      {yTicks.map((t) => (
        <g key={`yt${t}`}>
          <line x1={MARGIN.left - 5} x2={MARGIN.left} y1={sy.scale(t)} y2={sy.scale(t)} stroke="#222" />
          <text
            x={MARGIN.left - 8}
            y={sy.scale(t) + 4}
            fontSize={11}
            textAnchor="end"
            fill="#111"
          >
            {Math.abs(t) >= 10000 ? t.toExponential(1) : t}
          </text>
        </g>
      ))}
      <text
        x={MARGIN.left + plotW / 2}
        y={height - stickArea - 8}
        fontSize={14}
        textAnchor="middle"
        fill="#111"
      >
        2θ (deg.)  Cu-Kα
      </text>
      <text
        x={16}
        y={MARGIN.top + plotH / 2}
        fontSize={14}
        textAnchor="middle"
        fill="#111"
        transform={`rotate(-90 16 ${MARGIN.top + plotH / 2})`}
      >
        Intensity (arb. units)
      </text>

      {/* 測定パターン */}
      <path d={linePath} fill="none" stroke="black" strokeWidth={0.9} />

      {/* 根拠ピークマーカー */}
      {phases.map((r) =>
        r.matches
          .filter((m) => inX(m.obsTwoTheta))
          .map((m, i) =>
            markerElement(
              r.marker,
              sx.scale(m.obsTwoTheta),
              sy.scale(markerY(m.obsTwoTheta)) - 6,
              9,
              r.color,
              `${r.phaseId}-${i}`,
            ),
          ),
      )}

      {/* 未説明ピーク */}
      {options.showUnmatched &&
        result.unmatchedPeaks
          .filter((p) => inX(p.twoTheta))
          .map((p, i) => (
            <g key={`um${i}`}>
              <line
                x1={sx.scale(p.twoTheta)}
                x2={sx.scale(p.twoTheta)}
                y1={sy.scale(markerY(p.twoTheta)) - 4}
                y2={sy.scale(markerY(p.twoTheta)) - 12}
                stroke="#888"
                strokeWidth={1.2}
                strokeDasharray="2 2"
              />
              <text
                x={sx.scale(p.twoTheta)}
                y={sy.scale(markerY(p.twoTheta)) - 15}
                fontSize={9}
                textAnchor="middle"
                fill="#888"
              >
                ?
              </text>
            </g>
          ))}

      {/* 凡例 */}
      <g>
        {legendEntries(phases, options).map((e, i) => {
          const lx = MARGIN.left + plotW - 220;
          const ly = MARGIN.top + 14 + i * 18;
          return (
            <g key={e.label}>
              {e.marker ? (
                markerElement(e.marker.shape, lx, ly - 4, 9, e.marker.color)
              ) : (
                <line x1={lx - 5} x2={lx + 5} y1={ly - 4} y2={ly - 4} stroke={e.stroke ?? '#000'} strokeWidth={1.2} strokeDasharray={e.dash} />
              )}
              <text x={lx + 12} y={ly} fontSize={11} fill="#111">
                {e.label}
              </text>
            </g>
          );
        })}
      </g>

      {/* 参照スティック(下段) */}
      {stickArea > 0 && (
        <g>
          {phases.slice(0, 4).map((r, pi) => {
            const rowY = height - stickArea + 6 + pi * (STICK_AREA / Math.min(phases.length, 4));
            const rowH = (STICK_AREA / Math.min(phases.length, 4)) * 0.8;
            return (
              <g key={`stick-${r.phaseId}`}>
                {sticksFor(r, referencePeaks)
                  .filter((s) => inX(s.twoTheta + result.globalZeroShift))
                  .map((s, i) => (
                    <line
                      key={i}
                      x1={sx.scale(s.twoTheta + result.globalZeroShift)}
                      x2={sx.scale(s.twoTheta + result.globalZeroShift)}
                      y1={rowY + rowH}
                      y2={rowY + rowH - Math.max(1.5, (s.intensity / 100) * rowH)}
                      stroke={r.color}
                      strokeWidth={1}
                      opacity={0.85}
                    />
                  ))}
                <text x={MARGIN.left + 4} y={rowY + rowH - 2} fontSize={9} fill={r.color}>
                  {r.phaseName}
                </text>
              </g>
            );
          })}
        </g>
      )}
    </svg>
  );
}

interface LegendEntry {
  label: string;
  marker?: { shape: PhaseResult['marker']; color: string };
  stroke?: string;
  dash?: string;
}

function legendEntries(phases: PhaseResult[], options: PlotOptions): LegendEntry[] {
  const entries: LegendEntry[] = [{ label: 'Measured', stroke: '#000' }];
  for (const r of phases) {
    entries.push({
      label: `${r.phaseName} (${r.score.toFixed(2)})`,
      marker: { shape: r.marker, color: r.color },
    });
  }
  if (options.showUnmatched) entries.push({ label: 'Unidentified', stroke: '#888', dash: '2 2' });
  return entries;
}

function sticksFor(
  r: PhaseResult,
  referencePeaks?: Record<string, Array<{ twoTheta: number; intensity: number }>>,
) {
  // 参照相の全ピークを表示する(照合しなかったピークも目視検証に必要)。
  // 参照データが渡されない場合は根拠ピークのみで代用。
  return (
    referencePeaks?.[r.phaseId] ??
    r.matches.map((m) => ({ twoTheta: m.refTwoTheta, intensity: m.refIntensity }))
  );
}
