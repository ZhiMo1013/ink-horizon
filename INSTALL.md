# 安装（60 秒）

## 1. 放进去

```bash
# macOS / Linux
cp -r ink-horizon ~/.dsh/skills/

# Windows (PowerShell)
Copy-Item -Recurse ink-horizon "$env:USERPROFILE\.dsh\skills\"
```

（如果你用的不是 DSH，把 `~/.dsh/skills` 换成你的 agent 的 skills 目录即可。）

## 2. 装依赖（必须，26 MB）

```bash
cd <skill>/scripts
npm install --no-audit --no-fund
```

> 用**官方源**，别改镜像。实测 `registry.npmjs.org` 205 秒能装完，
> 而某些镜像装到一半会去拉 `bnpm.byted.org` 然后失败。

## 3. 检查环境

```bash
node <skill>/scripts/check-env.mjs
```

应该看到六行 `[ok]`，最后一行是 `ready`。

**如果没有 headless browser**：本 skill 用 Playwright 逐帧截图。
Windows 上它会自动找 Edge（不需要装 Chrome）；其他平台跑
`npx playwright install chromium`。

## 4. 补素材

看 `assets/starter/ref/README.md`。最少只需要一首 BGM。

## 5. 建一个工程

**不要手动 cp `assets/starter`** —— 它不自包含，还得带上 `fonts/`（12.7MB）。
漏了字体，页面会静默 404，然后 `render(t)` 抛 `A network error occurred`，
看起来像引擎坏了，其实是少了两百个字体分片。

用脚手架：

```bash
node <skill>/scripts/new-film.mjs ~/my-film
```

它会复制模板 + 字体 + 建好空目录，并把你缺的素材列出来。

## 6. 试跑

```bash
cd ~/my-film
npm install --no-audit --no-fund        # 约 6 分钟，只装一次
node <skill>/scripts/render.mjs ~/my-film --still 5,30,90 --sheet
```

出 `qa/stills/sheet.png` 就说明通了。

> **两个 node_modules**：`render.mjs` 用的是**它自己所在目录**的 node_modules
> （即 `<skill>/scripts/node_modules`），工程里那份是给 `score.mjs`/`audio.mjs` 用的。
> 嫌麻烦就只装 skill 那份，然后工程里也做个软链或者直接拷过去。

## 7. 如果你要改 SKILL.md

SKILL.md 里第 0 节「环境自检」写了一个绝对路径（`C:\Users\...\python.exe`），
那是原作者的机器。**换成你自己的 python 路径**，或者直接用 `python3`/`python`。
