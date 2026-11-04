import subprocess, numpy as np, sys, os
sys.stdout.reconfigure(encoding="utf-8")

p = r"C:\Users\ZhiMo\Documents\deepseek-harness\创作工作区\vibe-10w\film\out\main.mp4"
W, H = 384, 216
d = subprocess.run(["ffmpeg","-v","error","-i",p,"-vf","fps=2,scale=%dx%d,format=gray"%(W,H),
                    "-f","rawvideo","-"], capture_output=True).stdout
n = len(d)//(W*H)
fr = np.frombuffer(d[:n*W*H], dtype=np.uint8).reshape(n,H,W).astype(np.float32)

seg = [("00 quote",0,13.89),("01 proof",13.89,33.11),("02 A",33.11,50.4),
       ("02 B",50.4,64.4),("02 C",64.4,74.77),("02 D 天平",74.77-8.1,74.77),
       ("03 admit",74.77,94.0),("04 prod",94.0,107.87),("05 ruler",107.87,121.78),
       ("06 end",121.78,134.57)]

def cells_of(f):
    body = f[:int(H*0.78)]
    eh, ew = body.shape[0]//4, body.shape[1]//10
    c = np.zeros((4,10))
    for r in range(4):
        for q in range(10):
            cell = body[r*eh:(r+1)*eh, q*ew:(q+1)*ew]
            c[r,q] = np.abs(np.diff(cell,axis=1)).mean() + np.abs(np.diff(cell,axis=0)).mean()
    return c > 1.2

print("%-12s %6s %8s" % ("段","格子","中央占比"))
for nm, t0, t1 in seg:
    a, b = int(t0*2), int(t1*2)
    if b - a < 2: continue
    acc = np.zeros((4,10))
    for i in range(a, min(b, n)):
        acc += cells_of(fr[i])
    acc /= max(1, min(b,n)-a)
    center = acc[1:3, 3:7].mean()*100
    print("%-12s %6.1f %7.1f%%" % (nm, acc.sum(), center))
