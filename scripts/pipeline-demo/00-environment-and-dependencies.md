# 阶段 0：环境准备 & 隐式依赖分析

## 运行环境搭建（3 步，不在 pipeline-demo 产物中）

### 步骤 1：启动 dev server
```
localhost:8080 提供 device-manager.html（被测页面）
```

### 步骤 2：打补丁
```
inject-tools.js  ──patch-verify.cjs──→  coreBundle.js
```
将 10 个自定义断言工具注入 Playwright 的编译产物。

### 步骤 3：启动 MCP server
```
node cli.js --headless --caps core
```
加载打过补丁的 coreBundle.js，启动无头浏览器。

---

## 完整输入清单（含隐式）

| # | 输入 | 类型 | 说明 | 是否已落地 |
|---|------|------|------|-----------|
| ① | 自然语言用例 | 文本 | "验证 Apple 标签可见，点击，验证结果" | ✅ `01-input-natural-language.md` |
| ② | 页面快照 | 运行时数据 | 浏览器实时生成的 ARIA 树，含 ref 定位信息 | ✅ 在 `02-mcp-execution-log.md` Step 0.5 中引用 |
| ③ | 被测页面 | HTML/JS | `device-manager.html` — 筛选面板、品牌标签、表格 | ❌ 未落地 |
| ④ | MCP 工具定义 | 代码 | `inject-tools.js` — 10 个工具的 schema、参数、能力 | ❌ 未落地 |
| ⑤ | robustLocate 实现 | 代码 | `repair-helper.ts` — 三层策略兜底 + LLM 修复 | ❌ 未落地（最终脚本依赖它） |
| ⑥ | 翻译规则 | 文本 | `GENERATE_PROMPT.md` — 页面级/元素级区分、合并、命名 | ✅ `03-translation-rules.md` |

## 完整输出清单（含隐式）

| # | 输出 | 类型 | 说明 | 是否已落地 |
|---|------|------|------|-----------|
| ①.5 | LLM 工具编排 | 推理记录 | 用例→工具映射、快照→ref 提取、参数组装 | ✅ `01.5-llm-tool-planning.md` |
| ② | MCP 调用序列 | 日志 | 14 次 JSON-RPC 请求/响应 + addCode | ✅ `02-mcp-execution-log.md` |
| ③ | 页面快照文件 | YAML | `.playwright-mcp/page-*.yml` — 每一步的完整 ARIA 树 | ❌ 未落地（二进制/磁盘文件） |
| ④ | 最终 .spec.ts | 代码 | 带 robustLocate 的 Playwright 测试脚本 | ✅ `04-final-spec.spec.ts` |
| ⑤ | 测试执行结果 | 状态 | 11 步全部通过 | ✅ 在 `02-mcp-execution-log.md` 中 |
| ⑥ | 翻译规则 | 文本 | 同上，输入也是输出（LLM 翻译的依据） | ✅ `03-translation-rules.md` |

## 隐式依赖链

```
repair-helper.ts          ──→  最终 spec 的 robustLocate() 调用依赖它
inject-tools.js           ──→  MCP server 的工具能力取决于它
coreBundle.js (patched)   ──→  MCP server 的运行基础
device-manager.html       ──→  浏览器加载的目标页面
dev server :8080          ──→  页面可达的前提
MCP server :xxxx          ──→  工具可调用的前提
```

## 说明

未落地的 3 项输入（③④⑤）是基础设施层的代码，不属于本次用例执行的产物，但它们决定了"能调哪些工具"和"最终脚本跑在什么框架上"。如果把范围扩大到"整个系统的输入"，应该包含它们。

未落地的 1 项输出（③页面快照）是二进制/YAML 文件，记录了每步操作后的页面完整状态，可用于调试和 LLM 修复时的上下文。
