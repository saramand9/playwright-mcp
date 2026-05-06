// 注入到 coreBundle.js 的断言工具代码
// 此文件被 patch-verify.cjs 读取并注入，不用处理多层转义
// 输出标准 Playwright 代码，robustLocate 翻译由外部 LLM 完成
// XPath 数据通过 addTextResult 作为元数据随带输出

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

async function extractXPath(locator2) {
  try {
    return await locator2.evaluate((el) => {
      function relXPath(e) {
        if (e.id) return '//*[@id="' + e.id + '"]';
        var tag = e.tagName.toLowerCase();
        var ariaLabel = e.getAttribute('aria-label');
        if (ariaLabel) return '//' + tag + '[@aria-label="' + ariaLabel + '"]';
        var placeholder = e.getAttribute('placeholder');
        if (placeholder) return '//' + tag + '[@placeholder="' + placeholder + '"]';
        var text = (e.textContent || '').trim().slice(0, 40).replace(/"/g, '\\"');
        if (text && /^(button|a|label|span|h[1-6]|p|td|th|li|option|legend|caption)$/.test(tag)) {
          return '//' + tag + '[contains(text(),"' + text + '")]';
        }
        var idx = 1;
        var s = e.previousElementSibling;
        while (s) { if (s.tagName === e.tagName) idx++; s = s.previousElementSibling; }
        var parent = e.parentElement;
        if (!parent || parent === document.body) return '//' + tag + '[' + idx + ']';
        return relXPath(parent) + '/' + tag + '[' + idx + ']';
      }
      function absXPath(e) {
        var parts = [];
        var cur = e;
        while (cur && cur.nodeType === Node.ELEMENT_NODE) {
          var tag = cur.tagName.toLowerCase();
          var idx = 1;
          var s = cur.previousElementSibling;
          while (s) { if (s.tagName === cur.tagName) idx++; s = s.previousElementSibling; }
          parts.unshift(idx > 1 ? tag + '[' + idx + ']' : tag);
          cur = cur.parentElement;
        }
        return '/' + parts.join('/');
      }
      return JSON.stringify({ xpath: relXPath(el), fullXPath: absXPath(el) });
    });
  } catch (e) {
    return JSON.stringify({ xpath: '', fullXPath: '' });
  }
}

verifyTextVisible = defineTabTool({
  capability: "core",
  schema: {
    name: "browser_verify_text_visible",
    title: "Verify text visible",
    description: "Verify text is visible anywhere on the page",
    inputSchema: z23.object({
      text: z23.string().describe("TEXT to verify. Can be found in the snapshot like this: `- role \"Accessible Name\": {TEXT}` or like this: `- text: {TEXT}`")
    }),
    type: "assertion"
  },
  handle: async (tab2, params2, response2) => {
    for (const frame of tab2.page.frames()) {
      const locator2 = frame.getByText(params2.text).filter({ visible: true });
      if (await locator2.count() > 0) {
        const xpathData2 = await extractXPath(locator2.first());
        const resolved = await locator2.normalize();
        response2.addCode("await expect(page." + resolved + ").toBeVisible();");
        response2.addTextResult("Done\n" + xpathData2);
        return;
      }
    }
    response2.addError("Text not found");
  }
});

verifyTextNotVisible = defineTabTool({
  capability: "core",
  schema: {
    name: "browser_verify_text_not_visible",
    title: "Verify text not visible",
    description: "Verify that text is NOT visible anywhere on the page",
    inputSchema: z23.object({
      text: z23.string().describe("TEXT to verify is not present on the page")
    }),
    type: "assertion"
  },
  handle: async (tab2, params2, response2) => {
    for (const frame of tab2.page.frames()) {
      const locator2 = frame.getByText(params2.text).filter({ visible: true });
      if (await locator2.count() > 0) {
        response2.addError("Text \"" + params2.text + "\" is visible but should not be");
        return;
      }
    }
    response2.addCode("await expect(page.getByText('" + params2.text.replace(/'/g, "\\'") + "').filter({ visible: true })).toHaveCount(0);");
    response2.addTextResult("Done");
  }
});

verifyPageURL = defineTabTool({
  capability: "core",
  schema: {
    name: "browser_verify_page_url",
    title: "Verify page URL",
    description: "Verify current page URL matches expected value",
    inputSchema: z23.object({
      expected: z23.string().describe("Expected URL"),
      mode: z23.enum(["equals", "contains"]).optional().describe("Match mode: equals for exact URL match (default), contains for substring")
    }),
    type: "assertion"
  },
  handle: async (tab2, params2, response2) => {
    const url = tab2.page.url();
    const mode = params2.mode || "equals";
    const pass = mode === "equals" ? url === params2.expected : url.includes(params2.expected);
    if (!pass) {
      response2.addError("Expected URL to " + mode + " \"" + params2.expected + "\", but got \"" + url + "\"");
      return;
    }
    if (mode === "contains")
      response2.addCode("await expect(page).toHaveURL(/" + params2.expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "/);");
    else
      response2.addCode("await expect(page).toHaveURL('" + params2.expected.replace(/'/g, "\\'") + "');");
    response2.addTextResult("Done");
  }
});

verifyCount = defineTabTool({
  capability: "core",
  schema: {
    name: "browser_verify_count",
    title: "Verify element count",
    description: "Verify the number of elements matching a locator. Use ref/selector for scoped counting, or text for page-level counting.",
    inputSchema: z23.object({
      text: z23.string().optional().describe("Text content to match elements against (page-level). Omit if using ref/selector."),
      element: z23.string().optional().describe("Human-readable element description when using ref"),
      ref: z23.string().optional().describe("Exact target element reference from the page snapshot. When provided, counts within this element."),
      selector: z23.string().optional().describe("CSS or role selector. When provided, counts matching elements."),
      count: z23.number().describe("Expected count"),
      operator: z23.enum(["equals", "greater_than", "less_than", "greater_than_or_equal", "less_than_or_equal"]).optional().describe("Comparison operator, defaults to equals")
    }),
    type: "assertion"
  },
  handle: async (tab2, params2, response2) => {
    let locator2, code2;
    if (params2.ref || params2.selector) {
      const result = await tab2.refLocator({ ref: params2.ref, selector: params2.selector, element: params2.element });
      locator2 = result.locator;
      code2 = "page." + result.resolved;
      const actualCount = await locator2.count();
      if (!checkCount(actualCount, params2.count, params2.operator)) {
        response2.addError("Expected count " + (params2.operator || "equals") + " " + params2.count + ", but got " + actualCount);
        return;
      }
      const xpathData2 = await extractXPath(locator2);
      response2.addCode("await expect(" + code2 + ").toHaveCount(" + params2.count + ");");
      response2.addTextResult("Done\n" + xpathData2);
      return;
    } else if (params2.text) {
      locator2 = tab2.page.getByText(params2.text);
      code2 = "page.getByText('" + params2.text.replace(/'/g, "\\'") + "')";
    } else {
      response2.addError("Must provide either text (page-level) or ref/selector (scoped)");
      return;
    }
    const actualCount = await locator2.count();
    if (!checkCount(actualCount, params2.count, params2.operator)) {
      response2.addError("Expected count " + (params2.operator || "equals") + " " + params2.count + ", but got " + actualCount);
      return;
    }
    response2.addCode("await expect(" + code2 + ").toHaveCount(" + params2.count + ");");
    response2.addTextResult("Done");
  }
});

verifyTextContent = defineTabTool({
  capability: "core",
  schema: {
    name: "browser_verify_text",
    title: "Verify text content",
    description: "Verify element text content using Playwright's toHaveText/toContainText (with whitespace normalization)",
    inputSchema: z23.object({
      element: z23.string().describe("Human-readable element description"),
      ref: z23.string().describe("Exact target element reference from the page snapshot"),
      selector: z23.string().optional().describe("CSS or role selector for the target element, when ref is not available"),
      text: z23.string().describe("Expected text value or regex pattern"),
      mode: z23.enum(["equals", "contains", "regex"]).optional().describe("Match mode: equals for exact match (default), contains for substring, regex for pattern")
    }),
    type: "assertion"
  },
  handle: async (tab2, params2, response2) => {
    const { locator: locator2, resolved: resolved2 } = await tab2.refLocator({ ref: params2.ref, selector: params2.selector, element: params2.element });
    const locatorSource2 = "page." + resolved2;
    const xpathData2 = await extractXPath(locator2);
    const mode = params2.mode || "equals";
    if (mode === "regex") {
      const pattern = new RegExp(params2.text);
      const rawText = await locator2.textContent(tab2.expectTimeoutOptions) || "";
      if (!pattern.test(rawText)) {
        response2.addError("Expected text to match /" + params2.text + "/, but got \"" + rawText.trim() + "\"");
        return;
      }
      response2.addCode("await expect(" + locatorSource2 + ").toHaveText(/" + params2.text.replace(/\//g, '\\/') + "/);");
    } else if (mode === "equals") {
      const rawText = await locator2.textContent(tab2.expectTimeoutOptions) || "";
      const normalized = rawText.replace(/\s+/g, " ").trim();
      if (normalized !== params2.text) {
        response2.addError("Expected text \"" + params2.text + "\", but got \"" + normalized + "\"");
        return;
      }
      response2.addCode("await expect(" + locatorSource2 + ").toHaveText('" + params2.text.replace(/'/g, "\\'") + "');");
    } else {
      const rawText = await locator2.textContent(tab2.expectTimeoutOptions) || "";
      if (!rawText.includes(params2.text)) {
        response2.addError("Expected text to contain \"" + params2.text + "\", but got \"" + rawText.trim() + "\"");
        return;
      }
      response2.addCode("await expect(" + locatorSource2 + ").toContainText('" + params2.text.replace(/'/g, "\\'") + "');");
    }
    response2.addTextResult("Done\n" + xpathData2);
  }
});

verifyState = defineTabTool({
  capability: "core",
  schema: {
    name: "browser_verify_state",
    title: "Verify element state",
    description: "Verify element state: disabled, enabled, editable, focused, empty, hidden, inDOM, attached, hasClass, visible",
    inputSchema: z23.object({
      element: z23.string().describe("Human-readable element description"),
      ref: z23.string().describe("Exact target element reference from the page snapshot"),
      selector: z23.string().optional().describe("CSS or role selector for the target element, when ref is not available"),
      state: z23.enum(["disabled", "enabled", "editable", "focused", "empty", "hidden", "inDOM", "attached", "hasClass", "visible"]).describe("Expected state of the element"),
      classExpected: z23.string().optional().describe("Expected CSS class(es) when state is hasClass. Space-separated.")
    }),
    type: "assertion"
  },
  handle: async (tab2, params2, response2) => {
    const { locator: locator2, resolved: resolved2 } = await tab2.refLocator({ ref: params2.ref, selector: params2.selector, element: params2.element });
    const locatorSource2 = "page." + resolved2;
    const xpathData2 = await extractXPath(locator2);
    switch (params2.state) {
      case "disabled": {
        const v = await locator2.isDisabled(tab2.expectTimeoutOptions);
        if (!v) { response2.addError("Element is not disabled"); return; }
        response2.addCode("await expect(" + locatorSource2 + ").toBeDisabled();");
        break;
      }
      case "enabled": {
        const v = await locator2.isEnabled(tab2.expectTimeoutOptions);
        if (!v) { response2.addError("Element is not enabled"); return; }
        response2.addCode("await expect(" + locatorSource2 + ").toBeEnabled();");
        break;
      }
      case "editable": {
        const v = await locator2.isEditable(tab2.expectTimeoutOptions);
        if (!v) { response2.addError("Element is not editable"); return; }
        response2.addCode("await expect(" + locatorSource2 + ").toBeEditable();");
        break;
      }
      case "focused": {
        const v = await locator2.evaluate(el => el === document.activeElement);
        if (!v) { response2.addError("Element is not focused"); return; }
        response2.addCode("await expect(" + locatorSource2 + ").toBeFocused();");
        break;
      }
      case "empty": {
        const text2 = await locator2.innerText();
        if (text2.trim() !== "") { response2.addError("Element is not empty: \"" + text2 + "\""); return; }
        response2.addCode("await expect(" + locatorSource2 + ").toBeEmpty();");
        break;
      }
      case "hidden": {
        const v = await locator2.isHidden(tab2.expectTimeoutOptions);
        if (!v) { response2.addError("Element is not hidden"); return; }
        response2.addCode("await expect(" + locatorSource2 + ").toBeHidden();");
        break;
      }
      case "inDOM": {
        const c = await locator2.count();
        if (c === 0) { response2.addError("Element does not exist in DOM"); return; }
        response2.addCode("await expect(" + locatorSource2 + ").not.toHaveCount(0);");
        break;
      }
      case "attached": {
        const v = await locator2.evaluate(el => el.isConnected);
        if (!v) { response2.addError("Element is not attached to document"); return; }
        response2.addCode("await expect(" + locatorSource2 + ").toBeAttached();");
        break;
      }
      case "visible": {
        const v = await locator2.isVisible(tab2.expectTimeoutOptions);
        if (!v) { response2.addError("Element is not visible"); return; }
        response2.addCode("await expect(" + locatorSource2 + ").toBeVisible();");
        break;
      }
      case "hasClass": {
        if (!params2.classExpected) {
          response2.addError("state hasClass requires classExpected parameter");
          return;
        }
        const expectedClasses = params2.classExpected.split(/\s+/).filter(Boolean).sort();
        const actualClasses = (await locator2.evaluate(el => el.className)).split(/\s+/).filter(Boolean).sort();
        const missing = expectedClasses.filter(c => !actualClasses.includes(c));
        const extra = actualClasses.filter(c => !expectedClasses.includes(c));
        if (missing.length > 0 || extra.length > 0) {
          response2.addError("Expected classes \"" + params2.classExpected + "\", but got \"" + actualClasses.join(" ") + "\"");
          return;
        }
        response2.addCode("await expect(" + locatorSource2 + ").toHaveClass('" + params2.classExpected.replace(/'/g, "\\'") + "');");
        break;
      }
    }
    response2.addTextResult("Done\n" + xpathData2);
  }
});

verifyAttribute = defineTabTool({
  capability: "core",
  schema: {
    name: "browser_verify_attribute",
    title: "Verify attribute",
    description: "Verify an element attribute value",
    inputSchema: z23.object({
      element: z23.string().describe("Human-readable element description"),
      ref: z23.string().describe("Exact target element reference from the page snapshot"),
      selector: z23.string().optional().describe("CSS or role selector for the target element, when ref is not available"),
      name: z23.string().describe("Attribute name (e.g. data-status, aria-expanded, href)"),
      expected: z23.string().describe("Expected attribute value")
    }),
    type: "assertion"
  },
  handle: async (tab2, params2, response2) => {
    const { locator: locator2, resolved: resolved2 } = await tab2.refLocator({ ref: params2.ref, selector: params2.selector, element: params2.element });
    const locatorSource2 = "page." + resolved2;
    const xpathData2 = await extractXPath(locator2);
    const value2 = await locator2.getAttribute(params2.name, tab2.expectTimeoutOptions);
    if (value2 !== params2.expected) {
      response2.addError("Expected attribute \"" + params2.name + "\" to be \"" + params2.expected + "\", but got \"" + value2 + "\"");
      return;
    }
    response2.addCode("await expect(" + locatorSource2 + ").toHaveAttribute('" + params2.name.replace(/'/g, "\\'") + "', '" + params2.expected.replace(/'/g, "\\'") + "');");
    response2.addTextResult("Done\n" + xpathData2);
  }
});

verifyCSS = defineTabTool({
  capability: "core",
  schema: {
    name: "browser_verify_css",
    title: "Verify CSS property",
    description: "Verify computed CSS property value of an element",
    inputSchema: z23.object({
      element: z23.string().describe("Human-readable element description"),
      ref: z23.string().describe("Exact target element reference from the page snapshot"),
      selector: z23.string().optional().describe("CSS or role selector for the target element, when ref is not available"),
      property: z23.string().describe("CSS property name (e.g. color, font-size, display)"),
      expected: z23.string().describe("Expected computed value")
    }),
    type: "assertion"
  },
  handle: async (tab2, params2, response2) => {
    const { locator: locator2, resolved: resolved2 } = await tab2.refLocator({ ref: params2.ref, selector: params2.selector, element: params2.element });
    const locatorSource2 = "page." + resolved2;
    const xpathData2 = await extractXPath(locator2);
    const value2 = await locator2.evaluate((el, prop) => {
      return window.getComputedStyle(el).getPropertyValue(prop);
    }, params2.property);
    if (value2 !== params2.expected) {
      response2.addError("Expected CSS \"" + params2.property + "\" to be \"" + params2.expected + "\", but got \"" + value2 + "\"");
      return;
    }
    response2.addCode("await expect(" + locatorSource2 + ").toHaveCSS('" + params2.property.replace(/'/g, "\\'") + "', '" + params2.expected.replace(/'/g, "\\'") + "');");
    response2.addTextResult("Done\n" + xpathData2);
  }
});
