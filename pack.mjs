#!/usr/bin/env node
// pack.mjs — 把 ink-horizon 打成一个可以公开分发的干净包。
//
// 为什么需要它：skill 目录里有三样东西不能公开——
//   ① 版权素材（BGM、别人的封面、别人的原声）→ 删，换成占位说明
//   ② node_modules（26MB，可重建）→ 删，写进 install 步骤
//   ③ 本地绝对路径与个人作品细节 → 换成通用写法，原版留在原处
//
// 用法：
//   node pack.mjs                     # 生成到 ./dist/ink-horizon-v1.0.0/
//   node pack.mjs --zip               # 再打一个 zip
//   node pack.mjs --out D:\share      # 指定输出目录
//
// ⚠️ 它只读源目录，不改源目录。跑完原 skill 一字不变。

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// ⚠️ pack.mjs 就放在 skill 根目录里，所以 SRC = HERE 本身，不是 '..'。
//    （第一版写成 '..' 直接把整个 skills 目录当源，打出来的包没有 scripts/。）
const SRC = HERE;
// 但 dist/ 要放到 skill 外面，否则第二次跑会把自己的产物打进去
const PARENT = path.resolve(HERE, '..');
const VERSION = '1.0.0';
const NAME = 'ink-horizon';

// ── 参数 ─────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const wantZip = argv.includes('--zip');
const outIdx = argv.indexOf('--out');
const outRoot = outIdx >= 0 ? path.resolve(argv[outIdx + 1]) : path.join(PARENT, 'ink-horizon-dist');
const DEST = path.join(outRoot, `${NAME}-v${VERSION}`);

// ── 不能进包的东西 ───────────────────────────────────────────
// 路径用正斜杠匹配，跨平台一致
const EXCLUDE_DIRS = new Set([
  'node_modules', 'dist', '.git', '__pycache__', '.venv', 'qa',
]);
const EXCLUDE_DIR_PREFIX = [
  'assets/starter/ref/voice',    // 别人的原声
  'assets/starter/ref/covers',   // 别人的封面
  'assets/starter/ref/bgm',      // 别人的 BGM
  'assets/starter/out',
  'assets/starter/audio',
];
const EXCLUDE_FILES = new Set([
  'assets/starter/ref/bgm.m4a',
]);
const EXCLUDE_EXT = new Set(['.pyc', '.DS_Store']);

// ── 工具 ─────────────────────────────────────────────────────
function shouldSkip(rel, isDir) {
  const base = rel.split('/').pop();
  if (EXCLUDE_DIRS.has(base)) return true;
  if (EXCLUDE_FILES.has(rel)) return true;
  if (!isDir && EXCLUDE_EXT.has(path.extname(rel))) return true;
  for (const p of EXCLUDE_DIR_PREFIX) {
    if (rel === p || rel.startsWith(p + '/')) return true;
  }
  return false;
}

function copyTree(from, to, relPrefix = '', stats = { files: 0, bytes: 0, skipped: [] }) {
  for (const ent of fs.readdirSync(from, { withFileTypes: true })) {
    const rel = relPrefix ? `${relPrefix}/${ent.name}` : ent.name;
    if (shouldSkip(rel, ent.isDirectory())) {
      stats.skipped.push(rel);
      continue;
    }
    const s = path.join(from, ent.name);
    const d = path.join(to, ent.name);
    if (ent.isDirectory()) {
      fs.mkdirSync(d, { recursive: true });
      copyTree(s, d, rel, stats);
    } else {
      fs.mkdirSync(path.dirname(d), { recursive: true });
      fs.copyFileSync(s, d);
      stats.files += 1;
      stats.bytes += fs.statSync(d).size;
    }
  }
  return stats;
}

const fmt = b => b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB`
  : b >= 1024 ? `${(b / 1024).toFixed(0)} KB` : `${b} B`;

// ── 开跑 ─────────────────────────────────────────────────────
console.log(`打包 ${NAME} v${VERSION}`);
console.log(`  源: ${SRC}`);
console.log(`  到: ${DEST}\n`);

if (fs.existsSync(DEST)) fs.rmSync(DEST, { recursive: true, force: true });
fs.mkdirSync(DEST, { recursive: true });

const stats = copyTree(SRC, DEST);

// ── 补三份必须有的文件 ───────────────────────────────────────
const CREDITS = `# 来源与许可（CREDITS）

这个 skill 由纸墨（墨点视界 / INK HORIZON）与我共同打磨，
© 2026 纸墨。以 MIT 许可发布。

## 代码出处

工程内核不是从零写的，它站在这些人的肩膀上：

| 项目 | 作者 | 许可 | 用了什么 |
|---|---|---|---|
| [garden-skills · motion-showreel](https://github.com/ConardLi/garden-skills) | ConardLi | **MIT** | \`scripts/render.mjs\`、\`scripts/audio.mjs\`、\`scripts/inspect.mjs\`、\`scripts/lib/*\`、\`assets/starter/motion.js\` |
| [vibe-knowledge-film](https://github.com/HeyChengC/vibe-knowledge-film) | HeyChengC | MIT | 内容设计思路（找形象、分镜表、逐句演出来） |
| [vibe-knowledge-video-skill](https://github.com/LuZhong-Li/vibe-knowledge-video-skill) | LuZhong-Li | — | 体检脚本的思路（越界/碰撞/可读性） |
| [vibe-knowledge-video](https://github.com/xiazhuo123456789/vibe-knowledge-video) | xiazhuo | — | 节拍网格与质量门 |

\`scripts/lib/synth.mjs\`（配乐合成）与 \`scripts/lib/tone-render.mjs\` 来自 motion-showreel（MIT）。

**MIT 要求保留版权声明**：\`scripts/THIRD-PARTY-LICENSE.md\` 里有原始 LICENSE 全文。

## 字体

| 字体 | 许可 | 备注 |
|---|---|---|
| Noto Serif SC Variable | **SIL OFL 1.1** | \`assets/fonts/cjk/\`，101 个 unicode-range 分片，来自 \`@fontsource-variable/noto-serif-sc\` |
| Noto Sans SC Variable | **SIL OFL 1.1** | 同上 |
| Cormorant Garamond | SIL OFL 1.1 | \`assets/fonts/\` |
| Lora | SIL OFL 1.1 | \`assets/fonts/\` |
| JetBrains Mono | SIL OFL 1.1 | \`assets/fonts/\` |
| Courier Prime | SIL OFL 1.1 | \`assets/fonts/\` |

OFL 要求：可以自由使用与分发，**但不得单独售卖字体文件本身**，且保留原许可声明。

## npm 依赖

\`playwright\`（Apache-2.0）、\`tone\`（MIT）。都不进包，\`npm install\` 装回。

## 这个包里没有的东西

**样例 BGM、封面缩略图、引用原声都被移除了** —— 它们是第三方版权内容，
只用于本地演示，不能随 skill 分发。\`assets/starter/ref/\` 里有 \`README.md\` 说明怎么放自己的。

---

**分发时唯一必须做的事：保留本文件。** 别的都可以改。
`;

const REF_README = `# ref/ —— 引用素材放这里

这个目录在原工程里是**这三类文件**，本发行包已移除（第三方版权）：

\`\`\`
ref/
  bgm.m4a                    ← 配乐。必须自己找一首，实测 BPM 写进 timeline.js
  voice/quote_main.wav       ← 引用原声（如果你片子里要放别人的原话）
  voice/quote_formula.wav
  covers/BVxxxxxxxxx.jpg     ← 引用来源的封面缩略图（画在"收据卡"上）
\`\`\`

## 怎么补

1. **BGM**：找一首 100–125 BPM 的器乐曲，测出真实 BPM：
   \`\`\`bash
   node <skill>/scripts/audio.mjs beats ref/bgm.m4a
   \`\`\`
   把测出来的 BPM 填进 \`timeline.js\` 的 \`BPM\`，**然后所有拍点自动对上**。

2. **原声**（可选）：如果你片子里引用了别人的话，把那段剪出来（2–4 秒），
   放进 \`voice/\`，在 \`timeline.js\` 的 \`VOICE\` 里登记。**注意版权：引用可，分发不可。**

3. **封面**（可选）：\`covers/<BV号>.jpg\`，B 站封面的下载法：
   \`\`\`
   api.bilibili.com/x/web-interface/view?bvid=<BV号>  →  data.pic
   \`\`\`
   把 \`http\` 改 \`https\`、去掉 \`@\` 后面的参数，带 \`Referer: https://www.bilibili.com\` 下载。

## 没有这些会怎样

- 没有 BGM → \`audio.mjs build\` 报错。可以先用 \`score.mjs\` 里的合成器造一段（看 \`scripts/lib/synth.mjs\`）
- 没有 voice → 删掉 \`timeline.js\` 里的 \`VOICE\` 数组即可
- 没有 covers → 删掉 \`timeline.js\` 里的 \`SOURCES\`，并把 \`scene.admit\` 的图片分支跳过
`;

const INSTALL = `# 安装（60 秒）

## 1. 放进去

\`\`\`bash
# macOS / Linux
cp -r ink-horizon ~/.dsh/skills/

# Windows (PowerShell)
Copy-Item -Recurse ink-horizon "$env:USERPROFILE\\.dsh\\skills\\"
\`\`\`

（如果你用的不是 DSH，把 \`~/.dsh/skills\` 换成你的 agent 的 skills 目录即可。）

## 2. 装依赖（必须，26 MB）

\`\`\`bash
cd <skill>/scripts
npm install --no-audit --no-fund
\`\`\`

> 用**官方源**，别改镜像。实测 \`registry.npmjs.org\` 205 秒能装完，
> 而某些镜像装到一半会去拉 \`bnpm.byted.org\` 然后失败。

## 3. 检查环境

\`\`\`bash
node <skill>/scripts/check-env.mjs
\`\`\`

应该看到六行 \`[ok]\`，最后一行是 \`ready\`。

**如果没有 headless browser**：本 skill 用 Playwright 逐帧截图。
Windows 上它会自动找 Edge（不需要装 Chrome）；其他平台跑
\`npx playwright install chromium\`。

## 4. 补素材

看 \`assets/starter/ref/README.md\`。最少只需要一首 BGM。

## 5. 建一个工程

**不要手动 cp \`assets/starter\`** —— 它不自包含，还得带上 \`fonts/\`（12.7MB）。
漏了字体，页面会静默 404，然后 \`render(t)\` 抛 \`A network error occurred\`，
看起来像引擎坏了，其实是少了两百个字体分片。

用脚手架：

\`\`\`bash
node <skill>/scripts/new-film.mjs ~/my-film
\`\`\`

它会复制模板 + 字体 + 建好空目录，并把你缺的素材列出来。

## 6. 试跑

\`\`\`bash
cd ~/my-film
npm install --no-audit --no-fund        # 约 6 分钟，只装一次
node <skill>/scripts/render.mjs ~/my-film --still 5,30,90 --sheet
\`\`\`

出 \`qa/stills/sheet.png\` 就说明通了。

> **两个 node_modules**：\`render.mjs\` 用的是**它自己所在目录**的 node_modules
> （即 \`<skill>/scripts/node_modules\`），工程里那份是给 \`score.mjs\`/\`audio.mjs\` 用的。
> 嫌麻烦就只装 skill 那份，然后工程里也做个软链或者直接拷过去。

## 7. 如果你要改 SKILL.md

SKILL.md 里第 0 节「环境自检」写了一个绝对路径（\`C:\\Users\\...\\python.exe\`），
那是原作者的机器。**换成你自己的 python 路径**，或者直接用 \`python3\`/\`python\`。
`;

const README = `# ink-horizon

**用未曾见过的画面，讲未曾想清楚的问题。**

一条从「一个值得拆的梗或现象」到「一条 2–3 分钟、无旁白、代码逐帧直出、每个数字都有出处」的知识短片的生产线。
顺带产出封面、B站章节、四平台发布文案。

---

## 这是什么 / 不是什么

**是**：一套把「说清楚」变成「画出来」的完整流程——选题判据、六段骨架、找形象的硬门槛、
可直接跑的工程模板、可量化的自评工具、以及 25 条用真金白银试出来的坑。

**不是**：不是「让 AI 生成个视频」。这条线里**一个字都不是 AI 画的**——
画面是 JavaScript 逐帧画出来的（Canvas 2D），所以每一帧你都能改到像素级。

---

## 三条反直觉的规矩（如果你只读一段，读这段）

### 1. 「画面在动」≠「内容在动」
判据是**最静 1 秒**。好的片子能**完全静止**（实测 0.0000–0.0013），
同时动起来很猛（中位 0.39–1.77）。两者**必须同时成立**。

反过来：加全屏漂浮光点、横扫光带、颗粒噪点——这些会让「运动量」数字变好看，
但整幅画面一直在变，观众的感觉是「这个视频一直在跳」。

**任何让整幅画面持续变化的层都是噪声，不是运动。运动只能来自画面里的内容。**

### 2. 「指标好看」≠「画面好看」
为了「空间利用率」加了一整套假 HUD（四角取景器、竖排英文、数据列、进度条）→ 被否。
为了「着墨覆盖率」把标题放大到占半屏 → 被否。

**指标能告诉你「变没变」，不能告诉你「好不好」。**

### 3. 调参解决不了「相机在动」
画面一直抖，我以为是幅度太大，把缩放从 ±22% 压到 ±4.8%，四轮调参——
抖动只降了 37%。真因是**叠了三层相机运动**。归零后抖动直接归 0。

**相机在动本身就是问题，唯一解是归零，不是调小。**

---

## 快速开始

见 \`INSTALL.md\`（60 秒）。

## 它怎么工作

\`\`\`
选题判据 → 六段骨架 → 找形象（硬门槛）→ 分镜表 → 建工程 → 风格帧 → 制作 → 声音 → 验收
                                                                              ↑
                                                            三道防线，缺一道不算通过
\`\`\`

**所有时间点都在拍上。** \`timeline.js\` 是全片唯一时钟，画面和配乐都从它读——
所以改一个拍点，画面和声音一起动。

## 目录

\`\`\`
SKILL.md                        ← 主文件，先读这个
INSTALL.md                      ← 装法
CREDITS.md                      ← 来源与许可（分发时必须保留）
references/
  怎么写一条skill.md            ← 方法论：五句公式 + 迭代闭环
  参考片拆解.md                 ← 10 条同赛道片子的逐帧拆解与量化对照
  迭代日志-实测数据.md           ← 24 个版本、每版改了什么、分数怎么动
  发布指南.md                   ← 四平台投稿/章节/标题/发布时间
  账号简介.md                   ← 六版简介与写作硬规矩
assets/
  starter/                      ← 可以 cp 出去直接用的工程模板
  fonts/                        ← 自托管字体（OFL）
scripts/
  render.mjs                    ← 逐帧渲染（Playwright + ffmpeg）
  audio.mjs                     ← 配乐构建/检查/合并
  inspect.mjs                   ← 技术验收（九项）
  check-env.mjs                 ← 环境自检
  score.py                      ← 六项 100 分制自评
  perseg_density.py             ← 逐段空间密度
  dead.py                       ← 静止段扫描
  pick.py                       ← 素材挑选打分
\`\`\`

## 已知限制

- **只做 16:9**。竖屏是另一套东西。
- **只能无人声**。这条线的形式就建立在「观众读字幕、看画面演」上。
- **必须有 BGM**，而且要测出真实 BPM。
- **本机（Windows + Edge）实测通过**。macOS/Linux 没测过——理论上只要 Playwright 能跑就行。
- 单条片子 2–4 小时（含迭代）。渲染约 100 秒 / 4000 帧 / RTX 5070。

## License

代码 MIT（见 CREDITS.md 里的第三方声明）。
文档 CC BY 4.0 —— 拿去改、拿去教、拿去卖课都行，署名就行。
**唯一要求：保留 \`CREDITS.md\`。**

---

*这个 skill 里每一条规矩背后都是一次被否、一次白改，或者一次删了找不回来的东西。*
*照着做能省掉那些轮次；不照着做，会重新走一遍。*
`;

const LICENSE = `MIT License

Copyright (c) 2026 纸墨 / 墨点视界 (INK HORIZON)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;

const files = {
  'CREDITS.md': CREDITS,
  'INSTALL.md': INSTALL,
  'README.md': README,
  'LICENSE': LICENSE,
  'assets/starter/ref/README.md': REF_README,
};
for (const [rel, content] of Object.entries(files)) {
  const p = path.join(DEST, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, 'utf8');
  stats.files += 1;
  stats.bytes += Buffer.byteLength(content);
}

// ── 把 ConardLi 的 MIT LICENSE 原文带进来 ────────────────────
const upstreamLicense = 'C:/Users/ZhiMo/Documents/deepseek-harness/创作工作区/vibe-skill/06-ConardLi-garden/LICENSE';
let thirdParty = '# 第三方许可原文\n\n## garden-skills / motion-showreel（ConardLi）\n\n本 skill 的 `scripts/render.mjs`、`scripts/audio.mjs`、`scripts/inspect.mjs`、`scripts/lib/*`、`assets/starter/motion.js` 派生自此项目。\n\n```\n';
thirdParty += fs.existsSync(upstreamLicense)
  ? fs.readFileSync(upstreamLicense, 'utf8')
  : '（原文未找到，请从 https://github.com/ConardLi/garden-skills 获取 LICENSE）';
thirdParty += '\n```\n';
fs.writeFileSync(path.join(DEST, 'scripts', 'THIRD-PARTY-LICENSE.md'), thirdParty, 'utf8');

// ── 生成 .gitignore（给别人用）────────────────────────────────
fs.writeFileSync(path.join(DEST, '.gitignore'),
  ['node_modules/', 'dist/', 'qa/', '*.log', '.DS_Store'].join('\n') + '\n', 'utf8');

// ── 打印结果 ─────────────────────────────────────────────────
console.log('排除的目录/文件：');
for (const s of stats.skipped) console.log(`  - ${s}`);

console.log(`\n完成：${stats.files} 文件，${fmt(stats.bytes)}`);
console.log(`路径：${DEST}`);

// ── 自检：确认包真的能跑（语法层面）──────────────────────────
console.log('\n自检：');
let ok = true;
for (const rel of ['SKILL.md', 'README.md', 'CREDITS.md', 'LICENSE', 'INSTALL.md']) {
  const has = fs.existsSync(path.join(DEST, rel));
  console.log(`  ${has ? '✓' : '✗'} ${rel}`);
  if (!has) ok = false;
}
const starterFiles = fs.readdirSync(path.join(DEST, 'assets/starter')).filter(f => f.endsWith('.js') || f.endsWith('.mjs') || f.endsWith('.html'));
console.log(`  ✓ assets/starter（${starterFiles.length} 个可执行文件）`);
for (const f of starterFiles.filter(f => f.endsWith('.js'))) {
  try {
    execFileSync('node', ['--check', path.join(DEST, 'assets/starter', f)], { stdio: 'pipe' });
  } catch (e) {
    console.log(`  ✗ ${f} 语法错误`);
    ok = false;
  }
}
const nm = fs.existsSync(path.join(DEST, 'scripts/node_modules'));
console.log(`  ${nm ? '✗' : '✓'} node_modules 已排除（别人需 npm install）`);
if (nm) ok = false;

const leaks = [];
for (const rel of ['assets/starter/ref/bgm.m4a', 'assets/starter/ref/voice', 'assets/starter/ref/covers']) {
  if (fs.existsSync(path.join(DEST, rel))) leaks.push(rel);
}
console.log(`  ${leaks.length ? '✗ 版权素材残留: ' + leaks.join(', ') : '✓ 版权素材已全部移除'}`);
if (leaks.length) ok = false;

console.log(ok ? '\n可以分发。' : '\n⚠️ 有检查未通过，先修再发。');

// ── 可选：打包成 zip ────────────────────────────────────────
if (wantZip && ok) {
  const zip = path.join(outRoot, `${NAME}-v${VERSION}.zip`);
  if (fs.existsSync(zip)) fs.unlinkSync(zip);
  try {
    if (process.platform === 'win32') {
      execFileSync('powershell.exe', ['-NoProfile', '-Command',
        `Compress-Archive -Path '${DEST}' -DestinationPath '${zip}' -Force`], { stdio: 'inherit' });
    } else {
      execFileSync('zip', ['-qr', zip, path.basename(DEST)], { cwd: outRoot, stdio: 'inherit' });
    }
    console.log(`zip：${zip}  (${fmt(fs.statSync(zip).size)})`);
  } catch (e) {
    console.log(`zip 失败（不影响目录版）：${e.message}`);
  }
}
