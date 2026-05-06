# 设备管理 — 品牌筛选 端到端测试

## 产物清单

```
pipeline-demo/
├── 00-environment-and-dependencies.md  ← 环境准备 + 隐式依赖链
├── 00.1-mcp-tool-manifest.md           ← 输入④：MCP 工具清单（schema、参数、页面级/元素级）
├── 00.2-robust-locate-dependency.md    ← 输入⑤：robustLocate 实现接口（最终脚本运行时依赖）
├── 00.3-page-under-test.md             ← 输入③：被测页面 DOM 结构
├── 01-input-natural-language.md        ← 输入①：自然语言用例
├── 01.5-llm-tool-planning.md           ← 产出：LLM 工具编排推理
├── 02-mcp-execution-log.md             ← 产出：MCP 调用记录 + addCode + XPath 汇总
├── 03-translation-rules.md             ← 输入⑥/产出：翻译规则
├── 04-final-spec.spec.ts               ← 最终产出：带 robustLocate 的 .spec.ts
├── output/                             ← 🆕 自动化产物（JSON）
│   ├── raw-mcp-log.json                ← 原始 JSON-RPC 请求/响应（11 条）
│   ├── addcode-list.json               ← resolved locator 路径（11 条 addCode）
│   └── xpath-data.json                 ← xpath / fullXPath 数据（10 条元素级）
└── README.md                           ← 本文件
```

## 输入（6 项）

| # | 文件 | 所属层 | 说明 |
|---|------|--------|------|
| ① | `01-input-natural-language.md` | 业务层 | 自然语言测试用例 |
| ② | 页面快照（运行时） | 运行时 | ARIA 树，含 ref 定位信息 |
| ③ | `00.3-page-under-test.md` | 应用层 | 被测页面的 DOM 结构和交互逻辑 |
| ④ | `00.1-mcp-tool-manifest.md` | 工具层 | 11 个 MCP 工具的 schema，LLM 编排依据 |
| ⑤ | `00.2-robust-locate-dependency.md` | 框架层 | robustLocate 接口和三层策略逻辑 |
| ⑥ | `03-translation-rules.md` | 翻译层 | 页面级/元素级区分、合并、命名规则 |

## 产出（8 项）

| # | 文件 | 说明 |
|---|------|------|
| ①.5 | `01.5-llm-tool-planning.md` | 用例语义→工具映射、快照→ref提取、参数组装 |
| ② | `02-mcp-execution-log.md` | 11 次 JSON-RPC 请求/响应 + 11 条 addCode + 5 条 XPath |
| ②.1 | `output/raw-mcp-log.json` | 🆕 原始 MCP JSON-RPC 请求/响应（结构化 JSON） |
| ②.2 | `output/addcode-list.json` | 🆕 所有工具的标准 Playwright addCode 汇总 |
| ②.3 | `output/xpath-data.json` | 🆕 元素级工具的 xpath / fullXPath 提取结果（10 条） |
| ③ | `04-final-spec.spec.ts` | 最终 .spec.ts，含 robustLocate 三层兜底 |
| ④ | 测试执行结果 | 11 步全部通过（记录在 ② 中） |
| ⑤ | 页面快照 YAML | `.playwright-mcp/` 目录，运行时自动保存 |

## 流程

```
环境准备 (00)
  dev-server :8080 ← 被测页面
  patch → coreBundle.js ← inject-tools.js
  MCP server ← patched bundle
         │
①+②+③+④ ──→ ①.5 LLM 工具编排
         │     读快照找 ref、匹配工具 schema、组装参数
         │
         ▼
        ② MCP 逐条执行
         │     定位元素 → 检查条件 → addCode
         │     元素级工具 → extractXPath → xpath/fullXPath
         │     ↓
         │   output/raw-mcp-log.json    ← 原始 JSON-RPC
         │   output/addcode-list.json   ← resolved locator 路径
         │   output/xpath-data.json     ← XPath 数据
         │
         ▼
        ③ addCode 汇总（标准 Playwright）
         │
    ⑤+⑥ ↓
        ④ 翻译
         │     页面级 → 裸 expect
         │     元素级 → robustLocate(action: (loc) => expect(loc).toBeVisible())
         │
         ▼
        ⑤ 最终 .spec.ts

运行时: ⑤ 依赖 ⑤(robustLocate)
```

## 关键决策

- **翻译在外部**：MCP 工具输出标准 Playwright 代码，不耦合项目特有的 robustLocate
- **页面级 vs 元素级**：`page.getByText()` 裸 expect / `page.locator('#xxx').getByText()` 包裹 robustLocate
- **三层策略**：semantic（最稳定）→ xpath（兜底）→ fullXPath（极限兜底）→ LLM 修复
