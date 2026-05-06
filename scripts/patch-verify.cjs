/**
 * 修补 playwright-core 的 coreBundle.js，启用并新增断言工具。
 *
 * 做 4 处修改（均幂等，重复运行无副作用）：
 *   1. 变量声明行：追加新变量名
 *   2. 4 个已有 verify 工具：capability: "testing" → "core"
 *   3. 插入新工具定义（从 inject-tools.js 读取）
 *   4. 更新 export 数组
 *
 * 用法: node scripts/patch-verify.cjs [coreBundle.js路径]
 *
 * 防覆盖：在 playwright-mcp 根 package.json 配置:
 *   "scripts": { "postinstall": "node scripts/patch-verify.cjs" }
 */

const fs = require('fs');
const path = require('path');

const BUNDLE_PATH = process.argv[2] || (
  fs.existsSync(path.join(__dirname, '..', 'packages', 'playwright-mcp', 'node_modules', 'playwright-core', 'lib', 'coreBundle.js'))
    ? path.join(__dirname, '..', 'packages', 'playwright-mcp', 'node_modules', 'playwright-core', 'lib', 'coreBundle.js')
    : path.join(__dirname, '..', 'node_modules', 'playwright-core', 'lib', 'coreBundle.js')
);
const INJECT_PATH = path.join(__dirname, 'inject-tools.js');

if (!fs.existsSync(BUNDLE_PATH)) {
  console.error('[patch-verify] 文件不存在: ' + BUNDLE_PATH);
  process.exit(1);
}
if (!fs.existsSync(INJECT_PATH)) {
  console.error('[patch-verify] 注入文件不存在: ' + INJECT_PATH);
  process.exit(1);
}

// 读取注入代码
const NEW_TOOLS = fs.readFileSync(INJECT_PATH, 'utf-8');

let src = fs.readFileSync(BUNDLE_PATH, 'utf-8');
let patched = 0;

// ── 1. 变量声明 ────────────────────────────────────────────────────
const ORIG = 'var z23, verifyElement, verifyText, verifyList, verifyValue, verify_default;';
const FULL = 'var z23, verifyTextVisible, verifyTextNotVisible, verifyPageURL, verifyElement, verifyValue, verifyList, verifyText, verifyCount, verifyTextContent, verifyState, verifyAttribute, verifyCSS, verify_default;';

const OLD_PATCH_MARKERS = [
  'verifyTextNotVisible, verifyElementNotVisible, verifyCount',
  'verifyTextContent, verifyState, verifyAttribute',
  'verifyClass, verifyURL, verifyCSS',
];

const isOldPatch = OLD_PATCH_MARKERS.some(m => src.includes(m));

if (src.includes('verifyTextVisible, verifyTextNotVisible, verifyPageURL')) {
  console.log('[patch-verify] ① 变量声明已是最新，跳过。');
} else if (isOldPatch) {
  console.error('[patch-verify] ✗ 检测到旧版补丁，无法增量升级。');
  console.error('[patch-verify]   请运行: npm install playwright-core@latest  获取干净 bundle 后重试。');
  process.exit(1);
} else if (src.includes(ORIG)) {
  src = src.replace(ORIG, FULL);
  console.log('[patch-verify] ① 变量声明已更新。');
  patched++;
} else {
  console.error('[patch-verify] ✗ 未找到 var 声明行，可能 bundle 格式已变。');
  process.exit(1);
}

// ── 2. capability: "testing" → "core" ──────────────────────────────
const capPattern = /capability: "testing",\s*\n\s*schema:\s*\{\s*\n\s*name: "browser_verify_/g;
const capReplacement = 'capability: "core",\n      schema: {\n        name: "browser_verify_';
const beforeCount = (src.match(capPattern) || []).length;
if (beforeCount > 0) {
  src = src.replace(capPattern, capReplacement);
  console.log('[patch-verify] ② 已修改 ' + beforeCount + ' 个 verify capability: "testing" → "core"。');
  patched++;
} else {
  console.log('[patch-verify] ② capability 已修补，跳过。');
}

// ── 3. 插入新工具 ──────────────────────────────────────────────────
const EXPORT_4 = '    verify_default = [\n      verifyElement,\n      verifyText,\n      verifyList,\n      verifyValue\n    ];';

const EXPORT_NEW = '    verify_default = [\n      verifyTextVisible,\n      verifyTextNotVisible,\n      verifyPageURL,\n      verifyElement,\n      verifyValue,\n      verifyList,\n      verifyCount,\n      verifyTextContent,\n      verifyState,\n      verifyAttribute,\n      verifyCSS\n    ];';

// 检测是否已注入
const hasRobustLocate = src.includes('async function buildRobustLocateBlock');
const hasExtractXPath = src.includes('async function extractXPath');
const hasVisibleState = src.includes('"visible"]).describe("Expected state of the element")');
if (src.includes('verifyTextVisible = defineTabTool')) {
  const hasVerifyTextXPath = src.includes('response2.addTextResult("Done\\n" + xpathData2);');
  if (hasRobustLocate || !hasExtractXPath || !hasVisibleState || !hasVerifyTextXPath) {
    // 旧 robustLocate 版本 或 缺少 visible 状态，用 inject-tools.js 覆盖
    const oldStart = src.indexOf('async function buildRobustLocateBlock');
    const actualStart = oldStart !== -1 ? src.lastIndexOf('\n', oldStart) : src.indexOf('\nverifyTextVisible = defineTabTool');
    const oldEnd = src.indexOf('    verify_default = [');
    if (actualStart !== -1 && oldEnd !== -1 && actualStart < oldEnd) {
      src = src.slice(0, actualStart) + '\n' + NEW_TOOLS + '\n' + src.slice(oldEnd);
      const reason = hasRobustLocate ? '旧 robustLocate 版本' : !hasExtractXPath ? '缺少 extractXPath' : '缺少 visible 状态';
      console.log('[patch-verify] ③ ' + reason + '，已覆盖升级（从 inject-tools.js）。');
      patched++;
    } else {
      console.log('[patch-verify] ③ 无法定位旧工具区域，跳过。');
    }
  } else {
    console.log('[patch-verify] ③ 新工具已是最新，跳过。');
  }
} else {
  // 全新安装：在最后一个原始 verify 工具和 verify_default 之间注入
  const marker = 'response2.addTextResult("Done");\n      }\n    });\n    verify_default = [';
  const endIdx = src.lastIndexOf(marker);
  if (endIdx !== -1) {
    const insertAt = endIdx + 'response2.addTextResult("Done");\n      }\n    });\n'.length;
    src = src.substring(0, insertAt) + NEW_TOOLS + '\n' + src.substring(insertAt);
    console.log('[patch-verify] ③ 新工具已注入（从 inject-tools.js）。');
    patched++;
  } else {
    console.error('[patch-verify] ✗ 未找到插入点，可能 bundle 格式已变。');
    process.exit(1);
  }
}

// ── 4. 更新 export ──────────────────────────────────────────────
if (src.includes(EXPORT_NEW)) {
  console.log('[patch-verify] ④ export 数组已是最新，跳过。');
} else if (src.includes(EXPORT_4)) {
  src = src.replace(EXPORT_4, EXPORT_NEW);
  console.log('[patch-verify] ④ export 数组已更新（4→11 工具）。');
  patched++;
} else {
  console.error('[patch-verify] ✗ 未找到 export 数组。');
  process.exit(1);
}

// ── 5. 为 action 工具注入 XPath 提取 ──────────────────────────────────
// action 工具 (click, hover, selectOption, check, uncheck, type, drag) 在原始 bundle 中
// 使用 refLocator 但未调用 extractXPath。本步骤注入 XPath 提取和 addTextResult 输出。
// 使用运行时字符串构建避免 JSON/EOL 转义问题。

(function() {
  const BT = String.fromCharCode(96); // backtick
  const DS = String.fromCharCode(36); // dollar sign
  const BS = String.fromCharCode(92); // backslash
  const DQ = String.fromCharCode(34); // double quote
  const NL = '\n';

  // 通用前缀/后缀片段
  const REFLOC = '        const { locator: locator2, resolved } = await tab2.refLocator(params2);';
  const XPATH = '        const xpathData2 = await extractXPath(locator2);';
  const ADDTEXT = '        response2.addTextResult(' + DQ + 'Done' + BS + 'n' + DQ + ' + xpathData2);';
  const REFLOC_DRAG = '        const [start3, end] = await tab2.refLocators([';
  const XPATH_DRAG = '        const xpathData2 = await extractXPath(start3.locator);';

  // 幂等检测：已修补的 click 工具特征
  const ALREADY_PATCHED = REFLOC + NL + XPATH + NL + '        const options = {' + NL + '          button:';
  if (src.includes(ALREADY_PATCHED)) {
    console.log('[patch-verify] ⑤ action 工具 XPath 已注入，跳过。');
    return;
  }

  function chk(name, search, replace) {
    if (src.includes(search)) {
      src = src.replace(search, replace);
      return true;
    }
    console.error('[patch-verify] ✗ ⑤ ' + name + ' 未找到匹配模式。');
    return false;
  }

  var ok = true;

  // ── click ──
  ok = chk('click-extract',
    REFLOC + NL + '        const options = {' + NL + '          button:',
    REFLOC + NL + XPATH + NL + '        const options = {' + NL + '          button:'
  ) && ok;
  ok = chk('click-result',
    '        });' + NL + '      }' + NL + '    });' + NL + '    drag = defineTabTool({',
    '        });' + NL + ADDTEXT + NL + '      }' + NL + '    });' + NL + '    drag = defineTabTool({'
  ) && ok;

  // ── drag ──
  ok = chk('drag-extract',
    REFLOC_DRAG + NL + '          { ref: params2.startRef, selector: params2.startSelector, element: params2.startElement },' + NL + '          { ref: params2.endRef, selector: params2.endSelector, element: params2.endElement }' + NL + '        ]);' + NL + '        await tab2.waitForCompletion',
    REFLOC_DRAG + NL + '          { ref: params2.startRef, selector: params2.startSelector, element: params2.startElement },' + NL + '          { ref: params2.endRef, selector: params2.endSelector, element: params2.endElement }' + NL + '        ]);' + NL + XPATH_DRAG + NL + '        await tab2.waitForCompletion'
  ) && ok;
  ok = chk('drag-result',
    '        response2.addCode(' + BT + 'await page.' + DS + '{start3.resolved}.dragTo(page.' + DS + '{end.resolved});' + BT + ');' + NL + '      }' + NL + '    });' + NL + '    hover',
    '        response2.addCode(' + BT + 'await page.' + DS + '{start3.resolved}.dragTo(page.' + DS + '{end.resolved});' + BT + ');' + NL + ADDTEXT + NL + '      }' + NL + '    });' + NL + '    hover'
  ) && ok;

  // ── hover ──
  ok = chk('hover-extract',
    REFLOC + NL + '        response2.addCode(' + BT + 'await page.' + DS + '{resolved}.hover();' + BT + ');',
    REFLOC + NL + XPATH + NL + '        response2.addCode(' + BT + 'await page.' + DS + '{resolved}.hover();' + BT + ');'
  ) && ok;
  ok = chk('hover-result',
    '        await locator2.hover(tab2.actionTimeoutOptions);' + NL + '      }' + NL + '    });' + NL + '    selectOptionSchema',
    '        await locator2.hover(tab2.actionTimeoutOptions);' + NL + ADDTEXT + NL + '      }' + NL + '    });' + NL + '    selectOptionSchema'
  ) && ok;

  // ── selectOption ──
  ok = chk('selectOption-extract',
    REFLOC + NL + '        response2.addCode(' + BT + 'await page.' + DS + '{resolved}.selectOption',
    REFLOC + NL + XPATH + NL + '        response2.addCode(' + BT + 'await page.' + DS + '{resolved}.selectOption'
  ) && ok;
  ok = chk('selectOption-result',
    '        await locator2.selectOption(params2.values, tab2.actionTimeoutOptions);' + NL + '      }' + NL + '    });' + NL + '    pickLocator',
    '        await locator2.selectOption(params2.values, tab2.actionTimeoutOptions);' + NL + ADDTEXT + NL + '      }' + NL + '    });' + NL + '    pickLocator'
  ) && ok;

  // ── check ──
  ok = chk('check-extract',
    REFLOC + NL + '        response2.addCode(' + BT + 'await page.' + DS + '{resolved}.check();' + BT + ');',
    REFLOC + NL + XPATH + NL + '        response2.addCode(' + BT + 'await page.' + DS + '{resolved}.check();' + BT + ');'
  ) && ok;
  ok = chk('check-result',
    '        await locator2.check(tab2.actionTimeoutOptions);' + NL + '      }' + NL + '    });' + NL + '    uncheck',
    '        await locator2.check(tab2.actionTimeoutOptions);' + NL + ADDTEXT + NL + '      }' + NL + '    });' + NL + '    uncheck'
  ) && ok;

  // ── uncheck ──
  ok = chk('uncheck-extract',
    REFLOC + NL + '        response2.addCode(' + BT + 'await page.' + DS + '{resolved}.uncheck();' + BT + ');',
    REFLOC + NL + XPATH + NL + '        response2.addCode(' + BT + 'await page.' + DS + '{resolved}.uncheck();' + BT + ');'
  ) && ok;
  ok = chk('uncheck-result',
    '        await locator2.uncheck(tab2.actionTimeoutOptions);' + NL + '      }' + NL + '    });' + NL + '    snapshot_default',
    '        await locator2.uncheck(tab2.actionTimeoutOptions);' + NL + ADDTEXT + NL + '      }' + NL + '    });' + NL + '    snapshot_default'
  ) && ok;

  // ── type ──
  ok = chk('type-extract',
    REFLOC + NL + '        const secret = tab2.context.lookupSecret(params2.text);',
    REFLOC + NL + XPATH + NL + '        const secret = tab2.context.lookupSecret(params2.text);'
  ) && ok;
  ok = chk('type-result',
    '          await action();' + NL + '      }' + NL + '    });' + NL + '    keydown = defineTabTool({',
    '          await action();' + NL + ADDTEXT + NL + '      }' + NL + '    });' + NL + '    keydown = defineTabTool({'
  ) && ok;

  if (ok) {
    patched++;
    console.log('[patch-verify] ⑤ action 工具 XPath 已注入 (7 个工具)。');
  } else {
    console.error('[patch-verify] ✗ ⑤ 部分 action 工具匹配失败，可能 bundle 格式已变。');
  }
})();

// ── 5.5 在 snapshot __esm 模块内部注入 extractXPath 函数定义 ───────────
// action 工具 (click, hover, ...) 位于 snapshot = __esm({...}) 模块内部，
// 无法访问模块外定义的 extractXPath。需在模块内部注入一份定义。
(function() {
  const MARKER = '\n    snapshot = defineTabTool({';
  const XPFN_MARKER = 'async function extractXPath(locator2)';
  // 检测是否已注入（在 snapshot __esm 模块内部）
  const snapshotIdx = src.indexOf('snapshot = __esm({');
  const moduleStart = src.indexOf('{', src.indexOf('{', snapshotIdx) + 1);
  let depth = 1, moduleEnd = -1;
  for (let i = moduleStart + 1; i < src.length; i++) {
    if (src[i] === '{') depth++;
    if (src[i] === '}') { depth--; if (depth === 0) { moduleEnd = i; break; } }
  }
  const insideModule = src.slice(moduleStart, moduleEnd);
  if (insideModule.includes(XPFN_MARKER)) {
    console.log('[patch-verify] ⑤.5 snapshot 模块内 extractXPath 已注入，跳过。');
    return;
  }

  const xpFnSrc = '\n' +
'    async function extractXPath(locator2) {\n' +
'      try {\n' +
'        return await locator2.evaluate((el) => {\n' +
'          function relXPath(e) {\n' +
'            if (e.id) return \'//*[@id="\' + e.id + \'"]\';\n' +
'            var tag = e.tagName.toLowerCase();\n' +
'            var ariaLabel = e.getAttribute(\'aria-label\');\n' +
'            if (ariaLabel) return \'//\' + tag + \'[@aria-label="\' + ariaLabel + \'"]\';\n' +
'            var placeholder = e.getAttribute(\'placeholder\');\n' +
'            if (placeholder) return \'//\' + tag + \'[@placeholder="\' + placeholder + \'"]\';\n' +
'            var text = (e.textContent || \'\').trim().slice(0, 40).replace(/"/g, \'\\\\"\');\n' +
'            if (text && /^(button|a|label|span|h[1-6]|p|td|th|li|option|legend|caption)$/.test(tag)) {\n' +
'              return \'//\' + tag + \'[contains(text(),"\' + text + \'")]\';\n' +
'            }\n' +
'            var idx = 1;\n' +
'            var s = e.previousElementSibling;\n' +
'            while (s) { if (s.tagName === e.tagName) idx++; s = s.previousElementSibling; }\n' +
'            var parent = e.parentElement;\n' +
'            if (!parent || parent === document.body) return \'//\' + tag + \'[\' + idx + \']\';\n' +
'            return relXPath(parent) + \'/\' + tag + \'[\' + idx + \']\';\n' +
'          }\n' +
'          function absXPath(e) {\n' +
'            var parts = [];\n' +
'            var cur = e;\n' +
'            while (cur && cur.nodeType === Node.ELEMENT_NODE) {\n' +
'              var tag = cur.tagName.toLowerCase();\n' +
'              var idx = 1;\n' +
'              var s = cur.previousElementSibling;\n' +
'              while (s) { if (s.tagName === cur.tagName) idx++; s = s.previousElementSibling; }\n' +
'              parts.unshift(idx > 1 ? tag + \'[\' + idx + \']\' : tag);\n' +
'              cur = cur.parentElement;\n' +
'            }\n' +
'            return \'/\' + parts.join(\'/\');\n' +
'          }\n' +
'          return JSON.stringify({ xpath: relXPath(el), fullXPath: absXPath(el) });\n' +
'        });\n' +
'      } catch (e) {\n' +
'        return JSON.stringify({ xpath: \'\', fullXPath: \'\' });\n' +
'      }\n' +
'    }\n';

  if (src.includes(MARKER)) {
    src = src.replace(MARKER, xpFnSrc + MARKER);
    patched++;
    console.log('[patch-verify] ⑤.5 snapshot 模块内 extractXPath 已注入。');
  } else {
    console.error('[patch-verify] ✗ ⑤.5 未找到 snapshot 模块插入点。');
  }
})();
fs.writeFileSync(BUNDLE_PATH, src, 'utf-8');
console.log('[patch-verify] 完成 (' + patched + ' 处修改) → ' + BUNDLE_PATH);
