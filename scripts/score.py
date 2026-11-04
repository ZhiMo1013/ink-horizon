import subprocess, numpy as np, sys, os
sys.stdout.reconfigure(encoding="utf-8")

REF_PATHS = []
for base in ("bxy", "bxy2", "ref2"):
    d = os.path.join(os.environ["TEMP"], base)
    if os.path.isdir(d):
        for f in os.listdir(d):
            if f.endswith(".mp4"):
                REF_PATHS.append((f[:-4], os.path.join(d, f)))

def frames_of(path, fps=15, W=320, H=180):
    d = subprocess.run(["ffmpeg","-v","error","-i",path,"-vf",
                        "fps=%d,scale=%dx%d,format=gray"%(fps,W,H),
                        "-f","rawvideo","-"], capture_output=True).stdout
    n = len(d)//(W*H)
    if n < 30: return None
    return np.frombuffer(d[:n*W*H], dtype=np.uint8).reshape(n,H,W).astype(np.float32)

def metrics(path):
    fps = 15
    fr = frames_of(path)
    if fr is None: return None
    H = fr.shape[1]; W = fr.shape[2]
    dif = np.abs(np.diff(fr, axis=0))
    m = dif.mean(axis=(1,2))
    # 用「滚动中位数」而不是均值 —— 切点那一两帧的尖峰不会抬高整段，
    # 这样量的才是「内容不动的时候，画面有多安静」。
    WIN = 15
    rolls = np.array([np.median(m[s:s+WIN]) for s in range(0, max(1,len(m)-WIN), 5)])
    calm = float(np.min(rolls)) if len(rolls) else 0.0

    base = float(np.median(m))
    thr = max(base*10, 1.5)
    hit = np.where(m > thr)[0]
    events = 0
    if len(hit):
        events = 1; prev = hit[0]
        for x in hit[1:]:
            if x - prev > 10: events += 1
            prev = x
    burst = float((m > thr).mean()*100)
    step = max(1, len(fr)//60)
    lits = []
    for i in range(0, len(fr), step):
        f = fr[i]; body = f[:int(H*0.78)]
        eh, ew = body.shape[0]//4, body.shape[1]//10
        cells = np.zeros((4,10))
        for r in range(4):
            for c in range(10):
                cell = body[r*eh:(r+1)*eh, c*ew:(c+1)*ew]
                cells[r,c] = np.abs(np.diff(cell,axis=1)).mean() + np.abs(np.diff(cell,axis=0)).mean()
        lits.append(cells > 1.2)
    cellsN = float(np.array(lits).mean(axis=0).sum())
    return dict(dur=len(fr)/fps, calm=round(calm,4), med=round(float(np.median(m)),3),
                cuts=int(events), burst=round(burst,1), cells=round(cellsN,1))

def score(m, tech_ok):
    s = {}
    c, mm = m["calm"], m["med"]
    s["静得下来"] = 25 if c <= 0.02 else (16 if c <= 0.06 else (8 if c <= 0.15 else 0))
    s["内容运动"] = 20 if 0.30 <= mm <= 0.80 else (14 if 0.18 <= mm < 0.30 or 0.80 < mm <= 1.40 else (7 if mm >= 0.10 else 0))
    ratio = (mm / max(c, 1e-4))
    s["动静对比"] = 15 if ratio >= 12 else (10 if ratio >= 6 else (4 if ratio >= 3 else 0))
    s["切点密度"] = 15 if 20 <= m["cuts"] <= 65 else (10 if 12 <= m["cuts"] < 20 or 65 < m["cuts"] <= 95 else (4 if m["cuts"] >= 6 else 0))
    cc = m["cells"]
    s["空间利用"] = 15 if 15 <= cc <= 30 else (9 if 10 <= cc < 15 or 30 < cc <= 36 else (3 if cc >= 6 else 0))
    s["技术合规"] = 10 if tech_ok else 0
    return sum(s.values()), s

if __name__ == "__main__":
    print("="*80)
    print("%-18s %6s %6s %6s %5s %6s %6s" % ("", "最静", "中位", "时长", "切点", "爆发%", "格子"))
    print("-"*80)
    for name, p in REF_PATHS:
        m = metrics(p)
        if m:
            tot, _ = score(m, True)
            print("%-18s %6.4f %6.3f %5.0fs %5d %6.1f %6.1f   总分%3d" % (
                name[:18], m["calm"], m["med"], m["dur"], m["cuts"], m["burst"], m["cells"], tot))
    targets = [a for a in sys.argv[1:] if os.path.exists(a)]
    for p in targets:
        m = metrics(p)
        if not m: continue
        r = subprocess.run(["ffmpeg","-v","error","-i",p,"-f","null","-"], capture_output=True)
        tot, s = score(m, r.returncode == 0)
        print("-"*80)
        print("%-18s %6.4f %6.3f %5.0fs %5d %6.1f %6.1f   总分%3d" % (
            os.path.basename(os.path.dirname(os.path.dirname(p)))[:18] or "ours",
            m["calm"], m["med"], m["dur"], m["cuts"], m["burst"], m["cells"], tot))
        for k, v in s.items():
            print("     %-8s %3d" % (k, v))
