# 变更日志

本项目所有重要变更记录于此文件。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 安全
- 修复光敏癫痫风险：打击闪光节流从 80ms(12.5Hz) 提升至 333ms(3Hz)，峰值亮度从 0.18 降至 0.1（WCAG 2.3.1）
- 教师鉴权从 Fail-Open 改为 Fail-Closed：鉴权异常时禁止进入教师面板
- 删除源码注释中的教师明文密码
- 新增原型污染防御：schema 校验拒绝 `__proto__`/`constructor`/`prototype` 键
- CSP 策略收紧：添加 `frame-ancestors 'none'`、`worker-src 'self'`

### 可访问性
- 全站添加语义化 HTML：home/achievements/settings 屏添加 sr-only 标题（WCAG 1.3.1）
- CSS 变量对比度修复：--dim/--error/--success 调深至 ≥4.5:1（WCAG 1.4.3）
- skip-link 添加 :focus 可见样式（WCAG 2.4.1/2.4.7）
- 表单控件添加 aria-label（WCAG 3.3.2/4.1.2）
- 听障视觉反馈扩展：playCorrect/playWrong/playClick 触发视觉脉冲与 announce（WCAG 1.2.1）
- 视觉节拍模式支持 prefers-reduced-motion（WCAG 2.3.3）
- 关卡完成/星级/升级状态通过 aria-live 播报（WCAG 4.1.3）

### 数据安全
- 存档损坏时从 IndexedDB fallback 恢复，不再静默丢失进度
- 新增影子备份机制（mathbeat_state_prev）
- 新增 purgeUserData() 一键清除所有用户数据（隐私合规）
- 修复 exportGameData 版本号不一致问题

### 可观测性
- 错误上报增加 sessionId 与 severity 分级
- 新增 Web Vitals 采集（LCP/CLS/INP），页面隐藏时上报
- 错误上报 URL 与 User-Agent 脱敏

### 性能
- MutationObserver 回调 debounce 50ms，降低全树扫描频率
- startHomeVisualizer 非首页 10 秒后自动停止
- math-visuals RAF 循环支持 stopAllMathVisuals 取消

### 工程化
- ESLint 恢复 5 条规则为 warn 级别
- 生产构建启用隐藏 sourcemap
- 新增 chunkSizeWarningLimit: 200
- 新增 test:coverage 脚本与 v8 覆盖率配置
- 新增 _headers 缓存策略配置
- PWA manifest 标记 screenshot/maskable icon TODO

## [1.0.0] - 2026-07-15
- 首次发布：8 个数学世界、科学之声、无尽模式、每日挑战、作曲台、教师面板
