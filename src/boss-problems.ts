/**
 * BOSS 数学问题化
 * 为每个世界的 Boss 关赋予一个具体的数学问题/对象名称，
 * 让玩家感受到自己在挑战真实的数学结构。
 */

export interface BossProblem {
  id: string;
  worldId: number;
  title: string;
  emoji: string;
  problem: string;
  mathStatement: string;
  hint: string;
  reward: string;
}

export const BOSS_PROBLEMS: Record<string, BossProblem> = {
  '1-B': {
    id: '1-B',
    worldId: 1,
    title: '无理数巨龙的节拍',
    emoji: '🐉',
    problem: '两条节奏轨道的周期分别为 6 和 8，它们何时能在同一拍上同时敲响？',
    mathStatement: '求 LCM(6, 8) 与 GCD(6, 8)，并验证 LCM(a,b) × GCD(a,b) = a × b。',
    hint: '先分解质因数：6 = 2×3，8 = 2³。GCD 取公共部分，LCM 取所有部分的乘积。',
    reward: '解锁鼓组与欧几里得节奏',
  },
  '2-B': {
    id: '2-B',
    worldId: 2,
    title: '二面体群的镜像宫殿',
    emoji: '🏛️',
    problem: '正十二边形的对称群 D₁₂ 有多少种不同的对称操作？',
    mathStatement: '|Dₙ| = 2n。D₁₂ 包含 12 次旋转与 12 条反射轴，共 24 个元素。',
    hint: '旋转：0°, 30°, 60° … 330°；反射：过顶点或边中点的轴各 6 条。',
    reward: '解锁旋律音色与模运算',
  },
  '3-B': {
    id: '3-B',
    worldId: 3,
    title: '毕达哥拉斯的调音谜题',
    emoji: '🔺',
    problem: '如何仅使用 2:1、3:2、4:3 这些比例，构造一个五度相生的音阶？',
    mathStatement: '纯五度链：440 × (3/2)ⁿ × 2⁻ᵏ，通过调整八度归一得到 12 个音。',
    hint: '每次乘以 3/2 升五度，若超过倍频则除以 2 降八度。',
    reward: '解锁贝斯音色与质数比例',
  },
  '4-B': {
    id: '4-B',
    worldId: 4,
    title: '孙子定理的同步钟塔',
    emoji: '🕰️',
    problem: '大钟每 7 步敲响一次，小钟每 9 步敲响一次，它们第几次会同时敲响？',
    mathStatement: '7 与 9 互质，CRT 保证在模 63 下有唯一解：x ≡ 0 (mod 7) 且 x ≡ 0 (mod 9)。',
    hint: 'GCD(7,9)=1，所以 LCM(7,9)=63。两个周期在第 63 步重逢。',
    reward: '解锁对称变换',
  },
  '5-B': {
    id: '5-B',
    worldId: 5,
    title: '置换群的歌剧舞台',
    emoji: '🎭',
    problem: '一段 6 个音符的动机，通过逆行、倒影、循环移位能变出多少种“亲戚”旋律？',
    mathStatement: 'S₆ 有 6! = 720 种排列；考虑二面体群 D₆ 的轨道可分类等价变奏。',
    hint: '先尝试对 4 个音符的动机做逆行、倒影，再扩展到循环移位。',
    reward: '解锁序列与动机系统',
  },
  '6-B': {
    id: '6-B',
    worldId: 6,
    title: '黄金分割的分形森林',
    emoji: '🌳',
    problem: '斐波那契数列相邻项的比值会收敛到哪个无理数？',
    mathStatement: 'lim Fₙ₊₁/Fₙ = φ = (1+√5)/2 ≈ 1.618，即黄金比例。',
    hint: '列出前几项：1, 1, 2, 3, 5, 8, 13… 计算 13/8、21/13，观察趋势。',
    reward: '解锁斐波那契、递归与完整作曲台',
  },
  '7-B': {
    id: '7-B',
    worldId: 7,
    title: '马尔可夫链的迷宫',
    emoji: '🌀',
    problem: '一个三状态马尔可夫链，平稳分布 π 满足 πP = π。如何求出它？',
    mathStatement: '解线性方程组 π(Pᵀ - I) = 0，附加 ∑πᵢ = 1。',
    hint: '如果转移矩阵各行相同，则平稳分布就是任意一行。',
    reward: '解锁随机作曲算法',
  },
  '8-B': {
    id: '8-B',
    worldId: 8,
    title: '哥尼斯堡七桥的和声版',
    emoji: '🌉',
    problem: '能否在和弦图上找到一条路径，经过每个节点至少一次并回到起点？',
    mathStatement: '欧拉回路存在当且仅当图连通且每个顶点度数为偶数。',
    hint: '检查每个和弦节点的连接数（度数），若全为偶数则存在回路。',
    reward: '解锁图论指挥',
  },
};

export function getBossProblem(levelId: string): BossProblem | null {
  return BOSS_PROBLEMS[levelId] || null;
}
