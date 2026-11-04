import subprocess, numpy as np, sys, os
sys.stdout.reconfigure(encoding="utf-8")

def blocks(path, per=5.0, fps=15):
    W, H = 320, 180
    d = subprocess.run(["ffmpeg","-v","error","-i",path,"-vf",
                        "fps=%d,scale=%dx%d,format=gray"%(fps,W,H),
                        "-f","rawvideo","-"], capture_output=True).stdout
    n = len(d)//(W*H)
    fr = np.frombuffer(d[:n*W*H], dtype=np.uint8).reshape(n,H,W).astype(np.float32)
    m = np.abs(np.diff(fr, axis=0)).mean(axis=(1,2))
    per_n = int(per*fps)
    bl = np.array([m[i:i+per_n].mean() for i in range(0, max(1,len(m)-per_n), per_n)])
    return bl

refs = []
for base in ("bxy","bxy2","ref2"):
    dd = os.path.join(os.environ["TEMP"], base)
    if os.path.isdir(dd):
        for f in sorted(os.listdir(dd)):
            if f.endswith(".mp4"):
                refs.append((f[:-4], os.path.join(dd,f)))

print("%-16s %8s %8s %8s %8s" % ("", "中位", "P10", "P90", "P90/P10"))
allmed, allr = [], []
for nm, p in refs:
    b = blocks(p)
    if len(b) < 6: continue
    p10, p90 = np.percentile(b,10), np.percentile(b,90)
    allmed.append(np.median(b)); allr.append(p90/max(p10,1e-6))
    print("%-16s %8.3f %8.3f %8.3f %8.1f" % (nm[:16], np.median(b), p10, p90, p90/max(p10,1e-6)))
print("-"*56)
print("%-16s %8.3f %8s %8s %8.1f" % ("参考片均值", np.mean(allmed), "", "", np.mean(allr)))

ours = r"C:\Users\ZhiMo\Documents\deepseek-harness\创作工作区\vibe-10w\film\out\main.mp4"
b = blocks(ours)
p10, p90 = np.percentile(b,10), np.percentile(b,90)
print("%-16s %8.3f %8.3f %8.3f %8.1f" % ("我们 v45", np.median(b), p10, p90, p90/max(p10,1e-6)))
