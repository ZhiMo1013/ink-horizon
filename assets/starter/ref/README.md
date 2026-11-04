# ref/ —— 引用素材放这里

这个目录在原工程里是**这三类文件**，本发行包已移除（第三方版权）：

```
ref/
  bgm.m4a                    ← 配乐。必须自己找一首，实测 BPM 写进 timeline.js
  voice/quote_main.wav       ← 引用原声（如果你片子里要放别人的原话）
  voice/quote_formula.wav
  covers/BVxxxxxxxxx.jpg     ← 引用来源的封面缩略图（画在"收据卡"上）
```

## 怎么补

1. **BGM**：找一首 100–125 BPM 的器乐曲，测出真实 BPM：
   ```bash
   node <skill>/scripts/audio.mjs beats ref/bgm.m4a
   ```
   把测出来的 BPM 填进 `timeline.js` 的 `BPM`，**然后所有拍点自动对上**。

2. **原声**（可选）：如果你片子里引用了别人的话，把那段剪出来（2–4 秒），
   放进 `voice/`，在 `timeline.js` 的 `VOICE` 里登记。**注意版权：引用可，分发不可。**

3. **封面**（可选）：`covers/<BV号>.jpg`，B 站封面的下载法：
   ```
   api.bilibili.com/x/web-interface/view?bvid=<BV号>  →  data.pic
   ```
   把 `http` 改 `https`、去掉 `@` 后面的参数，带 `Referer: https://www.bilibili.com` 下载。

## 没有这些会怎样

- 没有 BGM → `audio.mjs build` 报错。可以先用 `score.mjs` 里的合成器造一段（看 `scripts/lib/synth.mjs`）
- 没有 voice → 删掉 `timeline.js` 里的 `VOICE` 数组即可
- 没有 covers → 删掉 `timeline.js` 里的 `SOURCES`，并把 `scene.admit` 的图片分支跳过
