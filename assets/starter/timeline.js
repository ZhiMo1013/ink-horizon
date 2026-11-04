// timeline.js — 全片唯一的时钟。画面（index.html）与配乐（score.mjs）都从这里读。
// BGM 实测 112.35 BPM（拍 0.534083s，小节 2.13633s），所以每个切点都落在拍上。
// 片长 b(252) = 134.59s，与用户给的 BGM（134.29s）几乎等长。

export const BPM = 112.35;
export const BEAT = 60 / BPM;      // 0.534083 s
export const BAR = BEAT * 4;       // 2.13633 s
export const b = n => n * BEAT;
export const bar = n => n * BAR;
export const revealOn = (hit, dur, reveal = 0) => hit - reveal * dur;

export const DUR = b(252);         // 134.59 s ≈ 2:15

// 六个叙事段落，每段之间留一个真换气口（BGM 被真的切断，见 score.mjs）
export const SHOTS = [
  { id: 'quote',   t0: b(0),   t1: b(26),  sec: '00 · 原 话'      },  // 0.00   – 13.89
  { id: 'proof',   t0: b(26),  t1: b(62),  sec: '01 · 他的论证'   },  // 13.89  – 33.11
  { id: 'compare', t0: b(62),  t1: b(140), sec: '02 · 两种东西'   },  // 33.11  – 74.77
  { id: 'admit',   t0: b(140), t1: b(176), sec: '03 · 他知道'     },  // 74.77  – 94.00
  { id: 'prod',    t0: b(176), t1: b(202), sec: '04 · 产 线'      },  // 94.00  – 107.87
  { id: 'ruler',   t0: b(202), t1: b(228), sec: '05 · 同一把尺子' },  // 107.87 – 121.78
  { id: 'end',     t0: b(228), t1: b(252), sec: '06 · 说 破'      },  // 121.78 – 134.59
];

// 大重击（每个段落进场的那个点）。score.mjs 会在每个前面切断 BGM，留出真空。
export const DROPS = [b(26), b(62), b(140), b(176), b(202), b(228)];
// 换气口长度（秒）：BGM 在 hit 前这么多秒被完全切断
export const GAP = b(0.62);        // ≈ 0.33 s

// 画面要响声的地方。页面读它做闪/踢，配乐读它出音效。
export const CUES = [
  { t: b(2),   sfx: 'bloom'   },  // 引号落下
  { t: b(16),  sfx: 'tick'    },  // 310 万数字滚定
  { t: b(26),  sfx: 'impact'  },  // 01 进
  { t: b(28),  sfx: 'tick'    },
  { t: b(34),  sfx: 'tick'    },
  { t: b(40),  sfx: 'tick'    },
  { t: b(46),  sfx: 'tick'    },
  { t: b(54),  sfx: 'tock'    },  // 「省掉了什么」
  { t: b(62),  sfx: 'impact'  },  // 02 进
  { t: b(74),  sfx: 'chord'   },  // 985 那一排
  { t: b(96),  sfx: 'tock'    },  // 下限线
  { t: b(110), sfx: 'chord'   },  // 10 万粉那一排
  { t: b(124), sfx: 'tock'    },  // 中位线
  { t: b(132), sfx: 'impact'  },  // 期望值 vs 下限（段内小重击）
  { t: b(140), sfx: 'impact'  },  // 03 进
  { t: b(144), sfx: 'tick'    },
  { t: b(149), sfx: 'tick'    },
  { t: b(154), sfx: 'tick'    },
  { t: b(168), sfx: 'tock'    },  // 一道划掉的线
  { t: b(176), sfx: 'impact'  },  // 04 进（产线启动）
  { t: b(184), sfx: 'tick'    },
  { t: b(190), sfx: 'tick'    },
  { t: b(202), sfx: 'impact'  },  // 05 进
  { t: b(212), sfx: 'shimmer' },  // 尺子转过来
  { t: b(220), sfx: 'tock'    },
  { t: b(226), sfx: 'hush', dur: 2.4 },  // 收气
  { t: b(228), sfx: 'impact'  },  // 06 进：说破
  { t: b(240), sfx: 'bloom'   },
  { t: b(246), sfx: 'shimmer' },
];

// 刻意停住的地方（验收时算 intended hold，不算空拍）
export const HOLDS = [[b(244), DUR]];

// ── 段内硬切点 ────────────────────────────────────────────────
// 量出来的问题：参考片 26–62 个切点（每 1.2–7.5 秒一次），
// 我们原来 7 段只有 5 个切点 —— 20 秒不换一次画面。
// 这里给每段排段内切点（相对本段起点、按拍算），渲染器在切点处换机位。
export const CUTS = {
  quote:   [b(9), b(16), b(21)],
  proof:   [b(5), b(10), b(15), b(22), b(28), b(33)],
  compare: [b(26), b(48), b(66)],          // A/B/C/D 四小节本身就是硬切
  admit:   [b(4), b(8), b(14), b(22), b(28)],
  prod:    [b(6), b(12), b(17), b(22)],
  ruler:   [b(6), b(12), b(17), b(22)],
  end:     [b(6), b(12), b(18), b(21)],
};

// 每个切点换一种取景。
// ⚠️ 第一版把 z 设成 1.14 / 0.93 / 1.22（±22% 瞬间缩放）—— 结果整幅画面连同
// 文字一起在切点上「啪」地跳一下，看起来不是切镜头，是画面在抽筋。
// 参考片的切是「换成另一张内容」，不是「把同一张推近」。
// 所以这里只做 ±4% 的轻微重取景，让切点有手感但不跳。
// 取景：每个切点换一个「机位」。
// ⚠️ 幅度是实测出来的，不是拍的 —— 这一栏试过两次错：
//   ① 太轻（z 1.035 / x 0.012）：等于没换机位，切镜时改动面积只有 14%，
//      而十条约参考片是 30–98%。
//   ② 太重（z 1.21 / x 0.048）：**把标题切出画面了**。抽帧检查
//      （`qa\framing-check.jpg`）第二帧只剩「万粉丝，暴打985211」，
//      左边那个「10」被推出了画面 —— 观众会以为画面坏了。
//   定档：最大 7% 缩放 + 2% 平移。这个幅度足够让整片区域重新对位，
//      又不会把贴着边缘的文字推出视野（本片文字最外到 W*0.045）。
//      还要更大就得先给每段算出「安全框」，那是另一件事。
export const FRAMING = [
  { z: 1.000, x:  0.000, y:  0.000 },
  { z: 1.070, x: -0.020, y: -0.014 },
  { z: 0.950, x:  0.016, y:  0.011 },
  { z: 1.045, x:  0.021, y:  0.016 },
  { z: 1.020, x: -0.018, y:  0.010 },
];

// ── 他的原声（引用，2–4 秒/段，来自 BV16SHe6pEDJ）──────────
// 片子里必须有「他自己说话」的声音，否则观众凭什么信这是原话。
// quote_formula 原来切到 16.40s —— 那句话在「产品」后面还有「还有流量，好吗？」，
// 用户听出来的「17s 话被截断」就是这里。已重切到 17.05s（落在「好吗」之后的自然停顿上），3.50s。
export const VOICE = [
  { t: 0.10,  src: 'ref/voice/quote_main.wav',    gain: 0.78, dur: 3.70, duck: 0.55 },
  { t: b(28), src: 'ref/voice/quote_formula.wav', gain: 0.68, dur: 3.50, duck: 0.45 },
];

// ── 引用卡片：封面 + BV 号 + UP 主 + 标题（不出现视频画面帧）──
export const SOURCES = {
  main:    { bv: 'BV16SHe6pEDJ', up: '邵艾伦Clips_薄肌版', date: '2026-10-03',
             title: '我再说一个暴论，自媒体以后一定暴打学历', cover: 'ref/covers/BV16SHe6pEDJ.jpg' },
  deny:    { bv: 'BV16LaV6HEJA', up: '邵艾伦Clips_薄肌版', date: '2026-09-28',
             title: '学历真的贬值了吗', cover: 'ref/covers/BV16LaV6HEJA.jpg' },
  exam:    { bv: 'BV1fnp269E5P', up: '邵艾伦Clips_版本答案', date: '2026-10-14',
             title: '听到「学历没那么重要」，就想放弃读大学？', cover: 'ref/covers/BV1fnp269E5P.jpg' },
  diploma: { bv: 'BV1v2Hx6pEeV', up: '邵艾伦Clips_薄肌版', date: '2026-10-05',
             title: '19 岁滑雪教练攒到 100 万，要不要去读个本科', cover: 'ref/covers/BV1v2Hx6pEeV.jpg' },
};
