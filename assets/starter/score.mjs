// score.mjs — 这支片子的声音。画面从 timeline.js 读同一组时刻，所以每个音都落在画面事件上。
// 构建：node <skill>/scripts/audio.mjs build score.mjs --out audio/music.wav
//
// 关键设计：BGM 是一条连续的曲子（用户给的《Claude Opus 5.5の小曲》112.35 BPM），
// 它自己不带「换气口」。所以这里对 BGM 的缓冲区直接做增益包络：
// 每个 DROPS 之前 GAP 秒内把 BGM 拉到 0，重击那一帧再放回来 —— 这样每个段落切换都掉进一个真空里。
import { fileURLToPath } from 'node:url';
import { DUR, BPM, CUES, SHOTS, DROPS, GAP, VOICE, b } from './timeline.js';
export { DUR };

const BGM = fileURLToPath(new URL('./ref/bgm.m4a', import.meta.url));
const VOICE_DIR = fileURLToPath(new URL('./ref/voice/', import.meta.url));

export default function score(S) {
  S.tempo(BPM);
  S.space({ room: 0.80, damp: 0.28, width: 1.0 });

  const bgm = S.bus('bgm', { gain: 0.60, duck: 0.5, duckRelease: 0.20, highpass: 42, lowpass: 15500, width: 0.94 });
  const sfx = S.bus('sfx', { gain: 0.78, reverb: 0.30 });
  const low = S.bus('low', { gain: 0.36, reverb: 0.14, lowpass: 220 });
  const vox = S.bus('vox', { gain: 1.0, highpass: 70, lowpass: 13000 });

  // ── BGM：整条铺上，再在换气口挖空 ────────────────────────
  const m = S.load(BGM);
  carveBreaths(m, S.SR);
  bgm.add(m, 0, { gain: 1 });

  /**
   * 在 DROPS 前 GAP 秒把 BGM 压下去，再缓回来。
   *
   * 用户连着三次说同一件事：「14s 32s 1分14s 1分33s 1分47s 2分0s 这几处有一个断崖」
   * 「炸开的声音 可能就是因为断崖之后声音突然变大」。
   *
   * 他是对的，而且量得出来：原来这段代码把 BGM 挖成**绝对的 0**（数字静音 −160 dB），
   * 再在 180ms 里弹回满增益 —— 相邻两个 10ms 窗相差 138 dB。
   * 那不是「换气」，那是一刀把音轨切成两段再接上。耳朵听到的就是断崖。
   *
   * 改法：不再挖到静音，改成压到 FLOOR（−20 dB）。
   * 听感上仍然是「让开一下、重音进来」，但波形是连续的，没有数据断层。
   */
  function carveBreaths(buf, sr) {
    const ramp = Math.round(0.055 * sr), gap = Math.round(GAP * sr);
    const RET = Math.round(0.42 * sr);
    const FLOOR = 0.22;                       // −13 dB：留换气，但没有数据断层
    const DUCK = 1 - FLOOR;                   // 要掉多少
    for (const t of DROPS) {
      const hit = Math.round(t * sr);
      const cut = hit - gap;
      const from = cut - ramp;
      // ① 压下去：从 1 平滑降到 FLOOR（cos 曲线，两端都不硬）
      for (let i = Math.max(0, from); i < hit; i++) {
        let k;
        if (i < cut) {
          const x = (i - from) / ramp;
          k = 1 - DUCK * (0.5 - 0.5 * Math.cos(Math.PI * x));
        } else {
          k = FLOOR;
        }
        buf.L[i] *= k; buf.R[i] *= k;
      }
      // ② 缓回来：FLOOR → 1，cos 曲线，起点斜率为 0（不会「啪」一下）
      // 关键：landing 不靠 BGM 弹回，靠 low 总线的 sub 给重量 —— 所以回来要足够慢，
      // 让 40ms 窗口之间的能量差落在 6dB 以内（用户能听出的是 >12dB 的断崖）。
      for (let i = hit; i < Math.min(hit + RET, buf.L.length); i++) {
        const x = (i - hit) / RET;
        const k = FLOOR + DUCK * (0.5 - 0.5 * Math.cos(Math.PI * x));
        buf.L[i] *= k; buf.R[i] *= k;
      }
    }
  }

  // ── 他的原声：这是全片最有力的一击，必须真的响 ─────────
  // 用户批评「人物音频呢」——之前我把他的声音切出来只用来自查文案，没放进片子里。
  // 现在放进来了，并且 BGM 在这几段被压下去让路。
  for (const v of VOICE) {
    const buf = S.load(VOICE_DIR + v.src.split('/').pop());
    vox.add(buf, v.t, { gain: v.gain });
    S.duck(v.t, v.duck);        // 让 BGM 让路
  }

  // ── 每个段落的落点：给一个「重量」，但不要炸 ─────────────
  // check 说这几个 drop 落地没比前一小节响 —— 挖空太狠，落点反而「空」。
  // 补一层短的低频 sub（2.6 拍、快衰减）+ 很轻的钟：是「落地」，不是「炸开」。
  for (const [i, t] of DROPS.entries()) {
    const note = ['A2', 'F2', 'C3', 'A2', 'E2', 'C3'][i] || 'A2';
    low.add(S.sub(note, S.beat(2.6), { harm: 0.20 }), t, { gain: 0.62 });
    sfx.add(S.bell(S.midi(note.replace(/(\d)/, '4')), 2.2, { ratio: 1.6, index: 1.1 }), t, { gain: 0.17 });
  }

  // ── 段落切换的 whoosh：必须在切点前收干净，让切点落进真空 ──
  // 用户连着两次说「莫名其妙炸开来」「还是太吵」——根因是 whoosh 在每个段头都来一发，
  // 且 BGM 弹回太快。现在 whoosh 再降一半，并且只在三段真正的大转折上给。
  const WHOOSH_ON = new Set([b(62), b(176), b(228)]);
  for (const s of SHOTS) {
    if (s.t0 <= 0) continue;
    if (!WHOOSH_ON.has(s.t0)) continue;
    sfx.add(S.whoosh(0.40), s.t0 - 0.42, { gain: 0.09, pan: ((s.t0 * 10 | 0) % 2 ? 0.22 : -0.22) });
  }

  // ── CUES 逐条 ───────────────────────────────────────────
  for (const c of CUES) {
    switch (c.sfx) {
      case 'bloom':
        // 只留钟，去掉叠加的 shimmer（两样一起响会显得炸）
        sfx.add(S.bell(S.midi('A5'), 3.0, { ratio: 2.0, index: 1.6 }), c.t, { gain: 0.22 });
        break;
      case 'impact':
        // 用户两次点名「1分14s 1分48s这种 炸开的音效 还是太吵」——那两处正是段落起点的 impact。
        // 而且 DROPS 循环里已经在这个时刻补过一层 sub + bell（「沉下去」的重量），
        // 两个一起响就是「轰」。所以这里只剩一层很薄的木质敲击，改用 mallet 而不是 impact。
        sfx.add(S.mallet(S.midi('A3'), 0.5, { material: 'wood', decay: 0.5, bright: 0.30 }), c.t, { gain: 0.16 });
        break;
      case 'tick':
        sfx.add(S.tick({ tone: 1680 }), c.t, { gain: 0.10, pan: ((c.t * 7) % 1.4) - 0.7 });
        break;
      case 'tock':
        sfx.add(S.mallet(S.scale('A3', 'minpenta')((c.t * 3 | 0) % 5), S.beat(1.4),
                { material: 'wood', decay: 0.34, bright: 0.45 }), c.t, { gain: 0.20 });
        break;
      case 'chord':
        sfx.add(S.pad(S.chord('A3', 'sus2'), S.beat(5), { voices: 4, cents: 10, cutoff: 1300, attack: 0.22, release: 1.7 }), c.t, { gain: 0.10 });
        break;
      case 'rise':
        sfx.add(S.riser(c.dur || 1.4, { from: 220, to: 3200 }), c.t, { gain: 0.10 });
        break;
      case 'shimmer':
        sfx.add(S.shimmer(1.7), c.t, { gain: 0.09 });
        break;
      case 'hush':
        sfx.add(S.reverseCymbal(c.dur || 2.2), c.t, { gain: 0.12 });
        break;
      case 'whoosh':
        sfx.add(S.whoosh(0.5), c.t - 0.5 * 0.7, { gain: 0.09 });
        break;
    }
  }

  // ── 三个记忆点 ──────────────────────────────────────────
  // ① 310 万 滚动：越来越密的 tick，落定一击
  for (let i = 0; i < 14; i++) {
    const k = i / 13;
    const t = S.beat(16) + (1 - Math.pow(1 - k, 2.2)) * S.beat(7.4);
    sfx.add(S.tick({ tone: 2350 + k * 1500 }), t, { gain: 0.09 + 0.13 * k, pan: (i % 2 ? 0.34 : -0.34) });
  }
  // ② 05 段尺子转过来：真实的刮擦 + 金属余音
  sfx.add(S.swipe(0.9), S.beat(212), { gain: 0.24, pan: -0.42 });
  sfx.add(S.bell(S.midi('E6'), 2.6, { ratio: 4.1, index: 2.0 }), S.beat(212) + 0.06, { gain: 0.15 });
  // ③ 结尾说破：很轻的针落 + 长尾
  sfx.add(S.tick({ tone: 900 }), S.beat(240), { gain: 0.20 });
  sfx.add(S.pad(S.chord('A2', 'min7'), S.beat(9), { voices: 5, cutoff: 900, attack: 0.9, release: 2.5 }), S.beat(240), { gain: 0.19 });

  // ── 底噪：磁带感，很轻，让静音处不是数字静音（换气口也挖掉）──
  const amb = S.bus('amb', { gain: 0.05, highpass: 240 });
  const ambBuf = S.ambience(DUR, { kind: 'tape', amount: 0.35 });
  carveBreaths(ambBuf, S.SR);
  amb.add(ambBuf, 0);
}
