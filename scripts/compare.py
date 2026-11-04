import subprocess, numpy as np, sys, os
sys.stdout.reconfigure(encoding="utf-8")
def dist(p,t0,dur=6,W=480,H=270):
    d=subprocess.run(["ffmpeg","-v","error","-ss",str(t0),"-t",str(dur),"-i",p,"-vf","fps=15,scale=%dx%d,format=gray"%(W,H),"-f","rawvideo","-"],capture_output=True).stdout
    n=len(d)//(W*H)
    if n<5: return None
    fr=np.frombuffer(d[:n*W*H],dtype=np.uint8).reshape(n,H,W).astype(np.float32)
    a=np.concatenate([np.abs(fr[i+1]-fr[i]).ravel() for i in range(n-1)])
    return (a>20).mean()*100, (a>40).mean()*100, np.percentile(a,99)

# 参考片：每 25 秒取一点，算全片平均
refs=[]
for base in ("bxy","bxy2","ref2"):
    dd=os.path.join(os.environ["TEMP"],base)
    if not os.path.isdir(dd): continue
    for f in sorted(os.listdir(dd)):
        if not f.endswith(".mp4"): continue
        p=os.path.join(dd,f)
        dur=float(subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",p],capture_output=True).stdout or 160)
        vals=[]
        for t in range(10,int(dur)-8,25):
            r=dist(p,t,5)
            if r: vals.append(r)
        if vals:
            v=np.array(vals)
            refs.append(v.mean(axis=0))
            print("%-16s >20=%5.2f%%  >40=%5.2f%%  P99=%5.1f" % (f[:-4][:16], v[:,0].mean(), v[:,1].mean(), v[:,2].mean()))
print("-"*54)
r=np.array(refs)
print("%-16s >20=%5.2f%%  >40=%5.2f%%  P99=%5.1f  <= 参考片均值" % ("参考片", r[:,0].mean(), r[:,1].mean(), r[:,2].mean()))

ours=r"C:\Users\ZhiMo\Documents\deepseek-harness\创作工作区\vibe-10w\film\out\main.mp4"
vals=[]
for t in range(5,128,6):
    x=dist(ours,t,5)
    if x: vals.append(x)
v=np.array(vals)
print("%-16s >20=%5.2f%%  >40=%5.2f%%  P99=%5.1f  <= 我们 v53" % ("我们", v[:,0].mean(), v[:,1].mean(), v[:,2].mean()))
