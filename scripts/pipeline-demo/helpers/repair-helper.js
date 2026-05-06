/**
 * 定位自愈运行时 —— 脚本回放时 locator 失效，调 LLM 原地修复。
 *
 * 自愈流程:
 *   1. 按 strategies 顺序尝试定位
 *   2. 全部失败 → 截图 + a11y 快照 → POST /repair
 *   3. LLM 返回新定位策略 → 写入 .repair/ 缓存
 *   4. 重试（最多 2 次修复）
 */

const fs = require('fs');
const path = require('path');

const REPAIR_DIR = path.join(process.cwd(), '.repair');
const REPAIR_URL = process.env.WEB_TEST_REPAIR_URL || 'http://127.0.0.1:9876/repair';

// ── YAML cache 读写 ─────────────────────────────────────────
function parseCacheYaml(text) {
  const map = {};
  if (!text) return map;
  let currentIntent = null;
  for (const line of text.split(/\r?\n/)) {
    const intentMatch = line.match(/^\s*-\s*intent:\s*"(.+)"$/);
    if (intentMatch) { currentIntent = intentMatch[1]; map[currentIntent] = {}; continue; }
    if (!currentIntent) continue;
    const primaryMatch = line.match(/^\s*primary:\s*"(.+)"$/);
    if (primaryMatch) { map[currentIntent].primary = primaryMatch[1]; continue; }
    const xpathMatch = line.match(/^\s*xpath:\s*"(.+)"$/);
    if (xpathMatch) { map[currentIntent].xpath = xpathMatch[1]; continue; }
    const fullMatch = line.match(/^\s*fullXPath:\s*"(.+)"$/);
    if (fullMatch) { map[currentIntent].fullXPath = fullMatch[1]; continue; }
  }
  return map;
}

function writeCacheYaml(cacheMap) {
  const entries = [];
  for (const [intent, loc] of Object.entries(cacheMap)) {
    entries.push('    - intent: "' + intent + '"');
    if (loc.primary) entries.push('      primary: "' + String(loc.primary).replace(/"/g, '\\"') + '"');
    if (loc.xpath) entries.push('      xpath: "' + String(loc.xpath).replace(/"/g, '\\"') + '"');
    if (loc.fullXPath) entries.push('      fullXPath: "' + String(loc.fullXPath).replace(/"/g, '\\"') + '"');
  }
  return [
    '# 定位缓存 — 首次 AI 定位后记录 XPath，后续直接复用',
    '# AI-once-XPath-forever 模式',
    '',
    'elements:',
    ...entries,
    '',
  ].join('\n');
}

// ── 调修复端点 ─────────────────────────────────────────────
async function callLLMRepair(params) {
  try {
    const res = await fetch(REPAIR_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.error(`[repair-helper] LLM 修复请求失败: ${e.message}`);
    return null;
  }
}

// ── 页面状态采集 ────────────────────────────────────────────
async function capturePageState(page) {
  const [screenshot, a11ySnapshot] = await Promise.all([
    page.screenshot({ type: 'jpeg', quality: 70 })
      .then((buf) => buf.toString('base64'))
      .catch(() => null),
    page.evaluate(() => {
      try {
        const items = [];
        const all = document.querySelectorAll(
          'input, button, a, select, textarea, [role], [aria-label], [placeholder]'
        );
        all.forEach((el) => {
          const tag = el.tagName || '';
          const id = el.getAttribute('id') || '';
          const ariaLabel = el.getAttribute('aria-label') || '';
          const placeholder = el.getAttribute('placeholder') || '';
          const text = (el.textContent || '').trim().slice(0, 60);
          items.push(
            tag + '[id="' + id + '"][aria-label="' + ariaLabel
            + '"][placeholder="' + placeholder + '"] "' + text + '"'
          );
        });
        return items.join('\n');
      } catch (_) { return '(快照提取失败)'; }
    }).catch(() => '(快照提取失败)'),
  ]);
  return { screenshotB64: screenshot, a11ySnapshot };
}

// ── 修复缓存读写 ────────────────────────────────────────────
function saveRepairToCache(intent, newLocators) {
  try {
    if (!fs.existsSync(REPAIR_DIR)) fs.mkdirSync(REPAIR_DIR, { recursive: true });

    const jsonPath = path.join(REPAIR_DIR, 'locator-repairs.json');
    let cache = {};
    if (fs.existsSync(jsonPath)) {
      cache = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    }
    cache[intent] = { ...newLocators, repairedAt: Date.now() };
    fs.writeFileSync(jsonPath, JSON.stringify(cache, null, 2), 'utf-8');

    const yamlPath = path.join(REPAIR_DIR, 'cache.yaml');
    fs.writeFileSync(yamlPath, writeCacheYaml(cache), 'utf-8');
  } catch (_) { /* ignore */ }
}

function loadRepairFromCache(intent) {
  try {
    const jsonPath = path.join(REPAIR_DIR, 'locator-repairs.json');
    if (fs.existsSync(jsonPath)) {
      const cache = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      if (cache[intent]) return cache[intent];
    }
    const yamlPath = path.join(REPAIR_DIR, 'cache.yaml');
    if (fs.existsSync(yamlPath)) {
      const yamlCache = parseCacheYaml(fs.readFileSync(yamlPath, 'utf-8'));
      if (yamlCache[intent]) return yamlCache[intent];
    }
    return null;
  } catch (_) { return null; }
}

// ── 字符串 locator → Playwright Locator ──────────────────────
function buildLocatorFromString(page, str) {
  try {
    const match = str.match(/^getBy(\w+)\((['"])(.+?)\2(?:,\s*(\{.*\}))?\)$/);
    if (match) {
      const [, method, , arg1, arg2Raw] = match;
      const args = [arg1];
      if (arg2Raw) {
        try { args.push(JSON.parse(arg2Raw)); } catch (_) { /* ignore */ }
      }
      const methodMap = {
        Role: 'getByRole', Text: 'getByText', Label: 'getByLabel',
        Placeholder: 'getByPlaceholder', AltText: 'getByAltText',
        Title: 'getByTitle', TestId: 'getByTestId',
      };
      const methodName = methodMap[method] || ('getBy' + method);
      if (typeof page[methodName] === 'function') {
        return page[methodName](...args);
      }
    }
    return page.locator(str);
  } catch (_) {
    return page.locator(str);
  }
}

function extractLocatorString(strategy) {
  try { return String(strategy.locator()); } catch (_) { return strategy.type; }
}

function buildStrategiesFromRepair(result, page) {
  if (!result) return [];
  const list = [];
  if (result.primary) {
    list.push({ type: 'semantic', locator: () => buildLocatorFromString(page, result.primary) });
  }
  if (result.xpath) {
    list.push({ type: 'xpath', locator: () => page.locator(result.xpath) });
  }
  if (result.fullXPath) {
    list.push({ type: 'fullXPath', locator: () => page.locator(result.fullXPath) });
  }
  return list;
}

// ── 核心 API ────────────────────────────────────────────────

async function robustLocate(page, opts) {
  const { intent, strategies, action, timeout = 5000 } = opts;
  const maxRetries = 2;
  let repairResult = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let candidates;

    if (attempt === 0) {
      const cached = loadRepairFromCache(intent);
      if (cached) {
        candidates = buildStrategiesFromRepair(cached, page);
        candidates.push(...strategies);
      } else {
        candidates = strategies;
      }
    } else {
      candidates = buildStrategiesFromRepair(repairResult, page);
    }

    if (!candidates || candidates.length === 0) {
      throw new Error(`[robustLocate] 元素 "${intent}" 无可用定位策略`);
    }

    for (const { locator: buildLoc } of candidates) {
      try {
        const loc = buildLoc();
        await loc.waitFor({ state: 'visible', timeout });
        await action(loc);
        return; // 成功
      } catch (e) {
        if (e?.message && /Timeout|waiting for|locator.*not found/i.test(e.message)) {
          continue; // 尝试下一个策略
        }
        throw e; // 非定位失败错误，向外抛出
      }
    }

    if (attempt >= maxRetries) {
      throw new Error(
        `[robustLocate] 元素 "${intent}" 定位失败（${maxRetries + 1} 次尝试均无效）`
      );
    }

    console.warn(
      `[repair] 元素 "${intent}" 全部策略失效，触发 LLM 修复（第${attempt + 1}次）...`
    );

    const { screenshotB64, a11ySnapshot } = await capturePageState(page);

    const oldLocators = {};
    for (const s of strategies) {
      oldLocators[s.type] = extractLocatorString(s);
    }

    repairResult = await callLLMRepair({
      intent,
      oldLocators,
      screenshotB64,
      a11ySnapshot,
      retryCount: attempt,
    });

    if (!repairResult) {
      console.warn('[repair] LLM 未返回有效定位，终止自愈');
      break;
    }

    saveRepairToCache(intent, repairResult);
    console.warn(`[repair] 修复成功: primary=${repairResult.primary}`);
  }

  throw new Error(`[robustLocate] 元素 "${intent}" 定位失败，自愈无效`);
}

// ── 重试块 ──────────────────────────────────────────────────
async function retryBlock(page, fn, { maxAttempts = 3, timeout = 5000 } = {}) {
  let lastError = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await Promise.race([
        fn(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('retryBlock timeout')), timeout)
        ),
      ]);
      return;
    } catch (e) {
      lastError = e;
      if (attempt < maxAttempts - 1) {
        console.warn(`[retryBlock] 尝试 ${attempt + 1}/${maxAttempts} 失败, 重试...`);
        await page.waitForTimeout(500);
      }
    }
  }
  throw new Error(`[retryBlock] ${maxAttempts} 次尝试全部失败: ${lastError?.message}`);
}

module.exports = { robustLocate, retryBlock };
