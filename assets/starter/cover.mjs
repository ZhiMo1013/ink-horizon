import { chromium } from 'file:///C:/Users/ZhiMo/.dsh/skills/vibe-motion/scripts/node_modules/playwright/index.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'C:/Users/ZhiMo/Documents/deepseek-harness/创作工作区/vibe-10w/film';
const OUT  = path.join(ROOT, 'out');
const MIME = { '.html':'text/html', '.js':'text/javascript', '.jpg':'image/jpeg',
               '.png':'image/png', '.woff2':'font/woff2', '.css':'text/css', '.ttf':'font/ttf' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  const f = path.join(ROOT, p);
  if (!fs.existsSync(f)) { res.writeHead(404); res.end('404'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch({ channel: 'msedge' });

const targets = [
  { w: 1920, h: 1080, v: 'a', out: '封面-a-16x9.png' },
  { w: 1080, h: 1920, v: 'a', out: '封面-a-9x16.png' },
  { w: 1152, h: 864,  v: 'h', out: '空间图-小红书-1152x864.png' },
  { w: 1920, h: 880,  v: 'h', out: '空间图-抖音-1920x880.png' },
  { w: 1024, h: 1024, v: 'd', out: '头像-1024.png' },
  { w: 256,  h: 256,  v: 'd', out: '头像-256.png' },
];

for (const t of targets) {
  const page = await browser.newPage({ viewport: { width: t.w, height: t.h }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  page.on('console', m => { if (m.type() === 'error') console.log('[console]', m.text().slice(0, 200)); });
  await page.goto(`http://127.0.0.1:${port}/cover.html?w=${t.w}&h=${t.h}&v=${t.v}`);
  await page.waitForFunction(() => window.READY === true, { timeout: 30000 }).catch(() => {});
  await page.evaluate(async () => {
    await Promise.all([
      document.fonts.load('700 80px "Noto Serif SC Variable"'),
      document.fonts.load('400 40px "Noto Serif SC Variable"'),
      document.fonts.load('500 40px "Noto Sans SC Variable"'),
      document.fonts.load('400 30px "Mono"'),
    ]);
    await document.fonts.ready;
  });
  await page.waitForTimeout(500);
  const dst = path.join(OUT, t.out);
  await page.screenshot({ path: dst, clip: { x: 0, y: 0, width: t.w, height: t.h } });
  console.log(`OK ${t.out}  ${t.w}x${t.h}  ${(fs.statSync(dst).size / 1024).toFixed(0)} KB`);
  await page.close();
}

await browser.close();
server.close();
