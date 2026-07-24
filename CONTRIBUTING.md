# MathBeat 贡献指南

感谢您考虑为 MathBeat 贡献代码！MathBeat 是一款将数学与音乐深度融合的开源教育游戏。本指南帮助您快速参与项目。

## 1. 开发环境

### 环境要求

- **Node.js** 18 或更高版本
- **npm**（随 Node.js 安装）
- 构建 Tauri 桌面应用时还需 **Rust 工具链**（可选）

### 启动步骤

```bash
git clone <仓库地址>
cd MathBeat-App
npm install
npm run dev          # 启动开发服务器，访问 http://localhost:8080
```

### 常用脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动 Vite 开发服务器（端口 8080，strictPort） |
| `npm run build` | TypeScript 编译 + Vite 生产构建（产出 `dist/`） |
| `npm run typecheck` | 仅做 TypeScript 类型检查（`tsc --noEmit`） |
| `npm run test` | 运行 Vitest 单元测试 |
| `npm run test:coverage` | 运行单元测试并生成 v8 覆盖率报告 |
| `npm run test:e2e` | 运行 Playwright E2E 测试（需先启动 dev server） |
| `npm run lint` | ESLint 检查 `src/` 下 TypeScript 文件 |
| `npm run lint:fix` | ESLint 自动修复 |
| `npm run format` | Prettier 格式化源码与 HTML |
| `npm run ci` | 完整 CI 流程：typecheck + lint + test + build + e2e |

## 2. 代码规范

- **语言**：TypeScript，启用 `strict` 模式（见 `tsconfig.json`）。
- **代码风格**：ESLint + Prettier（配置见 `.eslintrc.cjs` 与 `.prettierrc`）。
- **提交前自检**：请务必在本地运行以下命令并确保全部通过：

  ```bash
  npm run typecheck && npm run lint && npm run test
  ```

- 不引入新的运行时依赖以保持 bundle 精简（当前运行时依赖仅 `@tauri-apps/api`）。如确有必要，需在 PR 中说明理由。

## 3. Commit 规范

遵循 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/v1.0.0/)：

```
<type>(<scope>): <description>
```

常用 type：

- `feat`：新功能
- `fix`：bug 修复
- `docs`：文档变更
- `refactor`：重构（不改变行为）
- `test`：测试相关
- `chore`：构建/工具/依赖等杂项

示例：

```
feat(worlds): 新增 World 9 图论进阶关卡
fix(audio): 修复 AudioContext 挂起导致节拍丢失
docs: 更新 README 安装说明
test(schema): 增加原型污染防御回归测试
```

## 4. 测试要求

- **新功能**需附带单元测试（置于 `src/**/*.test.ts`，使用 Vitest + happy-dom）。
- **Bug 修复**需附带回归测试，覆盖触发该 bug 的输入。
- **E2E 测试**（`e2e/`，使用 Playwright）用于端到端流程验证，新增主要流程时考虑补充。
- 覆盖率配置已就位（v8 provider，阈值见 `vite.config.ts`），请尽量提升所改模块的覆盖率。

## 5. 可访问性要求

MathBeat 面向教育场景（含融合教育），可访问性是硬性要求，不可削减：

- 所有新 UI 必须**支持键盘操作**（Tab/Enter/Space/ESC），模态需实现焦点陷阱（参考 `src/a11y.ts` 的 `openModal`/`closeModal`）。
- 交互元素需有 **`aria-label`** 或可访问名称（WCAG 3.3.2 / 4.1.2）。
- 颜色对比度 **≥ 4.5:1**（WCAG 1.4.3 AA），参考 CSS 变量 `--dim`/`--error`/`--success` 的取值。
- 状态变化（如关卡完成、升级）应通过 `announce()` 经 `aria-live` 区域播报（WCAG 4.1.3）。
- 动效需响应 `prefers-reduced-motion`（WCAG 2.3.3），参考 `src/visual-beat.ts` 的 `readReducedMotion()`。
- 视觉节拍模式（`settings.visualBeat`）应为听障用户提供听觉替代反馈（WCAG 1.2.1）。

## 6. 安全要求

MathBeat 可能被未成年学生使用，安全标准不可降低：

- **不接受降低安全标准的 PR**。若改动涉及鉴权、CSP、输入校验等安全机制，需在 PR 中明确说明。
- 所有**用户输入必须校验**。接受外部 JSON 的入口（存档导入、分享码、自定义关卡、作曲台导入等）必须经过 `src/schema.ts` 的校验器。
- **禁止 `innerHTML` 拼接未转义数据**，防止存储型/反射型 XSS。
- 防御原型污染：schema 校验拒绝 `__proto__`/`constructor`/`prototype` 键。
- 教师面板鉴权保持 **Fail-Closed**：鉴权异常时禁止进入，不得回退为 Fail-Open。
- 错误上报默认关闭，启用时必须脱敏 URL 与 User-Agent。

## 7. 提交 PR

1. **Fork** 本仓库到您的 GitHub 账号。
2. 基于 `main` 创建特性分支：

   ```bash
   git checkout -b feat/your-feature
   ```

3. 编写代码与测试，确保 `npm run typecheck && npm run lint && npm run test` 全部通过。
4. 提交符合 Conventional Commits 规范的 commit。
5. 推送分支并向 `main` 提交 **Pull Request**。
6. PR 描述需包含：
   - **变更说明**：做了什么、为什么。
   - **测试方式**：如何验证本次变更（新增/修改了哪些测试，手动验证步骤）。
   - **影响面**：是否影响现有功能、可访问性或安全机制。
7. 等待 CI（GitHub Actions：typecheck + lint + test + build + e2e）通过并接受 review。

## 8. 行为准则

请保持友善、尊重的协作态度。针对代码的讨论聚焦于代码本身，不针对个人。

---

再次感谢您为 MathBeat 贡献力量！
