#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
XRD Identifier Prototype v0.1.1
- 測定XRD txt/csvと参照ピークtxt/csvを照合する試作アプリ
- 目的: 候補相のランキング，根拠ピーク，未説明ピーク，グラフ出力

注意:
- この版はRietveld解析ではありません。
- 相の最終確定ではなく，同定支援のための候補出しを目的にしています。
"""
from __future__ import annotations

import csv
import json
import math
import os
import re
import sys
import traceback
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

import numpy as np

# scipy / matplotlib are used for analysis and plotting.
# They are installed by build_exe_windows.bat when building the EXE.
from scipy.signal import find_peaks, savgol_filter
from scipy.ndimage import minimum_filter1d

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

try:
    import tkinter as tk
    from tkinter import filedialog, messagebox, ttk
except Exception:  # Allows CLI mode in limited environments.
    tk = None


APP_NAME = "XRD Identifier Prototype v0.1.1"
DEFAULT_TOLERANCE_DEG = 0.25
DEFAULT_SHIFT_WINDOW_DEG = 0.50
SUPPORTED_EXTS = {".txt", ".csv", ".dat", ".xy"}

# Reduce mojibake in Windows console logs.
try:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass



@dataclass
class MeasuredPeak:
    two_theta: float
    intensity: float
    prominence: float
    width_index: float = 0.0


@dataclass
class RefPeak:
    h: int
    k: int
    l: int
    intensity: float
    two_theta: float
    d: Optional[float] = None


@dataclass
class PhaseReference:
    phase_name: str
    file_path: str
    pdf_id: str
    peaks: List[RefPeak]
    color: str
    marker: str


@dataclass
class PeakMatch:
    ref_two_theta: float
    obs_two_theta: float
    obs_intensity: float
    diff: float
    ref_intensity: float
    h: int
    k: int
    l: int


@dataclass
class PhaseResult:
    phase_name: str
    pdf_id: str
    score: float
    zero_shift: float
    matched_count: int
    ref_count: int
    strong_matched_count: int
    strong_ref_count: int
    orientation_mode: str
    matches: List[PeakMatch]
    color: str
    marker: str
    notes: str


def resource_path(relative: str) -> Path:
    """Get path both in source run and PyInstaller bundle."""
    if getattr(sys, "frozen", False):
        base = Path(sys.executable).resolve().parent
    else:
        base = Path(__file__).resolve().parent
    return base / relative


def clean_phase_name(path: Path) -> Tuple[str, str]:
    stem = path.stem
    pdf_match = re.search(r"PDF\s*([0-9]{2}-[0-9]{3}-[0-9]{4})", stem, flags=re.I)
    pdf_id = pdf_match.group(1) if pdf_match else ""
    # Remove PDF identifier before removing copy suffixes such as (1).
    phase = re.sub(r"\s*PDF\s*[0-9]{2}-[0-9]{3}-[0-9]{4}.*$", "", stem, flags=re.I).strip()
    phase = re.sub(r"\s*\(\d+\)$", "", phase).strip()
    return phase or stem, pdf_id


def phase_style(name: str) -> Tuple[str, str]:
    lower = name.lower()
    # Matplotlib color names are used; no special font dependency.
    if "m-type" in lower or "bafe12" in lower:
        return "blue", "o"
    if "z-type" in lower or "ba3cu2fe24" in lower:
        return "red", "v"
    if "y-type" in lower:
        return "purple", "^"
    if "w-type" in lower:
        return "orange", "D"
    if "spinel" in lower or "cufe2o4" in lower or "fe3o4" in lower:
        return "green", "s"
    if "cuo" in lower:
        return "cyan", "x"
    if "baco3" in lower:
        return "gray", "+"
    if "fe2o3" in lower or "hematite" in lower:
        return "brown", "*"
    return "tab:blue", "o"


def split_line(line: str) -> List[str]:
    line = line.strip().replace("，", ",")
    if not line:
        return []
    if "," in line:
        return [x.strip() for x in line.split(",") if x.strip()]
    return re.split(r"\s+", line)


def try_float(token: str) -> Optional[float]:
    token = token.strip().replace("−", "-")
    try:
        return float(token)
    except Exception:
        return None


def read_numeric_rows(path: Path) -> Tuple[List[str], List[List[float]]]:
    """Read mixed header/numeric txt/csv robustly."""
    headers: List[str] = []
    rows: List[List[float]] = []
    with path.open("r", encoding="utf-8-sig", errors="ignore") as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith("#") or line.startswith("//"):
                continue
            tokens = split_line(line)
            if not tokens:
                continue
            floats = [try_float(tok) for tok in tokens]
            if all(v is not None for v in floats):
                rows.append([float(v) for v in floats if v is not None])
            else:
                # Use first non-numeric line as header.
                if not headers:
                    headers = tokens
    return headers, rows


def load_measurement(path: str | Path) -> Tuple[np.ndarray, np.ndarray]:
    p = Path(path)
    _, rows = read_numeric_rows(p)
    if not rows:
        raise ValueError(f"測定データを読めませんでした: {p}")
    arr = np.array(rows, dtype=float)
    if arr.ndim != 2 or arr.shape[1] < 2:
        raise ValueError("測定データは少なくとも2列（2θ, intensity）が必要です。")
    x = arr[:, 0]
    y = arr[:, 1]
    order = np.argsort(x)
    return x[order], y[order]


def normalize_header(h: str) -> str:
    h = h.strip().lower()
    h = h.replace("θ", "theta").replace("２", "2")
    h = h.replace("°", "").replace("deg", "")
    return h


def infer_reference_columns(headers: List[str], ncols: int) -> Dict[str, int]:
    """Infer columns. Default for user's PDF text: l k h I 2θ d."""
    if headers:
        norm = [normalize_header(h) for h in headers]
        mapping: Dict[str, int] = {}
        for i, token in enumerate(norm):
            if token == "h": mapping["h"] = i
            elif token == "k": mapping["k"] = i
            elif token == "l": mapping["l"] = i
            elif token in {"i", "int", "intensity", "relint"}: mapping["intensity"] = i
            elif "2theta" in token or token in {"2th", "twotheta", "2t"}: mapping["two_theta"] = i
            elif token == "d" or token.startswith("d("): mapping["d"] = i
        if {"h", "k", "l", "intensity", "two_theta"}.issubset(mapping.keys()):
            return mapping
    # Default: l k h I 2θ d  (important for the uploaded reference file)
    if ncols >= 6:
        return {"l": 0, "k": 1, "h": 2, "intensity": 3, "two_theta": 4, "d": 5}
    # Minimal fallback: 2theta, intensity
    if ncols >= 2:
        return {"two_theta": 0, "intensity": 1, "h": -1, "k": -1, "l": -1}
    raise ValueError("参照値ファイルの列数が足りません。")


def load_reference_file(path: str | Path) -> PhaseReference:
    p = Path(path)
    headers, rows = read_numeric_rows(p)
    if not rows:
        raise ValueError(f"参照値を読めませんでした: {p}")
    ncols = max(len(r) for r in rows)
    cols = infer_reference_columns(headers, ncols)
    peaks: List[RefPeak] = []
    for row in rows:
        def get(col: str, default: float = 0.0) -> float:
            idx = cols.get(col, -1)
            if idx < 0 or idx >= len(row):
                return default
            return row[idx]
        two = get("two_theta", math.nan)
        inten = get("intensity", math.nan)
        if not np.isfinite(two) or not np.isfinite(inten):
            continue
        h = int(round(get("h", 0)))
        k = int(round(get("k", 0)))
        l = int(round(get("l", 0)))
        d = get("d", math.nan) if "d" in cols else math.nan
        peaks.append(RefPeak(h=h, k=k, l=l, intensity=float(inten), two_theta=float(two), d=None if not np.isfinite(d) else float(d)))
    peaks.sort(key=lambda r: r.two_theta)
    phase, pdf_id = clean_phase_name(p)
    color, marker = phase_style(phase)
    return PhaseReference(phase_name=phase, file_path=str(p), pdf_id=pdf_id, peaks=peaks, color=color, marker=marker)


def load_reference_folder(folder: str | Path) -> List[PhaseReference]:
    root = Path(folder)
    files = [p for p in root.rglob("*") if p.is_file() and p.suffix.lower() in SUPPORTED_EXTS]
    refs: List[PhaseReference] = []
    errors: List[str] = []
    for p in files:
        try:
            refs.append(load_reference_file(p))
        except Exception as e:
            errors.append(f"{p.name}: {e}")
    if not refs:
        msg = "参照値ファイルを読み込めませんでした。"
        if errors:
            msg += "\n" + "\n".join(errors[:5])
        raise ValueError(msg)
    return refs


def smooth_and_baseline(x: np.ndarray, y: np.ndarray, window_points: int = 21) -> Tuple[np.ndarray, np.ndarray]:
    n = len(y)
    if n < 7:
        return y.copy(), np.zeros_like(y)
    # Ensure odd Savitzky-Golay window and safe size.
    win = min(window_points, n - 1 if (n - 1) % 2 == 1 else n - 2)
    if win < 5:
        win = 5 if n >= 5 else n | 1
    if win % 2 == 0:
        win += 1
    try:
        ys = savgol_filter(y, window_length=win, polyorder=2)
    except Exception:
        ys = y.copy()
    # Crude baseline: wide rolling minimum then smooth.
    step = float(np.median(np.diff(x))) if len(x) > 2 else 0.02
    base_win = max(51, int(round(1.2 / max(step, 1e-6))))
    if base_win % 2 == 0:
        base_win += 1
    try:
        base = minimum_filter1d(ys, size=min(base_win, max(3, n // 3)))
        b_win = min(max(11, base_win // 5), n - 1 if (n - 1) % 2 == 1 else n - 2)
        if b_win % 2 == 0: b_win += 1
        if b_win >= 5:
            base = savgol_filter(base, window_length=b_win, polyorder=2)
    except Exception:
        base = np.percentile(y, 5) * np.ones_like(y)
    corrected = ys - base
    corrected[corrected < 0] = 0
    return corrected, base


def detect_peaks(x: np.ndarray, y: np.ndarray, prominence: Optional[float] = None, min_distance_deg: float = 0.15) -> List[MeasuredPeak]:
    yc, _ = smooth_and_baseline(x, y)
    if prominence is None or prominence <= 0:
        # Auto threshold: conservative but usable for a first prototype.
        dyn = float(np.nanmax(yc) - np.nanmedian(yc))
        prominence = max(20.0, dyn * 0.03)
    step = float(np.median(np.diff(x))) if len(x) > 2 else 0.02
    distance = max(1, int(round(min_distance_deg / max(step, 1e-6))))
    idx, props = find_peaks(yc, prominence=prominence, distance=distance)
    peaks: List[MeasuredPeak] = []
    prominences = props.get("prominences", np.zeros(len(idx)))
    for i, prom in zip(idx, prominences):
        peaks.append(MeasuredPeak(two_theta=float(x[i]), intensity=float(y[i]), prominence=float(prom)))
    peaks.sort(key=lambda p: p.two_theta)
    return peaks


def orientation_ok(h: int, k: int, l: int, mode: str) -> bool:
    mode = (mode or "none").lower()
    if mode in {"none", "配向なし", ""}:
        return True
    if mode == "00l":
        return h == 0 and k == 0 and l != 0
    if mode == "h00":
        return h != 0 and k == 0 and l == 0
    if mode == "0k0":
        return h == 0 and k != 0 and l == 0
    if mode == "hk0":
        return l == 0
    return True


def ref_weight(peak: RefPeak, orientation_mode: str) -> float:
    inten = max(float(peak.intensity), 1.0)
    if orientation_mode and orientation_mode.lower() not in {"none", "配向なし", ""}:
        if orientation_ok(peak.h, peak.k, peak.l, orientation_mode):
            return inten * 1.5
        return inten * 0.35
    return inten


def nearest_peak(peaks: List[MeasuredPeak], target: float) -> Optional[MeasuredPeak]:
    if not peaks:
        return None
    # Linear is fine at this size.
    return min(peaks, key=lambda p: abs(p.two_theta - target))


def estimate_zero_shift(ref: PhaseReference, measured: List[MeasuredPeak], x_min: float, x_max: float, window: float) -> float:
    if not measured:
        return 0.0
    # Use strong reference peaks.
    candidates = [r for r in ref.peaks if x_min <= r.two_theta <= x_max and r.intensity >= 5]
    candidates = sorted(candidates, key=lambda r: r.intensity, reverse=True)[:20]
    diffs: List[float] = []
    weights: List[float] = []
    for r in candidates:
        mp = nearest_peak(measured, r.two_theta)
        if mp is None:
            continue
        diff = mp.two_theta - r.two_theta
        if abs(diff) <= window:
            diffs.append(diff)
            weights.append(max(r.intensity, 1))
    if len(diffs) < 2:
        return 0.0
    # Weighted median-like: repeat small integer weights safely.
    arr = np.array(diffs)
    return float(np.median(arr))


def match_phase(ref: PhaseReference, measured: List[MeasuredPeak], x_min: float, x_max: float,
                tolerance: float, orientation_mode: str, shift_window: float = DEFAULT_SHIFT_WINDOW_DEG) -> PhaseResult:
    zero_shift = estimate_zero_shift(ref, measured, x_min, x_max, shift_window)
    ref_peaks = [r for r in ref.peaks if x_min <= (r.two_theta + zero_shift) <= x_max and r.intensity >= 1]
    if not ref_peaks:
        return PhaseResult(ref.phase_name, ref.pdf_id, 0.0, zero_shift, 0, 0, 0, 0, orientation_mode, [], ref.color, ref.marker, "参照ピークが測定範囲外")

    matches: List[PeakMatch] = []
    matched_ref_ids = set()
    for ri, r in enumerate(ref_peaks):
        target = r.two_theta + zero_shift
        mp = nearest_peak(measured, target)
        if mp is None:
            continue
        diff = mp.two_theta - target
        if abs(diff) <= tolerance:
            matches.append(PeakMatch(ref_two_theta=r.two_theta, obs_two_theta=mp.two_theta, obs_intensity=mp.intensity,
                                    diff=diff, ref_intensity=r.intensity, h=r.h, k=r.k, l=r.l))
            matched_ref_ids.add(ri)

    weights = np.array([ref_weight(r, orientation_mode) for r in ref_peaks], dtype=float)
    denom = float(np.sum(weights)) if len(weights) else 1.0
    matched_weight = float(np.sum([weights[i] for i in matched_ref_ids])) if matched_ref_ids else 0.0
    position_score = matched_weight / max(denom, 1e-9)

    strong_refs = sorted(list(enumerate(ref_peaks)), key=lambda x: x[1].intensity, reverse=True)[:8]
    strong_ids = {i for i, _ in strong_refs}
    strong_matched = len(strong_ids.intersection(matched_ref_ids))
    strong_score = strong_matched / max(len(strong_refs), 1)

    top_obs = sorted(measured, key=lambda p: p.intensity, reverse=True)[:25]
    obs_explained = 0
    for op in top_obs:
        for r in ref_peaks:
            if abs(op.two_theta - (r.two_theta + zero_shift)) <= tolerance:
                obs_explained += 1
                break
    observed_score = obs_explained / max(len(top_obs), 1)

    # Intensity score: very loose. In orientation mode, it should not dominate.
    intensity_score = 0.0
    if len(matches) >= 3:
        ref_i = np.array([max(m.ref_intensity, 1.0) for m in matches], dtype=float)
        obs_i = np.array([max(m.obs_intensity, 1.0) for m in matches], dtype=float)
        try:
            corr = np.corrcoef(np.log(ref_i), np.log(obs_i))[0, 1]
            if np.isfinite(corr):
                intensity_score = max(0.0, min(1.0, (corr + 1.0) / 2.0))
        except Exception:
            intensity_score = 0.0

    has_orientation = orientation_mode and orientation_mode.lower() not in {"none", "配向なし", ""}
    if has_orientation:
        score = 0.58 * position_score + 0.28 * strong_score + 0.12 * observed_score + 0.02 * intensity_score
        notes = f"{orientation_mode}配向を仮定。強度比不一致の減点を弱めています。"
    else:
        score = 0.50 * position_score + 0.25 * strong_score + 0.15 * observed_score + 0.10 * intensity_score
        notes = ""
    score = float(max(0.0, min(1.0, score)))
    return PhaseResult(
        phase_name=ref.phase_name,
        pdf_id=ref.pdf_id,
        score=score,
        zero_shift=zero_shift,
        matched_count=len(matches),
        ref_count=len(ref_peaks),
        strong_matched_count=strong_matched,
        strong_ref_count=len(strong_refs),
        orientation_mode=orientation_mode or "none",
        matches=matches,
        color=ref.color,
        marker=ref.marker,
        notes=notes,
    )


def analyze(measurement_path: str | Path, reference_folder: str | Path, output_dir: str | Path,
            tolerance: float = DEFAULT_TOLERANCE_DEG, prominence: Optional[float] = None,
            orientation_mode: str = "none", top_n: int = 10) -> Tuple[List[PhaseResult], List[MeasuredPeak], Dict[str, Path]]:
    measurement_path = Path(measurement_path)
    reference_folder = Path(reference_folder)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    x, y = load_measurement(measurement_path)
    measured_peaks = detect_peaks(x, y, prominence=prominence)
    refs = load_reference_folder(reference_folder)

    x_min, x_max = float(np.nanmin(x)), float(np.nanmax(x))
    results = [match_phase(ref, measured_peaks, x_min, x_max, tolerance, orientation_mode) for ref in refs]
    results.sort(key=lambda r: r.score, reverse=True)
    shown = results[:max(1, top_n)]

    sample_name = measurement_path.stem
    plot_path = output_dir / f"{sample_name}_identified_plot.png"
    table_path = output_dir / f"{sample_name}_result_table.csv"
    peak_path = output_dir / f"{sample_name}_peak_list.csv"
    unmatched_path = output_dir / f"{sample_name}_unmatched_peaks.csv"
    report_path = output_dir / f"{sample_name}_match_report.txt"

    save_plot(x, y, measured_peaks, shown, plot_path)
    save_tables(results, measured_peaks, table_path, peak_path, unmatched_path, tolerance)
    save_report(measurement_path, reference_folder, results, measured_peaks, report_path, tolerance, prominence, orientation_mode)
    return results, measured_peaks, {"plot": plot_path, "table": table_path, "peaks": peak_path, "unmatched": unmatched_path, "report": report_path}


def save_plot(x: np.ndarray, y: np.ndarray, measured_peaks: List[MeasuredPeak], results: List[PhaseResult], out: Path) -> None:
    fig, ax = plt.subplots(figsize=(9, 5), dpi=150)
    ax.plot(x, y, color="black", lw=0.7, label="Measured")
    max_y = float(np.nanmax(y)) if len(y) else 1.0
    used_labels = set()
    for r in results:
        if r.score <= 0 or not r.matches:
            continue
        xs = [m.obs_two_theta for m in r.matches]
        # Put marker slightly above observed intensity so it is visible.
        ys = []
        for m in r.matches:
            idx = int(np.argmin(np.abs(x - m.obs_two_theta)))
            ys.append(float(y[idx]) + max_y * 0.025)
        label = f"{r.phase_name} ({r.score:.2f})"
        if label in used_labels:
            label = None
        else:
            used_labels.add(label)
        ax.scatter(xs, ys, marker=r.marker, color=r.color, s=34, label=label, zorder=5)
    ax.set_xlabel(r"2$\theta$ (deg.)   Cu-K$\alpha$")
    ax.set_ylabel("Intensity (arb. units)")
    ax.set_xlim(float(np.nanmin(x)), float(np.nanmax(x)))
    ax.set_ylim(bottom=min(0, float(np.nanmin(y))), top=max_y * 1.15)
    ax.grid(alpha=0.15)
    ax.legend(loc="upper right", frameon=False, fontsize=8)
    fig.tight_layout()
    fig.savefig(out)
    plt.close(fig)


def save_tables(results: List[PhaseResult], measured: List[MeasuredPeak], table_path: Path, peak_path: Path, unmatched_path: Path, tolerance: float) -> None:
    with table_path.open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["rank", "phase", "pdf_id", "score", "zero_shift_deg", "matched_ref_peaks", "ref_peaks_in_range", "strong_matched", "strong_ref", "orientation", "notes"])
        for i, r in enumerate(results, 1):
            w.writerow([i, r.phase_name, r.pdf_id, f"{r.score:.4f}", f"{r.zero_shift:.4f}", r.matched_count, r.ref_count, r.strong_matched_count, r.strong_ref_count, r.orientation_mode, r.notes])

    with peak_path.open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["two_theta", "intensity", "prominence"])
        for p in measured:
            w.writerow([f"{p.two_theta:.4f}", f"{p.intensity:.6g}", f"{p.prominence:.6g}"])

    # Unmatched peak list against all result phases with score > 0.1.
    strong_results = [r for r in results if r.score > 0.1]
    with unmatched_path.open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["two_theta", "intensity", "prominence"])
        for p in measured:
            explained = False
            for r in strong_results:
                for m in r.matches:
                    if abs(p.two_theta - m.obs_two_theta) <= tolerance:
                        explained = True
                        break
                if explained:
                    break
            if not explained:
                w.writerow([f"{p.two_theta:.4f}", f"{p.intensity:.6g}", f"{p.prominence:.6g}"])


def save_report(measurement_path: Path, reference_folder: Path, results: List[PhaseResult], peaks: List[MeasuredPeak],
                report_path: Path, tolerance: float, prominence: Optional[float], orientation_mode: str) -> None:
    lines: List[str] = []
    lines.append(f"{APP_NAME}")
    lines.append("=" * 60)
    lines.append(f"測定データ: {measurement_path}")
    lines.append(f"参照値フォルダ: {reference_folder}")
    lines.append(f"2θ許容幅: ±{tolerance:.3f} deg")
    lines.append(f"ピークprominence: {'auto' if not prominence else prominence}")
    lines.append(f"配向仮定: {orientation_mode}")
    lines.append("")
    lines.append(f"検出ピーク数: {len(peaks)}")
    lines.append("上位候補相:")
    for i, r in enumerate(results[:10], 1):
        lines.append(f"  {i}. {r.phase_name}  score={r.score:.3f}  matched={r.matched_count}/{r.ref_count}  shift={r.zero_shift:+.4f} deg  {r.notes}")
        if r.matches:
            topm = sorted(r.matches, key=lambda m: m.obs_intensity, reverse=True)[:8]
            match_text = ", ".join([f"{m.obs_two_theta:.2f}°({m.h}{m.k}{m.l})" for m in topm])
            lines.append(f"     根拠ピーク例: {match_text}")
    lines.append("")
    lines.append("注意:")
    lines.append("- この結果は候補相の自動スコアリングであり，相の最終確定ではありません。")
    lines.append("- 配向，ピーク重畳，固溶によるピークシフト，バックグラウンドにより強度比は崩れます。")
    lines.append("- 重要ピークは必ず元データと参照値で目視確認してください。")
    report_path.write_text("\n".join(lines), encoding="utf-8-sig")


def result_text(results: List[PhaseResult], peaks: List[MeasuredPeak], paths: Dict[str, Path]) -> str:
    lines = []
    lines.append(f"検出ピーク数: {len(peaks)}")
    lines.append("")
    lines.append("候補相ランキング")
    lines.append("-" * 60)
    for i, r in enumerate(results[:10], 1):
        lines.append(f"{i:>2}. {r.phase_name:<32} score={r.score:.3f}  matched={r.matched_count}/{r.ref_count}  shift={r.zero_shift:+.4f}°")
        if r.notes:
            lines.append(f"    注意: {r.notes}")
        if r.matches:
            mtxt = ", ".join([f"{m.obs_two_theta:.2f}°" for m in sorted(r.matches, key=lambda m: m.obs_intensity, reverse=True)[:8]])
            lines.append(f"    根拠ピーク例: {mtxt}")
    lines.append("")
    lines.append("出力ファイル")
    for k, v in paths.items():
        lines.append(f"- {k}: {v}")
    return "\n".join(lines)


class XRDApp:
    def __init__(self, root: "tk.Tk"):
        self.root = root
        self.root.title(APP_NAME)
        self.measurement_var = tk.StringVar(value=str(resource_path("sample_data/007_Ba3Cu2Fe24O41_1050C.TXT")))
        self.reference_var = tk.StringVar(value=str(resource_path("reference_db")))
        self.output_var = tk.StringVar(value=str(resource_path("output")))
        self.tolerance_var = tk.StringVar(value="0.25")
        self.prominence_var = tk.StringVar(value="")
        self.orientation_var = tk.StringVar(value="none")
        self.build_ui()

    def build_ui(self) -> None:
        pad = {"padx": 8, "pady": 5}
        frm = ttk.Frame(self.root)
        frm.pack(fill="both", expand=True)

        ttk.Label(frm, text=APP_NAME, font=("Arial", 14, "bold")).grid(row=0, column=0, columnspan=3, sticky="w", **pad)

        ttk.Label(frm, text="測定データ").grid(row=1, column=0, sticky="w", **pad)
        ttk.Entry(frm, textvariable=self.measurement_var, width=70).grid(row=1, column=1, sticky="ew", **pad)
        ttk.Button(frm, text="選択", command=self.choose_measurement).grid(row=1, column=2, **pad)

        ttk.Label(frm, text="参照値フォルダ").grid(row=2, column=0, sticky="w", **pad)
        ttk.Entry(frm, textvariable=self.reference_var, width=70).grid(row=2, column=1, sticky="ew", **pad)
        ttk.Button(frm, text="選択", command=self.choose_reference).grid(row=2, column=2, **pad)

        ttk.Label(frm, text="出力フォルダ").grid(row=3, column=0, sticky="w", **pad)
        ttk.Entry(frm, textvariable=self.output_var, width=70).grid(row=3, column=1, sticky="ew", **pad)
        ttk.Button(frm, text="選択", command=self.choose_output).grid(row=3, column=2, **pad)

        opts = ttk.Frame(frm)
        opts.grid(row=4, column=0, columnspan=3, sticky="ew", **pad)
        ttk.Label(opts, text="2θ許容幅").pack(side="left")
        ttk.Entry(opts, textvariable=self.tolerance_var, width=8).pack(side="left", padx=5)
        ttk.Label(opts, text="prominence（空欄で自動）").pack(side="left")
        ttk.Entry(opts, textvariable=self.prominence_var, width=10).pack(side="left", padx=5)
        ttk.Label(opts, text="配向仮定").pack(side="left")
        ttk.Combobox(opts, textvariable=self.orientation_var, width=10, values=["none", "00l", "h00", "0k0", "hk0"], state="readonly").pack(side="left", padx=5)
        ttk.Button(opts, text="解析実行", command=self.run_analysis).pack(side="left", padx=10)

        self.text = tk.Text(frm, height=24, width=100)
        self.text.grid(row=5, column=0, columnspan=3, sticky="nsew", **pad)
        self.text.insert("end", "測定データと参照値フォルダを指定して［解析実行］を押してください。\n同梱サンプルはM-type参照値のみなので，まずは動作確認用です。\n")

        frm.columnconfigure(1, weight=1)
        frm.rowconfigure(5, weight=1)

    def choose_measurement(self) -> None:
        path = filedialog.askopenfilename(title="測定XRDデータを選択", filetypes=[("XRD files", "*.txt *.csv *.dat *.xy"), ("All files", "*.*")])
        if path:
            self.measurement_var.set(path)

    def choose_reference(self) -> None:
        path = filedialog.askdirectory(title="参照値フォルダを選択")
        if path:
            self.reference_var.set(path)

    def choose_output(self) -> None:
        path = filedialog.askdirectory(title="出力フォルダを選択")
        if path:
            self.output_var.set(path)

    def run_analysis(self) -> None:
        try:
            tol = float(self.tolerance_var.get())
            prom_txt = self.prominence_var.get().strip()
            prom = float(prom_txt) if prom_txt else None
            results, peaks, paths = analyze(
                self.measurement_var.get(),
                self.reference_var.get(),
                self.output_var.get(),
                tolerance=tol,
                prominence=prom,
                orientation_mode=self.orientation_var.get(),
                top_n=10,
            )
            self.text.delete("1.0", "end")
            self.text.insert("end", result_text(results, peaks, paths))
            messagebox.showinfo("解析完了", f"解析が完了しました。\nグラフ: {paths['plot']}")
        except Exception as e:
            self.text.delete("1.0", "end")
            self.text.insert("end", traceback.format_exc())
            messagebox.showerror("エラー", str(e))


def main() -> None:
    # CLI mode:
    # python xrd_identifier_prototype.py measurement.txt reference_folder output_folder --orientation 00l --tol 0.25
    if len(sys.argv) >= 4:
        measurement = sys.argv[1]
        ref_folder = sys.argv[2]
        out_folder = sys.argv[3]
        orientation = "none"
        tol = DEFAULT_TOLERANCE_DEG
        prom = None
        args = sys.argv[4:]
        for i, a in enumerate(args):
            if a == "--orientation" and i + 1 < len(args):
                orientation = args[i + 1]
            elif a == "--tol" and i + 1 < len(args):
                tol = float(args[i + 1])
            elif a == "--prominence" and i + 1 < len(args):
                prom = float(args[i + 1])
        results, peaks, paths = analyze(measurement, ref_folder, out_folder, tolerance=tol, prominence=prom, orientation_mode=orientation)
        print(result_text(results, peaks, paths))
        return

    if tk is None:
        print("Tkinterが利用できません。CLI形式で実行してください。")
        sys.exit(1)
    root = tk.Tk()
    root.geometry("980x650")
    app = XRDApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
