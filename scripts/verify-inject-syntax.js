// 验证注入代码语法是否正确。此文件不执行，仅做语法检查。
// 运行的 bundle 上下文: 这些代码在一个模块作用域内执行，z23/defineTabTool/tab2.refLocator 等已定义。

async function buildRobustLocateBlock(locator2, resolved2, elementDesc, actionCode) {
  let xpath = '';
  let fullXPath = '';
  try {
    const result = await locator2.evaluate((el) => {
      function relXPath(e) {
        if (e.id) return `//*[@id="${e.id}"]`;
        const tag = e.tagName.toLowerCase();
        const ariaLabel = e.getAttribute('aria-label');
        if (ariaLabel) return `//${tag}[@aria-label="${ariaLabel}"]`;
        const placeholder = e.getAttribute('placeholder');
        if (placeholder) return `//${tag}[@placeholder="${placeholder}"]`;
        const text = (e.textContent || '').trim().slice(0, 40).replace(/"/g, '\\"');
        if (text && /^(button|a|label|span|h[1-6]|p|td|th|li|option|legend|caption)$/.test(tag)) {
          return `//${tag}[contains(text(),"${text}")]`;
        }
        let idx = 1;
        let s = e.previousElementSibling;
        while (s) { if (s.tagName === e.tagName) idx++; s = s.previousElementSibling; }
        const parent = e.parentElement;
        if (!parent || parent === document.body) return `//${tag}[${idx}]`;
        return `${relXPath(parent)}/${tag}[${idx}]`;
      }
      function absXPath(e) {
        const parts = [];
        let cur = e;
        while (cur && cur.nodeType === Node.ELEMENT_NODE) {
          const tag = cur.tagName.toLowerCase();
          let idx = 1;
          let s = cur.previousElementSibling;
          while (s) { if (s.tagName === cur.tagName) idx++; s = s.previousElementSibling; }
          parts.unshift(idx > 1 ? `${tag}[${idx}]` : tag);
          cur = cur.parentElement;
        }
        return '/' + parts.join('/');
      }
      return { xpath: relXPath(e), fullXPath: absXPath(e) };
    });
    xpath = result.xpath;
    fullXPath = result.fullXPath;
  } catch (_) {
  }
  const strategies = [];
  strategies.push(`{ type: 'semantic', locator: () => page.${resolved2} }`);
  if (xpath) strategies.push(`{ type: 'xpath', locator: () => page.locator('${xpath.replace(/'/g, "\\'")}') }`);
  if (fullXPath) strategies.push(`{ type: 'fullXPath', locator: () => page.locator('${fullXPath.replace(/'/g, "\\'")}') }`);
  return [
    `await robustLocate(page, {`,
    `  intent: '${elementDesc.replace(/'/g, "\\'")}',`,
    `  strategies: [`,
    `    ${strategies.join(',\n    ')}`,
    `  ],`,
    `  action: (loc) => ${actionCode},`,
    `  timeout: 5000,`,
    `});`
  ].join('\n');
}

function checkCount(actual, expected, op) {
  switch (op || "equals") {
    case "equals": return actual === expected;
    case "greater_than": return actual > expected;
    case "less_than": return actual < expected;
    case "greater_than_or_equal": return actual >= expected;
    case "less_than_or_equal": return actual <= expected;
    default: return false;
  }
}

// verifyTextVisible, verifyTextNotVisible, verifyPageURL (page-level tools unchanged)

verifyTextVisible = defineTabTool({
  capability: "core",
  schema: {
    name: "browser_verify_text_visible",
    title: "Verify text visible",
    description: "Verify text is visible anywhere on the page",
    inputSchema: z23.object({ text: z23.string() }),
    type: "assertion"
  },
  handle: async (tab2, params2, response2) => {
    response2.addTextResult("stub");
  }
});

verifyTextNotVisible = defineTabTool({
  capability: "core",
  schema: { name: "browser_verify_text_not_visible", title: "Verify text not visible", description: "Stub", inputSchema: z23.object({ text: z23.string() }), type: "assertion" },
  handle: async (tab2, params2, response2) => { response2.addTextResult("stub"); }
});

verifyPageURL = defineTabTool({
  capability: "core",
  schema: { name: "browser_verify_page_url", title: "Verify page URL", description: "Stub", inputSchema: z23.object({ expected: z23.string() }), type: "assertion" },
  handle: async (tab2, params2, response2) => { response2.addTextResult("stub"); }
});

console.log("Syntax OK");
