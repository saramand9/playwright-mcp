/**
 * 修补 playwright-core 的 coreBundle.js，启用并新增断言工具。
 *
 * 做 3 处修改（均幂等，重复运行无副作用）：
 *   1. 4 个已有 verify 工具：capability: "testing" → "core"
 *   2. var 声明行：追加 3 个新变量名
 *   3. 插入 3 个新工具（text_not_visible / element_not_visible / count）+ 更新 export
 *
 * 用法: node scripts/patch-verify.cjs [coreBundle.js路径]
 *
 * 防覆盖：在 playwright-mcp 根 package.json 配置:
 *   "scripts": { "postinstall": "node scripts/patch-verify.cjs" }
 */

const fs = require('fs');
const path = require('path');

const BUNDLE_PATH = process.argv[2] || path.join(__dirname, '..', 'node_modules', 'playwright-core', 'lib', 'coreBundle.js');

if (!fs.existsSync(BUNDLE_PATH)) {
  console.error(`[patch-verify] 文件不存在: ${BUNDLE_PATH}`);
  process.exit(1);
}

let src = fs.readFileSync(BUNDLE_PATH, 'utf-8');
let patched = 0;

// ── 1. 变量声明：追加新变量 ──────────────────────────────────
if (src.includes('verifyTextNotVisible, verifyElementNotVisible, verifyCount')) {
  console.log('[patch-verify] ① 变量声明已修补，跳过。');
} else {
  const oldDecl = 'var z23, verifyElement, verifyText, verifyList, verifyValue, verify_default;';
  const newDecl = 'var z23, verifyElement, verifyText, verifyList, verifyValue, verifyTextNotVisible, verifyElementNotVisible, verifyCount, verify_default;';
  if (src.includes(oldDecl)) {
    src = src.replace(oldDecl, newDecl);
    console.log('[patch-verify] ① 变量声明已更新。');
    patched++;
  } else {
    console.error('[patch-verify] ✗ 未找到 var 声明行，可能 bundle 格式已变。');
    process.exit(1);
  }
}

// ── 2. 已有 verify 工具 capability: "testing" → "core" ─────
// 只改紧邻 browser_verify_ 工具名的 capability，不改其他 testing 工具
const capPattern = /capability: "testing",\s*\n\s*schema:\s*\{\s*\n\s*name: "browser_verify_/g;
const capReplacement = 'capability: "core",\n      schema: {\n        name: "browser_verify_';
const beforeCount = (src.match(capPattern) || []).length;
if (beforeCount > 0) {
  src = src.replace(capPattern, capReplacement);
  console.log(`[patch-verify] ② 已修改 ${beforeCount} 个 verify capability: "testing" → "core"。`);
  patched++;
} else {
  console.log('[patch-verify] ② capability 已修补，跳过。');
}

// ── 3. 插入 3 个新工具 + 更新 export ────────────────────────
if (src.includes('verifyTextNotVisible = defineTabTool')) {
  console.log('[patch-verify] ③ 新工具已存在，跳过。');
} else {
  const newToolsCode = `    verifyTextNotVisible = defineTabTool({
      capability: "core",
      schema: {
        name: "browser_verify_text_not_visible",
        title: "Verify text not visible",
        description: "Verify that text is NOT visible on the page",
        inputSchema: z23.object({
          text: z23.string().describe("TEXT to verify is not present on the page")
        }),
        type: "assertion"
      },
      handle: async (tab2, params2, response2) => {
        for (const frame of tab2.page.frames()) {
          const locator2 = frame.getByText(params2.text).filter({ visible: true });
          if (await locator2.count() > 0) {
            response2.addError(\`Text "\${params2.text}" is visible but should not be\`);
            return;
          }
        }
        response2.addCode(\`await expect(page.getByText('\${params2.text.replace(/'/g, "\\\\'")}').filter({ visible: true })).toHaveCount(0);\`);
        response2.addTextResult("Done");
      }
    });
    verifyElementNotVisible = defineTabTool({
      capability: "core",
      schema: {
        name: "browser_verify_element_not_visible",
        title: "Verify element not visible",
        description: "Verify element is NOT visible on the page",
        inputSchema: z23.object({
          role: z23.string().describe('ROLE of the element. Can be found in the snapshot like this: \`- {ROLE} "Accessible Name":\`'),
          accessibleName: z23.string().describe('ACCESSIBLE_NAME of the element. Can be found in the snapshot like this: \`- role "{ACCESSIBLE_NAME}"\`')
        }),
        type: "assertion"
      },
      handle: async (tab2, params2, response2) => {
        for (const frame of tab2.page.frames()) {
          const locator2 = frame.getByRole(params2.role, { name: params2.accessibleName });
          if (await locator2.count() > 0) {
            const resolved = await locator2.normalize();
            response2.addCode(\`await expect(page.\${resolved}).not.toBeVisible();\`);
            response2.addTextResult("Done");
            return;
          }
        }
        response2.addTextResult("Done");
      }
    });
    verifyCount = defineTabTool({
      capability: "core",
      schema: {
        name: "browser_verify_count",
        title: "Verify element count",
        description: "Verify the number of elements matching a text selector",
        inputSchema: z23.object({
          text: z23.string().describe("Text content to match elements against"),
          count: z23.number().describe("Expected count"),
          operator: z23.enum(["equals", "greater_than", "less_than"]).optional().describe("Comparison operator, defaults to equals")
        }),
        type: "assertion"
      },
      handle: async (tab2, params2, response2) => {
        const locator2 = tab2.page.getByText(params2.text);
        const actualCount = await locator2.count();
        const expected = params2.count;
        const op = params2.operator || "equals";
        let pass = false;
        if (op === "equals") pass = actualCount === expected;
        else if (op === "greater_than") pass = actualCount > expected;
        else if (op === "less_than") pass = actualCount < expected;
        if (!pass) {
          response2.addError(\`Expected count \${op} \${expected}, but got \${actualCount}\`);
          return;
        }
        const escapedText = params2.text.replace(/'/g, "\\\\'");
        response2.addCode(\`await expect(page.getByText('\${escapedText}')).toHaveCount(\${expected});\`);
        response2.addTextResult("Done");
      }
    });`;

  // 在 verifyValue 结束和旧 export 之间插入新工具
  const oldExport = `    verify_default = [
      verifyElement,
      verifyText,
      verifyList,
      verifyValue
    ];`;

  const newExport = `    verify_default = [
      verifyElement,
      verifyText,
      verifyList,
      verifyValue,
      verifyTextNotVisible,
      verifyElementNotVisible,
      verifyCount
    ];`;

  // verifyValue 结束标记
  const endMarker = 'response2.addTextResult("Done");\n      }\n    });\n    verify_default = [';
  const endIdx = src.lastIndexOf(endMarker);
  if (endIdx !== -1) {
    const insertAt = endIdx + 'response2.addTextResult("Done");\n      }\n    });\n'.length;
    src = src.substring(0, insertAt) + '\n' + newToolsCode + '\n' + src.substring(insertAt);
    console.log('[patch-verify] ③ 3 个新工具已插入。');
    patched++;
  } else {
    console.error('[patch-verify] ✗ 未找到插入点。');
    process.exit(1);
  }

  // 替换 export 数组
  if (src.includes(oldExport)) {
    src = src.replace(oldExport, newExport);
    console.log('[patch-verify] ④ export 数组已更新。');
    patched++;
  } else if (!src.includes(newExport)) {
    console.error('[patch-verify] ✗ 未找到旧 export 数组。');
    process.exit(1);
  }
}

// ── 写入 ────────────────────────────────────────────────────
fs.writeFileSync(BUNDLE_PATH, src, 'utf-8');
console.log(`[patch-verify] 完成 (${patched} 处修改) → ${BUNDLE_PATH}`);
