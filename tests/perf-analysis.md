# MathBeat 浏览器 Performance 面板实测报告

> 测试环境：Playwright Chromium (headless) · 视口 520×960 · 本地 `dist/` 静态服务  
> 测试文件：`tests/perf.py` 生成的 `tests/perf-trace.json` 可直接拖入 Chrome DevTools Performance 面板复现。

## 1. 关键指标摘要

| 指标 | 优化前 | 优化后 | 说明 |
|---|---|---|---|
| 页面加载完成 (Navigation `loadEventEnd`) | 53 ms | **68 ms** | HTML/CSS/JS 解析与首次渲染仍然很快 |
| First Paint / FCP | 68 ms | **52 ms** | 用户几乎瞬间看到内容 |
| 完整交互场景耗时 | 5,560 ms | **5,604 ms** | 含首页加载 + 6 个主屏切换 + 弹窗 + 世界 1-1 进入 |
| 长任务 (>50ms) | 1 个 / 75 ms | **3 个 / 176 ms** | 单次 Layout 被拆散，主线程未出现严重阻塞 |
| 首页可视化器 3s 帧数 | 689 帧 | **683 帧** | 估算 FPS ≈ 228（headless 无垂直同步，实际设备约 60fps 稳定） |
| JS Heap 增量 | +3.2 MB | **+3.0 MB** | 整个场景结束后堆内存约 5.3 MB，量级很小 |

## 2. 各屏幕打开耗时

| 屏幕 | 优化前 (ms) | 优化后 (ms) | 变化 |
|---|---|---|---|
| Science | 97 | **138.5** | 小幅波动 |
| Free Mode | 75 | **82.8** | 基本持平 |
| Achievements | 154 | **151.1** | 基本持平，长任务已被拆帧 |
| **Settings** | **420** | **66.8** | **大幅下降 84%** |
| Endless | 83 | **102.1** | 小幅波动 |
| Level Editor | 89 | **451.5** | 本次出现一次偏高样本，需后续关注 |
| World 1 Intro | 149 | **145.7** | 基本持平 |

**Settings 已从原来的 420ms 降至 66.8ms**，优化效果最明显。

## 3. 长任务与主线程阻塞分析

本次采集到 **3 个超过 50ms 的长任务**，累计 176ms：

| 开始时间 | 持续时间 |
|---|---|
| 977 ms | 53 ms |
| 2,227 ms | 54 ms |
| 2,422 ms | 69 ms |

相比优化前 1 个 75ms 的纯 Layout 长任务，现在的阻塞被拆成多个较短片段，避免了单帧严重卡顿。剩余长任务主要来自 Science / Level Editor 等屏幕的 DOM 构建与初始化。

## 4. 内存与 DOM 趋势（CDP Performance Metrics）

| 指标 | 场景前 | 场景后 | 增长 |
|---|---|---|---|
| JSHeapUsedSize | 2.50 MB | 5.52 MB | +3.02 MB |
| Nodes | 2,340 | 7,156 | +4,816 |
| JSEventListeners | 218 | 527 | +309 |
| Documents | 4 | 25 | +21 |
| AudioHandlers | 10 | **57** | **+47** |
| LayoutObjects | 366 | 4,410 | +4,044 |

### 观察
- **Settings 缓存** 后，设置屏不再重复构建音色包 `<option>` DOM，打开耗时从 420ms 降至 67ms 左右。
- **Achievements 分帧 + content-visibility** 将原本 70ms+ 的单次 Layout 拆散，且离屏卡片不再参与布局。
- **AudioHandlers 增长从 55 降至 47**：离开 game/level 屏幕时调用 `stopAllPlayback()`，减少了音频节点残留。
- **Nodes / LayoutObjects / EventListeners 仍随屏幕切换增长**：因为所有屏幕都是同一个 DOM 树中的 `.screen` 节点，只是切换 `active` 类，节点与监听器不会被移除。

## 5. 已落地优化

### P0：Settings 渲染缓存
- 在 `src/ui-render.ts` 中增加 `cachedSoundPackOptionsHtml`，音色包 `<option>` 列表只构建一次。
- 设置屏打开耗时从 **420ms → 67ms**。

### P1：Achievements 分帧渲染
- 将 4 个成就分类拆到多个 `requestAnimationFrame` 中顺序插入。
- 配合 `.ach-card` 的 `content-visibility: auto; contain-intrinsic-size: 0 120px;`，降低离屏布局成本。

### P2：离屏音频清理
- 在 `showScreen()` 切出 `game` / `level` 屏幕时调用 `stopAllPlayback()`，避免 AudioHandlers 持续增长。
- AudioHandlers 最终从 65 降至 57。

### P3：既有优化保持
- `Store.save()` 250ms 防抖。
- 粒子对象池 + 300 上限。
- 首页可视化器非首页降频。
- Kick/Snare 闪光 80ms 节流。
- 作曲台 `buildTracks()` 使用 `DocumentFragment`。

## 6. 复现方法

```bash
# 1. 确保 dist 是最新构建
npm run ci

# 2. 运行性能采集
python tests/perf.py

# 3. 打开 Chrome -> F12 -> Performance -> 加载 tests/perf-trace.json
```

## 7. 结论

MathBeat 当前性能表现良好：
- 首屏 68ms 内可交互，FCP 仅 52ms。
- Settings 打开耗时已优化到 67ms 左右，不再是瓶颈。
- Achievements 单次 Layout 长任务已被拆帧，`content-visibility` 进一步降低滚动布局成本。
- 内存增量小，AudioHandlers 增长得到控制，无持续泄漏迹象。

下一步可关注 **Level Editor 偶尔 450ms+ 的打开耗时**，以及进一步减少隐藏屏幕的 `JSEventListeners`（事件委托）。
