#!/usr/bin/env node
// new-film.mjs — 建一个新片子工程。别自己 cp starter，用这个。
//
// 为什么需要它：`assets/starter/` 不是自包含的——它要 `fonts/`（12.7MB，在 skill 里）
// 和 `node_modules/`（26MB，要 npm install）。手动 cp 会漏掉字体，
// 页面静默 404 然后 `render(t)` 抛 "A network error occurred"，
// 看起来像引擎坏了，其实是少了两百个字体分片。
//
// 用法：
//   node <skill>/scripts/new-film.mjs ~/my-film
//   node <skill>/scripts/new-film.mjs ~/my-film --with-node-modules
//   node <skill>/scripts/new-film.mjs ~/my-film --force

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL = path.resolve(HERE, '..');
const STARTER = path.join(SKILL, 'assets', 'starter');
const FONTS = path.join(SKILL, 'assets', 'fonts');
const SKILL_MODULES = path.join(SKILL, 'scripts', 'node_modules');

const argv = process.argv.slice(2);
const flags = new Set(argv.filter(a => a.startsWith('--')));
const dest = argv.find(a => !a.startsWith('--'));

if (!dest) {
  console.error('用法: node new-film.mjs <目标目录> [--with-node-modules] [--force]');
  process.exit(1);
}

const DEST = path.resolve(dest);
const force = flags.has('--force');
const linkModules = flags.has('--with-node-modules');

if (fs.existsSync(DEST) && fs.readdirSync(DEST).length && !force) {
  console.error(`目标已存在且非空: ${DEST}\n加 --force 覆盖，或换个目录。`);
  process.exit(1);
}
if (fs.existsSync(DEST) && force) fs.rmSync(DEST, { recursive: true, force: true });

function copyDir(from, to, stats = { files: 0, bytes: 0 }) {
  fs.mkdirSync(to, { recursive: true });
  for (const ent of fs.readdirSync(from, { withFileTypes: true })) {
    const s = path.join(from, ent.name);
    const d = path.join(to, ent.name);
    if (ent.isDirectory()) copyDir(s, d, stats);
    else { fs.copyFileSync(s, d); stats.files++; stats.bytes += fs.statSync(d).size; }
  }
  return stats;
}

const fmt = b => b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`;

console.log(`新建工程: ${DEST}\n`);

// ① 模板
const s1 = copyDir(STARTER, DEST);
console.log(`  ✓ 模板 ${s1.files} 文件 ${fmt(s1.bytes)}`);

// ② 字体（这一步漏了就会静默 404）
if (!fs.existsSync(FONTS)) {
  console.error(`  ✗ 找不到字体目录 ${FONTS}`);
  process.exit(1);
}
const s2 = copyDir(FONTS, path.join(DEST, 'fonts'));
console.log(`  ✓ 字体 ${s2.files} 文件 ${fmt(s2.bytes)}（含 CJK 101 个 unicode-range 分片）`);

// ③ 空目录（渲染和音频会往里写）
for (const d of ['out', 'audio', 'qa', 'ref/voice', 'ref/covers']) {
  fs.mkdirSync(path.join(DEST, d), { recursive: true });
}
console.log('  ✓ 空目录 out/ audio/ qa/ ref/voice/ ref/covers/');

// ④ node_modules：复制太慢（5273 文件），Windows 上软链要管理员权限，
//    所以默认什么都不做、让用户自己 npm install（INSTALL.md 写了 6 分钟）。
//    --with-node-modules 就直接拷一份，省事但占 26MB。
const nm = path.join(DEST, 'node_modules');
if (linkModules && fs.existsSync(SKILL_MODULES)) {
  copyDir(SKILL_MODULES, nm);
  console.log(`  ✓ node_modules 已复制 ${fmt(26 * 1048576)}`);
} else {
  console.log('  · node_modules 没装（在工程目录跑一次 npm install，或加 --with-node-modules）');
  // 工程里要有个 package.json 才能 npm install
  const pkg = path.join(DEST, 'package.json');
  if (!fs.existsSync(pkg)) {
    fs.writeFileSync(pkg, JSON.stringify({ name: path.basename(DEST), private: true, type: 'module' }, null, 2));
  }
}

// ⑤ 检查素材缺口，说清楚缺什么、怎么补
const missing = [];
if (!fs.existsSync(path.join(DEST, 'ref', 'bgm.m4a'))) missing.push('ref/bgm.m4a（配乐）');
const covers = path.join(DEST, 'ref', 'covers');
if (fs.existsSync(covers) && fs.readdirSync(covers).length === 0) missing.push('ref/covers/*.jpg（引用来源封面）');
const voice = path.join(DEST, 'ref', 'voice');
if (fs.existsSync(voice) && fs.readdirSync(voice).length === 0) missing.push('ref/voice/*.wav（引用原声）');

if (missing.length) {
  console.log('\n还缺这些（看 assets/starter/ref/README.md）:');
  for (const m of missing) console.log(`  · ${m}`);
  console.log('\n最少只需要一首 BGM。放了之后测 BPM 填进 timeline.js：');
  console.log(`  node ${path.join(HERE, 'audio.mjs')} beats ${path.join(DEST, 'ref', 'bgm.m4a')}`);
}

// ⑥ 自检
console.log('\n自检：');
try {
  execFileSync('node', ['--check', path.join(DEST, 'timeline.js')], { stdio: 'pipe' });
  console.log('  ✓ timeline.js 语法正常');
} catch {
  console.log('  ✗ timeline.js 语法错误');
}
const hasFont = fs.existsSync(path.join(DEST, 'fonts', 'cjk', 'noto-serif-sc.css'));
console.log(`  ${hasFont ? '✓' : '✗'} 字体已就位（这一步漏了页面会静默 404）`);

console.log(`\n下一步：`);
console.log(`  cd ${DEST}`);
if (!linkModules) console.log(`  npm install --no-audit --no-fund     # 约 6 分钟，只装一次`);
console.log(`  node ${path.join(HERE, 'render.mjs')} ${DEST} --still 5,30,90 --sheet`);
console.log(`\n出 qa/stills/sheet.png 就说明通了。`);
