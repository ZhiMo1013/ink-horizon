# -*- coding: utf-8 -*-
"""dead.py — 扫出全片所有静止段。
判据：相邻帧 mean 差 < 0.02 且连续 >= 0.6 秒，记为一段死区。
参考片实测：0.40-3.60 秒（最长）。超过 2 秒就该修。
用法: python dead.py <mp4> [--fps 4] [--thr 0.02] [--min 0.6]
"""
import subprocess, sys, os, argparse
import numpy as np

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("--fps", type=int, default=4)
    ap.add_argument("--thr", type=float, default=0.02)
    ap.add_argument("--min", type=float, default=0.6)
    ap.add_argument("--w", type=int, default=320)
    ap.add_argument("--h", type=int, default=180)
    a = ap.parse_args()

    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", a.video,
         "-vf", f"fps={a.fps},scale={a.w}x{a.h},format=gray", "-f", "rawvideo", "-"],
        capture_output=True).stdout
    n = len(raw) // (a.w * a.h)
    if n < 3:
        print("too short"); return
    fr = np.frombuffer(raw[:n * a.w * a.h], dtype=np.uint8).reshape(n, a.h, a.w).astype(np.float32)
    m = np.abs(np.diff(fr, axis=0)).mean(axis=(1, 2))
    step = 1.0 / a.fps

    dead = m < a.thr
    segs, start = [], None
    for i, d in enumerate(dead):
        if d and start is None: start = i
        elif not d and start is not None:
            if (i - start) * step >= a.min: segs.append((start * step, i * step))
            start = None
    if start is not None and (len(dead) - start) * step >= a.min:
        segs.append((start * step, len(dead) * step))

    total = sum(e - s for s, e in segs)
    print(f"duration {n*step:.2f}s  dead {len(segs)} 段  合计 {total:.1f}s ({total/(n*step)*100:.1f}%)")
    for s, e in segs:
        print(f"  {s:6.2f} - {e:6.2f}   {e-s:4.2f}s")
    if segs:
        print(f"最长 {max(e-s for s,e in segs):.2f}s（参考片 0.40-3.60s）")

if __name__ == "__main__":
    main()