# 第三方资源声明

本文件声明 MathBeat 所使用的第三方资源与依赖情况。

## 1. 音频资源

**MathBeat 的音频全部由 Web Audio API 本地实时合成，无任何外部音频样本。**

本应用不包含 `.mp3`、`.wav`、`.ogg` 等音频文件，不流式加载任何远端音频资源。所有鼓组、贝斯、旋律、和弦及科学之声声化均通过 `src/audio.ts`、`src/synth.ts`、`src/core/transport.ts` 中的振荡器、噪声生成器与滤波器实时合成。

## 2. 图标与 SVG

项目使用的图标与 SVG 背景均为**项目原创**或基于 **MIT 兼容许可**，无第三方版权素材：

- 世界背景：`public/assets/bgs/w1.svg` ~ `w8.svg`
- 世界图标：`public/assets/icons/w1.svg` ~ `w8.svg`
- 吉祥物：`public/assets/mascot.svg`
- 应用图标：`public/icons/*.png`、`src-tauri/icons/*`

## 3. 字体

本应用使用**系统默认字体栈**，不加载任何第三方网络字体（无 Google Fonts、无 `@font-face` 远程引用），无字体版权问题。

## 4. 依赖

### 运行时依赖（`dependencies`）

| 包名 | 版本 | 许可证 |
|------|------|--------|
| `@tauri-apps/api` | ^1.5.0 | MIT |

### 开发依赖（`devDependencies`，仅构建/测试时使用，不进入运行时产物）

| 包名 | 版本 | 许可证 |
|------|------|--------|
| `vite` | ^6.2.7 | MIT |
| `typescript` | ^5.3.0 | Apache-2.0 |
| `vitest` | ^3.2.6 | MIT |
| `@playwright/test` | ^1.61.1 | Apache-2.0 |
| `playwright` | ^1.42.0 | Apache-2.0 |
| `eslint` | ^8.57.0 | MIT |
| `@typescript-eslint/eslint-plugin` | ^7.0.0 | MIT |
| `@typescript-eslint/parser` | ^7.0.0 | MIT |
| `prettier` | ^3.8.4 | MIT |
| `@types/node` | ^20.0.0 | MIT |
| `happy-dom` | ^20.10.6 | MIT |
| `jsdom` | ^29.1.1 | MIT |
| `@tauri-apps/cli` | ^1.5.0 | MIT |

> 许可证信息均依据各包在 npm registry 声明的 `license` 字段。Apache-2.0 与 MIT 均为开源许可证，允许教育与企业使用。

## 5. 学术引用

MathBeat 的设计基于以下学术论文（论文本身版权归属原作者，本应用为该框架的工程实现）：

> Buehler, M. J. (2025). *Selective Imperfection as a Generative Framework for Analysis, Creativity and Discovery*. arXiv:2601.00863.

## 6. 数据样本

科学之声模块内置的真实科学数据样本（如胰岛素、GFP 荧光蛋白等蛋白质序列）来源于公开学术数据，仅用于教育性声化演示，相关权利归属原数据发布方。

---

如发现本声明有遗漏或不准确之处，请通过项目仓库提交 Issue。
