# 来源与许可（CREDITS）

这个 skill 由纸墨（墨点视界 / INK HORIZON）与我共同打磨，
© 2026 纸墨。以 MIT 许可发布。

## 代码出处

工程内核不是从零写的，它站在这些人的肩膀上：

| 项目 | 作者 | 许可 | 用了什么 |
|---|---|---|---|
| [garden-skills · motion-showreel](https://github.com/ConardLi/garden-skills) | ConardLi | **MIT** | `scripts/render.mjs`、`scripts/audio.mjs`、`scripts/inspect.mjs`、`scripts/lib/*`、`assets/starter/motion.js` |
| [vibe-knowledge-film](https://github.com/HeyChengC/vibe-knowledge-film) | HeyChengC | MIT | 内容设计思路（找形象、分镜表、逐句演出来） |
| [vibe-knowledge-video-skill](https://github.com/LuZhong-Li/vibe-knowledge-video-skill) | LuZhong-Li | **MIT** | 体检脚本的思路（越界/碰撞/可读性） |
| [vibe-knowledge-video](https://github.com/xiazhuo123456789/vibe-knowledge-video) | xiazhuo | **MIT** | 节拍网格与质量门 |

`scripts/lib/synth.mjs`（配乐合成）与 `scripts/lib/tone-render.mjs` 来自 motion-showreel（MIT）。

**MIT 要求保留版权声明**：`scripts/THIRD-PARTY-LICENSE.md` 里有原始 LICENSE 全文。

## 字体

| 字体 | 许可 | 备注 |
|---|---|---|
| Noto Serif SC Variable | **SIL OFL 1.1** | `assets/fonts/cjk/`，101 个 unicode-range 分片，来自 `@fontsource-variable/noto-serif-sc` |
| Noto Sans SC Variable | **SIL OFL 1.1** | 同上 |
| Cormorant Garamond | SIL OFL 1.1 | `assets/fonts/` |
| Lora | SIL OFL 1.1 | `assets/fonts/` |
| JetBrains Mono | SIL OFL 1.1 | `assets/fonts/` |
| Courier Prime | SIL OFL 1.1 | `assets/fonts/` |

OFL 要求：可以自由使用与分发，**但不得单独售卖字体文件本身**，且保留原许可声明。

## npm 依赖

`playwright`（Apache-2.0）、`tone`（MIT）。都不进包，`npm install` 装回。

## 这个包里没有的东西

**样例 BGM、封面缩略图、引用原声都被移除了** —— 它们是第三方版权内容，
只用于本地演示，不能随 skill 分发。`assets/starter/ref/` 里有 `README.md` 说明怎么放自己的。

---

**分发时唯一必须做的事：保留本文件。** 别的都可以改。
