# MathBeat

> 让数学像音乐一样流动。

MathBeat 是一款将数学与音乐深度融合的桌面/网页节奏教育游戏。玩家通过解决基于数论、群论、概率、图论等数学概念的题目，驱动鼓组、贝斯、旋律与和弦的生成，最终创作出属于自己的数学摇滚作品。

基于 Buehler (2025) 的 *Selective Imperfection as a Generative Framework* (arXiv:2601.00863) 中提出的 materiomusic 框架，MathBeat 将数学结构作为"物质"，将音乐创作为"声音"，将关卡验证作为"可逆映射"，将 Boss 评分作为"选择性不完美"机制——实现了该框架在游戏化教育领域的系统性落地。

## 核心功能

### 游戏关卡

- **8 个数学主题世界，48 道关卡 + 8 个 Boss 关**
  - World 1: LCM/GCD 与复节奏对齐
  - World 2: 对称群与和弦变换（回文、旋转、倒影）
  - World 3: 频率比与调音系统（纯律 vs 平均律）
  - World 4: 中国剩余定理与对位法
  - World 5: 排列与旋律变换（音高集合旋转）
  - World 6: 欧几里得节奏/递归/分形
  - World 7: 概率与随机音乐（骰子/马尔可夫/正态分布）
  - World 8: 图论与和弦进行（Dijkstra 最短路径）
- **Boss 作曲台**：每个世界末尾的综合挑战，用 Mini-Composer 在 32 步 4 轨道网格上创作，系统用数学规则判定是否通关
- **无尽模式**：随机生成题目，答对累积旋律音符，支持限时挑战与单世界专注练习
- **每日挑战**：每天一种随机题型，支持连续打卡与全类型收集

### Materiomusic 深化模块

基于 Buehler 论文实现的三个核心功能，从科学之声页面进入：

- **音阶实验室 (Scale Lab)**：穷举全部 2^12 = 4096 种音阶，计算每种的 Shannon 熵和缺陷密度，绘制 Hall-Petch 散点图。文化音阶（大调、小调、五声、蓝调等）以橙色标注，聚集在"中等熵-中等缺陷走廊"中——直接验证论文的核心定量发现
- **蛋白质声化 (Protein Sonification)**：基于 20 种氨基酸的振动频率特征，实现蛋白质序列 ↔ 音乐的双向可逆映射。内置胰岛素、GFP 荧光蛋白、T4 溶菌酶、蜘蛛丝蛋白四种真实样本。支持逆向映射测试：输入音符序列反推氨基酸
- **蜘蛛网声化 (Spider Web Sonification)**：将 3D 蜘蛛网图结构映射为可演奏乐器。节点半径→音高，张力→力度，振动按 BFS 路径从中心向外传播。三种拓扑：圆网、乱网、片网

### 创作工具

- **完整作曲台**：多轨道数学摇滚编曲，支持 MIDI 导出与分享码
- **示例曲库**：内置数学摇滚示例，可试听并导入作曲台二次创作
- **关卡编辑器**：自定义参数、自动难度评级、分享码导入导出
- **科学之声**：导入真实科学数据（DFT、MD、FEM、CFD、XRD、DNA、脉冲星等 7 类）并映射为音乐

### 系统功能

- **成就系统**：进度、技巧、探索、隐藏四类共 18 个成就
- **中英双语**：`zh` / `en` 一键切换
- **PWA 支持**：可离线安装的渐进式 Web 应用
- **速通模式**：设置页一键解锁全部内容，方便测试与演示
- **零外部音频依赖**：全部音频通过 Web Audio API 实时合成

## 技术架构

```
MathBeat-App/
├── src/                       # TypeScript 源代码
│   ├── worlds/                # 8 个世界的关卡逻辑 (world1-8.ts)
│   ├── materiomusic.ts        # Materiomusic 深化模块
│   ├── science.ts             # 科学之声：7 类科学数据声化
│   ├── composer/              # 作曲台子组件
│   │   └── mini-composer.ts   # Boss 作曲台
│   ├── core/
│   │   └── transport.ts       # 共享 Transport (节拍调度引擎)
│   ├── audio.ts               # Web Audio API 实时合成引擎
│   ├── game-engine.ts         # 游戏状态机与关卡流程
│   ├── ui-render.ts           # UI 渲染层
│   ├── events.ts              # 事件委托系统
│   └── fx/                    # 粒子与视觉反馈
├── src-tauri/                 # Tauri 桌面应用 Rust 后端
├── e2e/                       # Playwright E2E 测试 (26 个)
├── .github/workflows/         # CI + Release 工作流
├── index.html                 # 主游戏界面
├── composer.html              # 独立作曲台界面
└── package.json
```

### 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | Vite 6 + TypeScript 5 (strict mode) |
| 桌面壳 | Tauri 1.x (Rust) |
| 音频引擎 | Web Audio API 实时合成，零外部音频依赖 |
| 单元测试 | Vitest + happy-dom (59 个) |
| E2E 测试 | Playwright (26 个，含完整 48 关通关测试) |
| 代码质量 | ESLint + Prettier + tsc strict |
| CI/CD | GitHub Actions (CI + 跨平台 Release) |

## 快速开始

### 开发服务器

```bash
npm install
npm run dev          # http://localhost:8080
```

### 构建前端

```bash
npm run build        # 产出 dist/
```

### 构建桌面应用

```bash
npm run tauri:build  # 需要 Rust 工具链
# 产物: src-tauri/target/release/
```

### 测试与检查

```bash
npm run ci           # typecheck + lint + test + build + e2e
npm run typecheck    # TypeScript 类型检查
npm run test         # 单元测试
npm run test:e2e     # E2E 测试 (需先启动 dev server)
npm run lint         # ESLint
```

## CI/CD

### CI Workflow (`.github/workflows/ci.yml`)

每次 push 到 main/master 或 PR 时自动运行：
- TypeScript 类型检查 (`tsc --noEmit`)
- ESLint 代码检查
- Vitest 单元测试 (59 个)
- Vite 生产构建
- Playwright E2E 测试 (26 个)
- 构建产物上传为 artifact

### Release Workflow (`.github/workflows/release.yml`)

推送 `v*` 标签时自动触发跨平台构建：
- Windows (MSI + NSIS)
- macOS (DMG + App)
- Linux (deb + AppImage)

```bash
git tag v1.0.0
git push origin v1.0.0
```

## 代码统计

| 指标 | 数值 |
|------|------|
| TypeScript 模块 | 44+ |
| 单元测试 | 59 个，全部通过 |
| E2E 测试 | 26 个，全部通过 |
| TypeScript 错误 | 0 (strict mode) |
| ESLint 警告 | 0 |
| 数学主题世界 | 8 |
| 关卡总数 | 48 + 8 Boss |
| 科学数据类型 | 7 类 × 6-8 映射方案 |
| 音阶穷举 | 4096 种 |
| 蛋白质样本 | 4 种真实序列 |

## 学术关联

MathBeat 的设计基于 Markus J. Buehler (MIT) 的论文：

> Buehler, M. J. (2025). *Selective Imperfection as a Generative Framework for Analysis, Creativity and Discovery*. arXiv:2601.00863.

论文核心概念与 MathBeat 的对应关系：

| 论文概念 | MathBeat 实现 |
|----------|---------------|
| Materiomusic 可逆映射 | 8 个世界的 Boss 作曲台双向映射 |
| 选择性不完美 | Boss 评分函数的中等约束走廊 |
| 振动作为共享语法 | Web Audio API 实时合成 |
| 2^12 音阶穷举 + Hall-Petch | 音阶实验室 |
| 蛋白质声化 + 可逆性 | 蛋白质声化模块 |
| 蜘蛛网声化 | 蜘蛛网声化模块 |

---

**MathBeat** — 让数学像音乐一样流动。
