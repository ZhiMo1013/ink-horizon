"""素材挑选器：把一堆视频按「能不能用」排序，并拼成一张缩略图总览。

用途：几十个 AI 生成的片段，不可能一个个看完。这个脚本做三件事：
  1. 量每个片段的客观指标（能不能播、有没有黑帧、画面动没动、亮不亮、稳不稳）
  2. 按「MAD 可用度」打分排序
  3. 每个片段抽 4 帧拼成一张总览图，人扫一眼就能定取舍

为什么这些指标对挑素材有用：
  · 黑帧/坏帧    → 直接废，AI 生成最常见的失败
  · 画面运动量   → MAD 里能用的是「有动作」的，纯静止的画面剪进去是空镜
  · 亮度         → 太暗的片段放进成片会「陷下去」，跟别的镜头不搭
  · 亮度抖动     → AI 视频典型的闪烁毛病，闪得厉害的没法用
  · 边缘/高频    → 糊不糊，分辨率够不够

用法：
    python pick.py <目录或文件...> [--out 报告.json]
"""
import subprocess, numpy as np, sys, os, io, json, argparse

sys.stdout.reconfigure(encoding="utf-8")
VIDEO_EXT = (".mp4", ".mov", ".mkv", ".webm", ".avi")


def probe(path):
    """拿时长/分辨率/帧率。用 ffprobe -of json，不要解析 f32le 那种带 '/' 的分数帧率。"""
    r = subprocess.run(["ffprobe", "-v", "error", "-print_format", "json",
                        "-show_format", "-show_streams", path],
                       capture_output=True, text=True, encoding="utf-8", errors="ignore")
    try:
        d = json.loads(r.stdout)
    except Exception:
        return None
    vs = [s for s in d.get("streams", []) if s.get("codec_type") == "video"]
    if not vs:
        return None
    v = vs[0]
    dur = float(d.get("format", {}).get("duration") or v.get("duration") or 0)
    return dict(dur=dur, w=int(v.get("width") or 0), h=int(v.get("height") or 0),
                fps=v.get("r_frame_rate") or "?", codec=v.get("codec_name") or "?")


def grab(path, fps=10, W=256, H=144):
    """抽成灰度小帧序列。缩到 256×144 是为了快 —— 判断「动没动」不需要原分辨率。"""
    d = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf",
                        "fps=%d,scale=%dx%d,format=gray" % (fps, W, H),
                        "-f", "rawvideo", "-"], capture_output=True).stdout
    n = len(d) // (W * H)
    if n < 3:
        return None
    return np.frombuffer(d[:n * W * H], dtype=np.uint8).reshape(n, H, W).astype(np.float32)


def metrics(path):
    info = probe(path)
    if not info:
        return None
    fr = grab(path)
    if fr is None:
        return None
    n, H, W = fr.shape

    # ① 帧间差：整体在动多少
    dif = np.abs(np.diff(fr, axis=0))
    per = dif.mean(axis=(1, 2))

    # ② 黑帧：整帧几乎没有亮部 = 生成失败或转场
    lit = (fr > 40).mean(axis=(1, 2))
    black = float((lit < 0.006).mean() * 100)

    # ③ 亮度 / 对比：太暗的镜头剪进成片会「陷下去」
    meanY = float(fr.mean())
    p99 = float(np.percentile(fr, 99))

    # ④ 亮度抖动：AI 视频典型的闪烁。相邻帧平均亮度的跳变幅度
    mb = fr.mean(axis=(1, 2))
    flicker = float(np.abs(np.diff(mb)).mean())

    # ⑤ 清晰度：相邻像素差的均值，糊的片段这个值低
    sharp = float(np.abs(np.diff(fr[0], axis=1)).mean())

    # ⑥ 冻结：连续 10 帧里有多少比例几乎不变（AI 视频常见「卡住了」）
    if n > 12:
        still = (per < 0.05).astype(float)
        roll = np.convolve(still, np.ones(10) / 10, "valid")
        frz = float(roll.max() * 100) if len(roll) else 0.0
    else:
        frz = 0.0

    return dict(dur=round(info["dur"], 2), w=info["w"], h=info["h"], fps=info["fps"],
                codec=info["codec"], frames=n,
                motion=round(float(np.median(per)), 3),
                motion_p90=round(float(np.percentile(per, 90)), 3),
                black=round(black, 1), meanY=round(meanY, 1), p99=round(p99, 1),
                flicker=round(flicker, 2), sharp=round(sharp, 1), freeze=round(frz, 1))


def score(m):
    """MAD 可用度 0–100。权重按「这个毛病会不会让人直接弃用」来定。

    先看废不废（黑帧/冻结/太暗），再看能不能用（有没有动作），最后看加分项。
    """
    s = 0.0
    note = []

    # 一票否决项
    if m["black"] > 25:
        note.append("黑帧太多")
        return 0, note
    if m["freeze"] > 60:
        note.append("画面卡住")
        return 0, note
    if m["meanY"] < 8:
        note.append("太暗")
        return max(0, 20), note

    # 动作（25）：MAD 要的是有动作的镜头，纯静态的只能当空镜
    mo = m["motion"]
    if mo >= 2.0:
        s += 25
    elif mo >= 1.0:
        s += 20
    elif mo >= 0.4:
        s += 14
    elif mo >= 0.15:
        s += 7
        note.append("偏静")
    else:
        s += 2
        note.append("几乎不动")

    # 亮度（20）：中段亮度最好用，太暗发闷、太亮没层次
    y = m["meanY"]
    if 25 <= y <= 120:
        s += 20
    elif 15 <= y < 25 or 120 < y <= 170:
        s += 13
    elif 8 <= y < 15:
        s += 6
        note.append("偏暗")
    else:
        s += 2
        note.append("太暗/过曝")

    # 动态范围（20）：有明暗层次才像个镜头
    rng = m["p99"] - m["meanY"]
    if rng >= 90:
        s += 20
    elif rng >= 60:
        s += 15
    elif rng >= 35:
        s += 9
    else:
        s += 3
        note.append("没层次")

    # 稳定（20）：闪烁是 AI 视频最刺眼的毛病
    fl = m["flicker"]
    if fl <= 0.6:
        s += 20
    elif fl <= 1.2:
        s += 14
    elif fl <= 2.5:
        s += 7
        note.append("有闪烁")
    else:
        s += 1
        note.append("闪得厉害")

    # 清晰（15）
    sh = m["sharp"]
    if sh >= 6:
        s += 15
    elif sh >= 3.5:
        s += 10
    elif sh >= 2:
        s += 5
        note.append("偏糊")
    else:
        s += 1
        note.append("很糊")

    return round(min(100, s)), note


def collect(paths):
    out = []
    for p in paths:
        if os.path.isdir(p):
            for root, _, files in os.walk(p):
                for f in files:
                    if f.lower().endswith(VIDEO_EXT):
                        out.append(os.path.join(root, f))
        elif os.path.isfile(p) and p.lower().endswith(VIDEO_EXT):
            out.append(p)
    return sorted(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("paths", nargs="+")
    ap.add_argument("--out", default=None, help="把结果写成 JSON")
    ap.add_argument("--skip", default=None, help="跳过路径里包含这些字串的（逗号分隔）")
    a = ap.parse_args()

    files = collect(a.paths)
    if a.skip:
        sk = [x.strip() for x in a.skip.split(",") if x.strip()]
        files = [f for f in files if not any(k in f for k in sk)]

    rows = []
    for i, p in enumerate(files, 1):
        m = metrics(p)
        if not m:
            print("  [%d/%d] 读不了: %s" % (i, len(files), os.path.basename(p)))
            continue
        sc, notes = score(m)
        rows.append(dict(path=p, name=os.path.basename(p), score=sc,
                         notes=notes, **m))
        print("  [%d/%d] %-52s %3d  %s" % (i, len(files), os.path.basename(p)[:52], sc,
                                           "、".join(notes)))

    rows.sort(key=lambda r: -r["score"])
    print("\n" + "=" * 96)
    print("%-4s %-46s %5s %6s %6s %6s %6s %6s" %
          ("排名", "文件", "分", "时长", "运动", "亮度", "闪烁", "清晰"))
    print("-" * 96)
    for i, r in enumerate(rows, 1):
        print("%-4d %-46s %5d %5.1fs %6.2f %6.1f %6.2f %6.1f  %s" %
              (i, r["name"][:46], r["score"], r["dur"], r["motion"],
               r["meanY"], r["flicker"], r["sharp"], "、".join(r["notes"])))

    if a.out:
        io.open(a.out, "w", encoding="utf-8").write(
            json.dumps(rows, ensure_ascii=False, indent=1))
        print("\n报告写到: %s" % a.out)


if __name__ == "__main__":
    main()
