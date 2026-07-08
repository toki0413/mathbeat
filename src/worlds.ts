export interface World {
  id: number;
  name: string;
  sub: string;
  emoji: string;
  iconPath: string;
  bgPath: string;
  grad: string;
  unlockLabel: string;
}

export interface Level {
  id: string;
  name: string;
  desc: string;
  a?: number;
  b?: number;
  boss?: boolean;
  motif?: number[];
  ops?: string[];
}

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  icon: string;
  cat: string;
  hidden?: boolean;
}

export interface CurriculumItem {
  grade: string;
  standard: string;
  objective: string;
}

export interface WorldIntro {
  title: string;
  concept: string;
  visual: string;
  text: string;
}

export interface MathConcept {
  title: string;
  text: string;
  practice: string;
}

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const NOTE_FREQS = [261.63, 277.18, 293.66, 311.13, 329.63, 349.23, 369.99, 392.0, 415.3, 440.0, 466.16, 493.88];

export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  pentatonic: [0, 2, 4, 7, 9],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  wholetone: [0, 2, 4, 6, 8, 10],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
} as const;

export const ROOT_SEMITONES = {
  C: 0,
  'C#': 1,
  D: 2,
  'D#': 3,
  E: 4,
  F: 5,
  'F#': 6,
  G: 7,
  'G#': 8,
  A: 9,
  'A#': 10,
  B: 11,
} as const;

export const WORLDS: World[] = [
  {
    id: 1,
    name: '节拍与分数',
    sub: 'LCM & GCD → 复节奏',
    emoji: '🥁',
    iconPath: 'assets/icons/w1.svg',
    bgPath: 'assets/bgs/w1.svg',
    grad: 'linear-gradient(135deg,#FF8C42,#FFB347)',
    unlockLabel: '鼓组+欧几里得节奏',
  },
  {
    id: 2,
    name: '音程与对称',
    sub: '对称群 → 和声',
    emoji: '🎵',
    iconPath: 'assets/icons/w2.svg',
    bgPath: 'assets/bgs/w2.svg',
    grad: 'linear-gradient(135deg,#E8587A,#FF9A9E)',
    unlockLabel: '旋律音色+模运算',
  },
  {
    id: 3,
    name: '频率与指数',
    sub: '频率比 → 音程',
    emoji: '🌊',
    iconPath: 'assets/icons/w3.svg',
    bgPath: 'assets/bgs/w3.svg',
    grad: 'linear-gradient(135deg,#7C6BFF,#A78BFA)',
    unlockLabel: '贝斯音色+质数',
  },
  {
    id: 4,
    name: '模运算与多节奏',
    sub: '中国剩余定理 → 对位',
    emoji: '🔄',
    iconPath: 'assets/icons/w4.svg',
    bgPath: 'assets/bgs/w4.svg',
    grad: 'linear-gradient(135deg,#4ECDC4,#88D8C0)',
    unlockLabel: '对称变换',
  },
  {
    id: 5,
    name: '排列与旋律',
    sub: '排列组合 → 旋律',
    emoji: '🎯',
    iconPath: 'assets/icons/w5.svg',
    bgPath: 'assets/bgs/w5.svg',
    grad: 'linear-gradient(135deg,#FFD166,#FFE5A0)',
    unlockLabel: '序列与动机',
  },
  {
    id: 6,
    name: '递归与分形',
    sub: '递归/自相似 → 作曲',
    emoji: '🔨',
    iconPath: 'assets/icons/w6.svg',
    bgPath: 'assets/bgs/w6.svg',
    grad: 'linear-gradient(135deg,#7BC67E,#A8D8A8)',
    unlockLabel: '斐波那契+递归+完整作曲',
  },
  {
    id: 7,
    name: '概率与随机',
    sub: '概率分布 → 不确定音乐',
    emoji: '🎲',
    iconPath: 'assets/icons/w7.svg',
    bgPath: 'assets/bgs/w7.svg',
    grad: 'linear-gradient(135deg,#9B5DE5,#C77DFF)',
    unlockLabel: '随机作曲',
  },
  {
    id: 8,
    name: '图论与和声',
    sub: '图与路径 → 和弦进行',
    emoji: '🕸️',
    iconPath: 'assets/icons/w8.svg',
    bgPath: 'assets/bgs/w8.svg',
    grad: 'linear-gradient(135deg,#4ECDC4,#88D8C0)',
    unlockLabel: '图论指挥',
  },
];

export const WORLD_INTROS: Record<number, WorldIntro> = {
  1: {
    title: '🥁 节拍与分数',
    concept: '最小公倍数 LCM',
    visual:
      '<svg width="360" height="120" viewBox="0 0 360 120"><circle cx="60" cy="60" r="45" fill="none" stroke="#FF8C42" stroke-width="3"/><circle cx="60" cy="60" r="3" fill="#FF8C42"/><circle cx="180" cy="60" r="45" fill="none" stroke="#FFB347" stroke-width="3"/><circle cx="180" cy="60" r="3" fill="#FFB347"/><text x="300" y="55" text-anchor="middle" font-size="16" fill="#333">2 拍 + 3 拍</text><text x="300" y="80" text-anchor="middle" font-size="14" fill="#666">LCM = 6</text></svg>',
    text: '在这个世界里，你会用两条不同周期的节奏轨道探索"最小公倍数"。当两条轨道在 LCM 步同时敲响时，就能感受到分数与周期的对位之美。',
  },
  2: {
    title: '🎵 音程与对称',
    concept: '对称群与旋转',
    visual:
      '<svg width="360" height="120" viewBox="0 0 360 120"><circle cx="80" cy="60" r="45" fill="none" stroke="#E8587A" stroke-width="3"/><circle cx="80" cy="15" r="5" fill="#E8587A"/><circle cx="125" cy="60" r="5" fill="#E8587A"/><circle cx="80" cy="105" r="5" fill="#E8587A"/><text x="240" y="55" text-anchor="middle" font-size="16" fill="#333">正十二边形</text><text x="240" y="80" text-anchor="middle" font-size="14" fill="#666">旋转 = 转位</text></svg>',
    text: '12 个半音排成一个圆环，构成一个对称群。旋转圆环相当于"转位"，翻转圆环相当于"倒影"，你会发现和声背后的群论结构。',
  },
  3: {
    title: '🌊 频率与指数',
    concept: '频率比与音程',
    visual:
      '<svg width="360" height="120" viewBox="0 0 360 120"><rect x="40" y="40" width="120" height="40" rx="8" fill="#7C6BFF"/><rect x="200" y="40" width="80" height="40" rx="8" fill="#A78BFA"/><text x="100" y="65" text-anchor="middle" font-size="14" fill="#fff">440 Hz</text><text x="240" y="65" text-anchor="middle" font-size="14" fill="#fff">660 Hz</text><text x="280" y="100" text-anchor="middle" font-size="14" fill="#666">3:2 纯五度</text></svg>',
    text: '音程的本质是频率比。3:2 是纯五度，4:3 是纯四度。拖动滑块调音，体会整数比如何塑造协和与不协和。',
  },
  4: {
    title: '🔄 模运算与多节奏',
    concept: '中国剩余定理 CRT',
    visual:
      '<svg width="360" height="120" viewBox="0 0 360 120"><circle cx="70" cy="60" r="45" fill="none" stroke="#4ECDC4" stroke-width="3"/><circle cx="170" cy="60" r="45" fill="none" stroke="#88D8C0" stroke-width="3"/><text x="280" y="55" text-anchor="middle" font-size="16" fill="#333">双环对齐</text><text x="280" y="80" text-anchor="middle" font-size="14" fill="#666">GCD=1 时唯一解</text></svg>',
    text: '两个互质的周期轨道何时相遇？这就是中国剩余定理。通过双环动画，你可以直观理解模运算与对齐。',
  },
  5: {
    title: '🎯 排列与旋律',
    concept: '排列、逆行、倒影',
    visual:
      '<svg width="360" height="120" viewBox="0 0 360 120"><rect x="40" y="45" width="40" height="30" rx="6" fill="#FFD166"/><rect x="90" y="45" width="40" height="30" rx="6" fill="#FFD166"/><rect x="140" y="45" width="40" height="30" rx="6" fill="#FFD166"/><rect x="190" y="45" width="40" height="30" rx="6" fill="#FFD166"/><text x="290" y="60" text-anchor="middle" font-size="14" fill="#666">同一组音符，不同顺序</text></svg>',
    text: '一组音符经过重新排列、逆行或倒影，会变成全新的旋律。这里你会体验排列组合如何驱动音乐创作。',
  },
  6: {
    title: '🔨 递归与分形',
    concept: '欧几里得 / 斐波那契',
    visual:
      '<svg width="360" height="120" viewBox="0 0 360 120"><rect x="40" y="50" width="30" height="30" fill="#7BC67E"/><rect x="75" y="50" width="30" height="30" fill="none" stroke="#7BC67E" stroke-width="3"/><rect x="110" y="50" width="30" height="30" fill="#7BC67E"/><rect x="145" y="50" width="30" height="30" fill="none" stroke="#7BC67E" stroke-width="3"/><text x="260" y="60" text-anchor="middle" font-size="14" fill="#666">E(2,5) 自相似节奏</text></svg>',
    text: '欧几里得算法和斐波那契数列都藏着递归之美。把它们变成节奏与旋律，你能听见分形结构的回声。',
  },
  7: {
    title: '🎲 概率与随机',
    concept: '伯努利 / 马尔可夫',
    visual:
      '<svg width="360" height="120" viewBox="0 0 360 120"><circle cx="70" cy="60" r="25" fill="none" stroke="#9B5DE5" stroke-width="3"/><text x="70" y="66" text-anchor="middle" font-size="14" fill="#9B5DE5">p</text><rect x="120" y="45" width="80" height="30" rx="6" fill="#C77DFF"/><text x="160" y="65" text-anchor="middle" font-size="14" fill="#fff">转移矩阵</text><text x="260" y="60" text-anchor="middle" font-size="14" fill="#666">随机中的秩序</text></svg>',
    text: '随机不等于混乱。通过概率和马尔可夫链，你可以控制音乐的密度、走向与惊喜感。',
  },
  8: {
    title: '🕸️ 图论与和声',
    concept: '图与最短路径',
    visual:
      '<svg width="360" height="120" viewBox="0 0 360 120"><circle cx="60" cy="40" r="12" fill="#4ECDC4"/><circle cx="140" cy="40" r="12" fill="#4ECDC4"/><circle cx="100" cy="90" r="12" fill="#4ECDC4"/><circle cx="180" cy="90" r="12" fill="#4ECDC4"/><line x1="60" y1="40" x2="140" y2="40" stroke="#4ECDC4" stroke-width="2"/><line x1="60" y1="40" x2="100" y2="90" stroke="#4ECDC4" stroke-width="2"/><line x1="140" y1="40" x2="180" y2="90" stroke="#4ECDC4" stroke-width="2"/><text x="270" y="60" text-anchor="middle" font-size="14" fill="#666">和弦节点 + 边 = 进行</text></svg>',
    text: '把和弦看作图的节点，把连接看作边。选择一条路径，就是创作一段和弦进行；最短路径算法还能帮你找到"最顺耳"的旋律。',
  },
};

export const LEVELS: Record<number, Level[]> = {
  1: [
    { id: '1-1', name: '2:3 对位', desc: '2拍和3拍的节奏交织', a: 2, b: 3 },
    { id: '1-2', name: '3:4 交错', desc: '3拍和4拍的复节奏', a: 3, b: 4 },
    { id: '1-3', name: '4:5 舞曲', desc: '4拍和5拍的复杂对位', a: 4, b: 5 },
    { id: '1-4', name: '5:7 交织', desc: '5拍和7拍的对位探索', a: 5, b: 7 },
    { id: '1-5', name: '6:8 舞曲', desc: '6拍和8拍的复合节奏', a: 6, b: 8 },
    { id: '1-B', name: 'Boss: LCM大师', desc: '综合挑战', a: 6, b: 8, boss: true },
  ],
  2: [
    { id: '2-1', name: '三音和弦', desc: '在圆环上选择3个音符' },
    { id: '2-2', name: '转位', desc: '旋转改变音高' },
    { id: '2-3', name: '倒影', desc: '翻转=反射对称' },
    { id: '2-4', name: '四音和弦', desc: '在圆环上选择4个音符' },
    { id: '2-5', name: '复合对称', desc: '组合旋转与倒影' },
    { id: '2-B', name: 'Boss: 对称大师', desc: '综合对称变换', boss: true },
  ],
  3: [
    { id: '3-1', name: '纯五度', desc: '3:2频率比' },
    { id: '3-2', name: '大三度', desc: '5:4频率比' },
    { id: '3-3', name: '小七度', desc: '7:4频率比' },
    { id: '3-4', name: '大二度', desc: '9:8频率比' },
    { id: '3-5', name: '纯四度', desc: '4:3频率比' },
    { id: '3-B', name: 'Boss: 调律师', desc: '综合频率挑战', boss: true },
  ],
  4: [
    { id: '4-1', name: '互质环', desc: 'GCD=1的双环', a: 3, b: 5 },
    { id: '4-2', name: '非互质', desc: 'GCD>1的情况', a: 4, b: 6 },
    { id: '4-3', name: '中国剩余', desc: 'CRT验证', a: 5, b: 7 },
    { id: '4-4', name: '5:8 对齐', desc: '互质双环的进阶', a: 5, b: 8 },
    { id: '4-5', name: '6:9 同步', desc: 'GCD=3的模运算', a: 6, b: 9 },
    { id: '4-B', name: 'Boss: 环论大师', desc: '综合模算术', a: 7, b: 9, boss: true },
  ],
  5: [
    { id: '5-1', name: '旋律排列', desc: '把动机音符重新排成旋律', motif: [0, 2, 4, 7], ops: [] },
    { id: '5-2', name: '倒影与逆行', desc: '给旋律加上对称变换', motif: [0, 2, 4, 7], ops: ['retro', 'invert'] },
    { id: '5-3', name: '循环移位', desc: '用旋转生成新乐句', motif: [0, 2, 4, 5, 7], ops: ['rotate'] },
    { id: '5-4', name: '逆行变奏', desc: '用逆行扩展动机', motif: [0, 2, 4, 5, 7], ops: ['retro'] },
    { id: '5-5', name: '倒影移位', desc: '倒影与循环移位组合', motif: [0, 2, 3, 5, 7, 9], ops: ['invert', 'rotate'] },
    {
      id: '5-B',
      name: 'Boss: 序列大师',
      desc: '综合运用排列变换',
      motif: [0, 2, 4, 5, 7, 9],
      ops: ['retro', 'invert', 'rotate'],
      boss: true,
    },
  ],
  6: [
    { id: '6-1', name: '欧几里得鼓', desc: 'E(3,8)节奏' },
    { id: '6-2', name: '欧几里得贝斯', desc: 'E(5,8)节奏' },
    { id: '6-3', name: '欧几里得旋律', desc: 'E(4,7)节奏' },
    { id: '6-4', name: 'E(4,9)', desc: '4个脉冲分布在9步' },
    { id: '6-5', name: 'E(3,10)', desc: '3个脉冲分布在10步' },
    { id: '6-B', name: 'Boss: 作曲家', desc: '综合数学作曲', boss: true },
  ],
  7: [
    { id: '7-1', name: '骰子节奏', desc: '按概率随机填充16步节奏' },
    { id: '7-2', name: '马尔可夫旋律', desc: '转移矩阵生成旋律' },
    { id: '7-3', name: '正态分布力度', desc: '钟形曲线控制音符力度' },
    { id: '7-4', name: '高概率填充', desc: '用80%概率生成节奏' },
    { id: '7-5', name: '再生成旋律', desc: '再次用马尔可夫链创作旋律' },
    { id: '7-B', name: 'Boss: 随机作曲家', desc: '随机算法作曲', boss: true },
  ],
  8: [
    { id: '8-1', name: '和弦图路径', desc: '在4节点和弦图上选路径' },
    { id: '8-2', name: '邻接矩阵', desc: '切换边并生成和弦进行' },
    { id: '8-3', name: '最短路径旋律', desc: 'Dijkstra生成旋律' },
    { id: '8-4', name: '和弦路径复习', desc: '在图上选择更长路径' },
    { id: '8-5', name: '邻接矩阵复习', desc: '用矩阵生成另一段进行' },
    { id: '8-B', name: 'Boss: 图论指挥', desc: '覆盖所有节点的进行', boss: true },
  ],
};

export const CURRICULUM: Record<string, CurriculumItem> = {
  '1-1': { grade: '小学五年级', standard: '数学-数与代数', objective: '公倍数概念' },
  '1-2': { grade: '小学六年级', standard: '数学-数与代数', objective: '最小公倍数' },
  '1-3': { grade: '初中一年级', standard: '数学-数与代数', objective: '复杂LCM' },
  '2-1': { grade: '初中二年级', standard: '数学-图形与几何', objective: '正多边形对称' },
  '2-2': { grade: '初中三年级', standard: '数学-图形与几何', objective: '旋转变换' },
  '3-1': { grade: '高中一年级', standard: '物理-机械运动', objective: '频率与周期' },
  '3-2': { grade: '高中二年级', standard: '物理-机械运动', objective: '波的叠加' },
  '4-1': { grade: '高中三年级', standard: '数学-数论', objective: '互质与GCD' },
  '5-1': { grade: '初中三年级', standard: '数学-数与代数', objective: '多变量LCM' },
  '6-1': { grade: '高中选修', standard: '数学-算法', objective: '欧几里得算法' },
  '7-1': { grade: '高中选修', standard: '数学-概率统计', objective: '伯努利试验与随机节奏' },
  '7-2': { grade: '高中选修', standard: '数学-概率统计', objective: '马尔可夫链' },
  '7-3': { grade: '高中选修', standard: '数学-概率统计', objective: '正态分布' },
  '8-1': { grade: '高中选修', standard: '数学-图论', objective: '图与路径' },
  '8-2': { grade: '高中选修', standard: '数学-图论', objective: '邻接矩阵' },
  '8-3': { grade: '高中选修', standard: '数学-图论', objective: 'Dijkstra最短路径' },
};

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_star', name: '初星', desc: '获得第一颗星', icon: '⭐', cat: 'progress' },
  { id: 'all_world1', name: '节奏达人', desc: '通关世界1', icon: '🥁', cat: 'progress' },
  { id: 'all_world2', name: '音程大师', desc: '通关世界2', icon: '🎵', cat: 'progress' },
  { id: 'all_world3', name: '波形探索者', desc: '通关世界3', icon: '🌊', cat: 'progress' },
  { id: 'all_world4', name: '环论新星', desc: '通关世界4', icon: '🔄', cat: 'progress' },
  { id: 'all_world5', name: '指挥天才', desc: '通关世界5', icon: '🎯', cat: 'progress' },
  { id: 'all_world6', name: '作曲家', desc: '通关世界6', icon: '🔨', cat: 'progress' },
  { id: 'all_world7', name: '随机大师', desc: '通关世界7', icon: '🎲', cat: 'progress' },
  { id: 'all_world8', name: '图论指挥', desc: '通关世界8', icon: '🕸️', cat: 'progress' },
  { id: 'combo_5', name: '五连击', desc: '连续答对5题', icon: '🔥', cat: 'skill' },
  { id: 'combo_10', name: '十连击', desc: '连续答对10题', icon: '💥', cat: 'skill' },
  { id: 'perfect_boss', name: '完美Boss', desc: 'Boss关三星', icon: '👑', cat: 'skill' },
  { id: 'speed_runner', name: '速通者', desc: '1分钟内通过一个Boss关', icon: '⏱️', cat: 'skill' },
  { id: 'no_hint_clear', name: '无提示通关', desc: '不使用提示通关任意世界', icon: '🧠', cat: 'skill' },
  { id: 'diary_5', name: '日记达人', desc: '写5篇数学日记', icon: '📝', cat: 'explore' },
  { id: 'science_first', name: '声化学者', desc: '在科学之声生成第一段旋律', icon: '🔬', cat: 'explore' },
  { id: 'science_all', name: '跨界学者', desc: '使用过4种以上科学类型', icon: '🧬', cat: 'explore' },
  { id: 'sample_all', name: '摇滚鉴赏家', desc: '播放过全部9首示例曲', icon: '🎸', cat: 'explore' },
  { id: 'daily_7', name: '七日打卡', desc: '连续7天完成每日挑战', icon: '📅', cat: 'explore' },
  { id: 'daily_all_types', name: '全能挑战者', desc: '完成过全部12种每日挑战类型', icon: '🌈', cat: 'explore' },
  { id: 'composer_export', name: 'MIDI达人', desc: '在完整作曲台导出过一次MIDI', icon: '🎼', cat: 'explore' },
  { id: 'math_rock_30s', name: '数学摇滚手', desc: '在完整作曲台创作超过30秒的音乐', icon: '🤘', cat: 'explore' },
  { id: 'hidden_lucky', name: '幸运儿', desc: '连续掷骰子3次都命中', icon: '🍀', cat: 'hidden', hidden: true },
  {
    id: 'hidden_perfect_pitch',
    name: '绝对音感',
    desc: '一次不调错通过世界3Boss',
    icon: '🎧',
    cat: 'hidden',
    hidden: true,
  },
  { id: 'mastery_world1', name: '世界1精通', desc: '世界1全部关卡三星', icon: '🥁', cat: 'progress' },
  { id: 'mastery_world2', name: '世界2精通', desc: '世界2全部关卡三星', icon: '🎵', cat: 'progress' },
  { id: 'mastery_world3', name: '世界3精通', desc: '世界3全部关卡三星', icon: '🌊', cat: 'progress' },
  { id: 'mastery_world4', name: '世界4精通', desc: '世界4全部关卡三星', icon: '🔄', cat: 'progress' },
  { id: 'mastery_world5', name: '世界5精通', desc: '世界5全部关卡三星', icon: '🎯', cat: 'progress' },
  { id: 'mastery_world6', name: '世界6精通', desc: '世界6全部关卡三星', icon: '🔨', cat: 'progress' },
  { id: 'mastery_world7', name: '世界7精通', desc: '世界7全部关卡三星', icon: '🎲', cat: 'progress' },
  { id: 'mastery_world8', name: '世界8精通', desc: '世界8全部关卡三星', icon: '🕸️', cat: 'progress' },
  { id: 'perfect_all_bosses', name: 'Boss全完美', desc: '全部Boss关三星', icon: '👑', cat: 'skill' },
  { id: 'endless_50', name: '无尽50分', desc: '无尽模式单局50分', icon: '🔥', cat: 'skill' },
  { id: 'endless_100', name: '无尽100分', desc: '无尽模式单局100分', icon: '💯', cat: 'skill' },
  { id: 'import_sample', name: '示例曲复用', desc: '从示例曲库导入到作曲台', icon: '🎸', cat: 'explore' },
  { id: 'share_composer', name: '分享作曲家', desc: '分享作曲台作品', icon: '📋', cat: 'explore' },
  { id: 'export_science', name: '科学之声导出', desc: '从科学之声导出到作曲台', icon: '🔬', cat: 'explore' },
  { id: 'create_custom_level', name: '关卡设计师', desc: '创建并保存自定义关卡', icon: '🛠️', cat: 'explore' },
  // phase-2 explore / skill achievements
  { id: 'tuning_explorer', name: '调音探险家', desc: '在世界3听过全部6种目标频率比', icon: '🎧', cat: 'explore' },
  { id: 'symmetry_axis', name: '轴心乐手', desc: '在世界2使用非默认倒影轴并通过关卡', icon: '🪞', cat: 'skill' },
  { id: 'original_reflection', name: '双面听众', desc: '在世界2同时播放原象与倒影和弦', icon: '🎭', cat: 'explore' },
  { id: 'recursive_layers', name: '分形编曲家', desc: '在世界6同时开启旋律、质数和弦与递归层', icon: '🌿', cat: 'skill' },
  { id: 'markov_editor', name: '概率作曲家', desc: '在世界7编辑马尔可夫矩阵并生成旋律', icon: '🎲', cat: 'explore' },
  { id: 'graph_hamilton', name: '哈密顿指挥', desc: '在世界8 Boss用最少步数覆盖所有节点', icon: '🕸️', cat: 'skill' },
];

export const MATH_CONCEPTS: Record<string, MathConcept> = {
  '1-1': {
    title: '最小公倍数(LCM)',
    text: '两个不同周期的节奏叠在一起，它们会在LCM步同时响一次，这就是复节奏。LCM越大，两条轨道"重逢"的周期就越长。',
    practice: '把A轨道放在2的倍数步，B轨道放在3的倍数步，它们会在第6步同时响：LCM(2,3)=6。',
  },
  '1-2': {
    title: '最小公倍数进阶',
    text: '3拍与4拍交织时，LCM(3,4)=12。更复杂的周期意味着更晚的"重逢"，也更考验对位感。',
    practice: '把A轨道放在3的倍数步，B轨道放在4的倍数步，它们会在第12步同时响。',
  },
  '1-3': {
    title: '复杂LCM',
    text: '4拍与5拍交织，LCM(4,5)=20。两个周期越接近，LCM越大，音乐的"呼吸"也越长。',
    practice: '把A轨道放在4的倍数步，B轨道放在5的倍数步，它们会在第20步同时响。',
  },
  '1-B': {
    title: 'Boss：LCM大师',
    text: 'Boss关综合多种周期关系，需要你主动设计鼓组与对位，使至少8个音符在LCM对齐处同时发声。',
    practice: '在作曲台里同时设计 kick 与 snare，让它们在LCM处汇合。',
  },
  '2-1': {
    title: '对称群',
    text: '12个半音排成圆环，形成正十二边形。选择音符相当于在群中选取元素，和弦的对称性由群论描述。',
    practice: 'C-E-G构成大三和弦，它们在圆环上等间距分布（每4个半音一个）。',
  },
  '2-2': {
    title: '旋转变换',
    text: '把和弦整体旋转半音数，相当于在对称群中进行平移。转位就是旋转的一种。',
    practice: '把C-E-G整体旋转4个半音，得到E-G-B，即第一转位。',
  },
  '2-3': {
    title: '倒影对称',
    text: '以某条轴为镜面，把每个音符映射到对称位置，称为倒影。倒影保持音程结构，是旋律变奏的重要手段。',
    practice: '以C为轴，C-E-G倒影后变为C-A♭-F，保持音程但方向相反。',
  },
  '2-B': {
    title: 'Boss：对称大师',
    text: 'Boss关要求你在旋律或和弦中展示对称性：palindrome、等距或镜像结构都能体现群论思想。',
    practice: '设计一段旋律，使其前半与后半互为逆行。',
  },
  '3-1': {
    title: '频率比与音程',
    text: '两个音的频率比决定了音程。3:2是纯五度，4:3是纯四度，5:4是大三度。这些简单整数比产生和谐的音程。',
    practice: 'A=440Hz，纯五度E=440×3/2=660Hz。弹一下听听！',
  },
  '3-2': {
    title: '拍频与律制',
    text: '当两个频率非常接近时，会产生"拍频"。纯律与平均律的差异正是拍频的来源。',
    practice: '把B调到441Hz，与440Hz的A一起播放，感受1Hz的拍频。',
  },
  '3-3': {
    title: '高次谐波比例',
    text: '7:4、11:8等更复杂的比例对应更"远"的音程，常用于现代音乐与微分音探索。',
    practice: '把B调到770Hz，与440Hz的A形成11:8的音程关系。',
  },
  '3-B': {
    title: 'Boss：调律师',
    text: 'Boss关要求你通过频率比调音，理解音程背后的整数关系。',
    practice: '在作曲台里让旋律或和弦音程出现3:2、4:3、5:4之一。',
  },
  '4-1': {
    title: '中国剩余定理',
    text: '如果两个数互质(GCD=1)，那么对于任意余数组合，都存在唯一解(模LCM)。双环对齐就是CRT的直观演示。',
    practice: '3步一圈和5步一圈，GCD(3,5)=1，它们在LCM(3,5)=15步时对齐。',
  },
  '4-2': {
    title: '非互质周期',
    text: '如果GCD>1，两个周期不会在所有位置相遇，只在GCD的倍数处对齐。',
    practice: '4步一圈和6步一圈，GCD=2，它们每隔LCM(4,6)=12步对齐。',
  },
  '4-3': {
    title: '中国剩余定理验证',
    text: '通过构造两个模数并寻找同时满足同余条件的解，可以验证CRT。',
    practice: '5步一圈和7步一圈，LCM(5,7)=35步对齐。',
  },
  '4-B': {
    title: 'Boss：环论大师',
    text: 'Boss关要求两条周期轨道在特定位置对齐，展示模运算与LCM/GCD的协调。',
    practice: '在作曲台设计 kick 与 snare，使它们每隔一个LCM周期汇合。',
  },
  '5-1': {
    title: '排列与旋律',
    text: '同一组音符按不同顺序排列，会产生不同的旋律。逆行、倒影、旋转是旋律变奏的三种基本对称变换。',
    practice: '把 do-mi-sol 重新排列成 sol-mi-do，再试试逆行。',
  },
  '5-2': {
    title: '倒影与逆行',
    text: '逆行是时间轴上的反转，倒影是音高轴上的反转。两者可组合成更复杂的变换群。',
    practice: '把 do-re-mi-fa 逆行得到 fa-mi-re-do；倒影得到 do-♭si-la-sol。',
  },
  '5-3': {
    title: '循环移位',
    text: '把旋律整体循环移动位置，可得到新乐句。循环移位对应群论中的循环子群。',
    practice: '把 C-D-E-F-G 向右移一位得到 G-C-D-E-F。',
  },
  '5-B': {
    title: 'Boss：序列大师',
    text: 'Boss关要求在旋律轨道中运用排列、逆行、倒影或移位中的至少一种变换。',
    practice: '在作曲台旋律轨写一段动机，再用逆行或倒影扩展。',
  },
  '6-1': {
    title: '欧几里得算法与节奏',
    text: '欧几里得算法本身是一种递归：把k个脉冲均匀放进n步，余数又作为新的子问题。',
    practice: 'E(3,8)=[10010100] 是经典的 Bossa Nova 节奏。',
  },
  '6-2': {
    title: '斐波那契旋律',
    text: '斐波那契数列 1,1,2,3,5,8… 具有自相似性，可用来生成螺旋式旋律或节奏比例。',
    practice: '用斐波那契数列决定音符长度：1-1-2-3-5。',
  },
  '6-3': {
    title: '质数和弦',
    text: '用质数索引选择音高或节奏位置，能打破常规对称，产生独特的数学音色。',
    practice: '用质数 2,3,5,7,11 作为半音偏移构造和弦。',
  },
  '6-B': {
    title: 'Boss：作曲家',
    text: 'Boss关综合运用递归、自相似与算法节奏，用欧几里得节奏创作完整乐句。',
    practice: '在作曲台生成一段Euclidean节奏并扩展到多条轨道。',
  },
  '7-1': {
    title: '伯努利试验与随机节奏',
    text: '每一步都是一个伯努利试验：以概率p响，以概率1-p休止。大量独立试验会产生独特的随机纹理。',
    practice: '把每步概率设成50%，听一听随机鼓点；再试试某些步调高到80%形成重拍。',
  },
  '7-2': {
    title: '马尔可夫链旋律',
    text: '下一个音的概率只依赖于当前音，这就是马尔可夫性质。转移矩阵把音符连成一条"记忆长度为1"的旋律。',
    practice: '把当前音到下一音的转移概率集中在某个邻居上，听听旋律如何"顺滑"移动。',
  },
  '7-3': {
    title: '正态分布与力度',
    text: '钟形曲线N(μ,σ²)描述自然现象的集中与分散。把峰值位置μ和标准差σ映射到力度，可得到有呼吸感的动态。',
    practice: '调小σ让力度集中，调大σ让强弱对比更戏剧化。',
  },
  '7-B': {
    title: 'Boss：随机作曲家',
    text: 'Boss关要求用随机算法在32步内生成足够丰富的织体：总音符≥10且至少两条轨道发声。',
    practice: '随机不是杂乱，调整概率分布可以控制音乐的密度与层次。',
  },
  '8-1': {
    title: '和弦图与路径',
    text: '和弦可以看作图上的节点，合法的连接就是边。选择从起点到终点的路径，就是创作一段和弦进行。',
    practice: 'I→IV→V→I是最经典的路径，试试I→vi→IV→V。',
  },
  '8-2': {
    title: '邻接矩阵',
    text: '一个4×4邻接矩阵能完整描述4个和弦节点之间的连接关系。矩阵中的1表示可以一步到达。',
    practice: '把邻接矩阵设为环状（I-IV-V-vi-I），生成的进行会循环游走。',
  },
  '8-3': {
    title: '最短路径与旋律',
    text: 'Dijkstra算法可以找到图上权重最小的路径。把节点映射为音符、边权映射为音程距离，最短路径就是"最顺耳"的旋律。',
    practice: '选择远距离的起点和终点，听听算法如何"绕过"不协和音程。',
  },
  '8-B': {
    title: 'Boss：图论指挥',
    text: 'Boss关要求创作一段覆盖所有4个和弦节点至少一次的进行，体验哈密顿/欧拉路径思想。',
    practice: '设计一条经过I、IV、V、vi每个节点至少一次的路径。',
  },
};

export const LEVEL_TUTORIALS: Record<string, string> = {
  '1-1':
    '点击 A/B 轨道上的格子放置音符。A 只能在它的周期倍数步放，B 只能在它的周期倍数步放。目标是让两条轨道在 LCM 步同时响，并回答 LCM 是多少。',
  '2-1': '点击圆环上的音符来选择它们。选够3个后播放听和弦！',
  '3-1': '拖动滑块调整振荡器B的频率，使频率比达到3:2（660Hz）',
  '4-1': '点击播放观察双环运动。外环3步一圈，内环5步一圈。它们何时对齐？',
  '5-1': '点击两个格子交换音符位置，创作一段包含所有原动机音符的旋律。',
  '6-1': '点击格子开关音符，或用欧几里得按钮自动生成节奏模式。感受递归生成的自相似结构。',
};

export const LEVEL_HINTS: Record<string, string> = {
  '1-1': 'A 的倍数步和 B 的倍数步第一次重合的地方就是 LCM。',
  '1-2': '先算出 LCM(3,4)，再把音符放到各自的倍数步上。',
  '1-3': '4 和 5 互质，LCM 就是它们的乘积。',
  '1-B': 'Boss 关需要多组周期同时重合，抓住最大公约数。',
  '2-1': '选 3 个等间距的音符，听听大三和弦。',
  '2-2': '旋转整个和弦，音程关系保持不变。',
  '2-3': '倒影以某条轴为镜面，把音符映射到对称位置。',
  '2-B': 'Boss 关要求旋律或和弦具有镜像/等距对称。',
  '3-1': '纯五度的频率比是 3:2，把 B 调到 660 Hz。',
  '3-2': '拍频越慢，两个频率越接近。',
  '3-3': '7:4 和 11:8 对应更远的音程，试着接近目标比值。',
  '3-B': 'Boss 关综合调音，记住常见纯律比例。',
  '4-1': 'GCD(3,5)=1，两环在 LCM(3,5)=15 步对齐。',
  '4-2': 'GCD>1 时两环不会在所有位置相遇。',
  '4-3': '用中国剩余定理找同时满足两个同余条件的解。',
  '4-B': 'Boss 关要同时考虑 LCM 与 GCD。',
  '5-1': '排列就是重新排序；只要包含全部原动机音符，就是一个合法排列。',
  '5-2': '逆行是时间反转，倒影是音高镜像。',
  '5-3': '循环移位把旋律整体平移，得到新乐句。',
  '5-B': 'Boss 关至少组合两种变换。',
  '6-1': '试试 E(3,8) 节奏。',
  '6-2': '斐波那契数列 1,1,2,3,5,8… 决定音符长度或音高。',
  '6-3': '用质数索引选择音高，打破常规对称。',
  '6-B': 'Boss 关综合运用递归与算法节奏。',
  '7-1': '把每步概率设为 50%，听听随机鼓点。',
  '7-2': '转移矩阵让下一个音只依赖当前音。',
  '7-3': '调整 μ 和 σ，让力度曲线呈钟形。',
  '7-B': 'Boss 关需要足够丰富的随机织体。',
  '8-1': '选择一条至少 3 个节点的合法路径。',
  '8-2': '添加足够多的边，让和弦进行能循环。',
  '8-3': 'Dijkstra 会优先选择权值最小的边。',
  '8-B': 'Boss 关要求路径覆盖所有节点至少一次。',
};

export const CONCEPT_TO_WORLD: Record<string, number> = {
  lcm: 1,
  symmetry: 2,
  ratio: 3,
  crt: 4,
  permutation: 5,
  recursion: 6,
  probability: 7,
  graph: 8,
};
