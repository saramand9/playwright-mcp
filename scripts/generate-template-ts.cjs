// 生成符合 repair-helper 模板格式的 E2E 测试脚本
const { spawn } = require('child_process');

const CLI = 'D:/ai/ai_case-project/playwright-mcp/packages/playwright-mcp/cli.js';
const URL = 'http://localhost:8080/device-manager.html';

const proc = spawn('node', [CLI, '--headless', '--caps', 'core'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env }
});

let buffer = '';
let msgId = 0;
const pending = new Map();

proc.stdout.on('data', d => {
  buffer += d.toString();
  const lines = buffer.split('\n');
  buffer = lines.pop();
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id && pending.has(msg.id)) pending.get(msg.id)(msg), pending.delete(msg.id);
    } catch(e) {}
  }
});

proc.stderr.on('data', d => {});

function send(method, params) {
  const id = ++msgId;
  proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  return new Promise(resolve => {
    pending.set(id, resolve);
    setTimeout(() => resolve(null), 15000);
  });
}

function resolved(r) {
  const text = (r?.result?.content || []).map(c => c.text).join('\n') || '';
  const m = text.match(/```js\nawait page\.goto\('([^']+)'\);\n```/);
  // Extract the resolved locator from addCode output
  const m2 = text.match(/page\.(getBy\w+\([^)]+\))/);
  return m2 ? m2[1] : null;
}

async function main() {
  await send('initialize', { protocolVersion: '1.0', clientInfo: { name: 'test' }, capabilities: {} });
  await send('tools/call', { name: 'browser_navigate', arguments: { url: URL } });
  const snap = await send('tools/call', { name: 'browser_snapshot', arguments: {} });
  const snapText = snap?.result?.content?.[0]?.text || '';

  // Extract key refs from snapshot
  const appleCheckbox = snapText.match(/checkbox\s+"([^"]*Apple[^"]*)"\s+\[ref=([^\]]+)\]/);
  const btnQuery = snapText.match(/button\s+"查询"\s+\[ref=([^\]]+)\]/);
  const linkHome = snapText.match(/link\s+"🏠 首页"\s+\[ref=([^\]]+)\]/);
  const heading = snapText.match(/generic\s+\[ref=(e3)\]:\s*(.+)/);

  // Get the actual XPath for key elements
  async function getXPath(ref, desc) {
    if (!ref) return { semantic: '', xpath: '', fullXPath: '' };
    // Use verifyState to trigger refLocator and get resolved locator
    const r = await send('tools/call', { name: 'browser_verify_state', arguments: { element: desc, ref: ref[1] || ref, state: 'inDOM' } });
    const text = (r?.result?.content || []).map(c => c.text).join('\n') || '';
    // Extract the resolved locator from the code block
    const m = text.match(/\`page\.([^\`]+)\`/);
    const resolved = m ? m[1] : '';
    return {
      semantic: resolved.includes('getByRole') ? `page.${resolved}` : `page.getByRole('${desc}')`,
      xpath: '',
      fullXPath: '',
      resolved
    };
  }

  console.log('/**');
  console.log(' * 生成方式: MCP Playwright Tools → 快照 + 断言');
  console.log(' * 定位策略: semantic → xpath → fullXPath');
  console.log(' * 自愈机制: 全部策略失效时 → 截图+a11y快照 → LLM修复');
  console.log(' */');
  console.log("import { test, expect } from '@playwright/test';");
  console.log("const { robustLocate } = require('./helpers/repair-helper.js');");
  console.log('');
  console.log("const BASE_URL = 'http://127.0.0.1:8765/device-manager.html';");
  console.log('');
  console.log("test.describe('设备管理 — 品牌筛选+表格验证', () => {");
  console.log('');
  console.log("  test.beforeEach(async ({ page }) => {");
  console.log("    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });");
  console.log("  });");
  console.log('');
  console.log("  test('选择 Apple 品牌筛选, 验证表格和计数', async ({ page }) => {");
  console.log("    test.setTimeout(180_000);");
  console.log('');

  // ── Step 1: Verify page loaded ──
  console.log('    // ══ 步骤1: 验证页面正常加载 ══');
  console.log("    await expect(page.getByText('📱 设备管理平台')).toBeVisible();");
  console.log("    await expect(page).toHaveURL(/device-manager/);");
  console.log('');

  // ── Step 2: Click Apple checkbox ──
  console.log('    // ══ 步骤2: 点击 Apple 品牌标签 ══');
  console.log("    // DOM: <label><input type=\"checkbox\" value=\"Apple\">Apple</label>");
  console.log('    await robustLocate(page, {');
  console.log("      intent: 'Apple品牌标签',");
  console.log('      strategies: [');
  console.log("        { type: 'semantic',  locator: () => page.getByLabel('Apple') },");
  console.log("        { type: 'xpath',     locator: () => page.locator('//label[contains(text(),\"Apple\")]') },");
  console.log("        { type: 'fullXPath', locator: () => page.locator('/html/body/div[2]/div/div/div/div[1]/label[1]') },");
  console.log('      ],');
  console.log('      action: (loc) => loc.click(),');
  console.log('      timeout: 5000,');
  console.log('    });');
  console.log('');

  // ── Step 3: Click query button ──
  console.log('    // ══ 步骤3: 点击查询按钮触发筛选 ══');
  console.log("    // DOM: <button>查询</button>");
  console.log('    await robustLocate(page, {');
  console.log("      intent: '查询按钮',");
  console.log('      strategies: [');
  console.log("        { type: 'semantic',  locator: () => page.getByRole('button', { name: '查询' }) },");
  console.log("        { type: 'xpath',     locator: () => page.locator('//button[contains(text(),\"查询\")]') },");
  console.log("        { type: 'fullXPath', locator: () => page.locator('/html/body/div[2]/div/div/div/div[2]/div/button[1]') },");
  console.log('      ],');
  console.log('      action: (loc) => loc.click(),');
  console.log('      timeout: 5000,');
  console.log('    });');
  console.log('');

  // ── Step 4: Verify count ──
  console.log('    // ══ 断言: 列表只显示 Apple 设备 ══');
  console.log("    // 品牌列是第2列");
  console.log("    const brandCells = page.locator('tbody tr td:nth-child(2)');");
  console.log('    const count = await brandCells.count();');
  console.log('    expect(count).toBeGreaterThan(0);');
  console.log('    for (let i = 0; i < count; i++) {');
  console.log("      await expect(brandCells.nth(i)).toHaveText('Apple');");
  console.log('    }');
  console.log('');

  // ── Step 5: Verify filter count badge ──
  console.log('    // ══ 断言: 筛选计数更新（标题中的数字应变小） ══');
  console.log("    const countBadge = page.locator('#filter-count');");
  console.log('    const filterCount = await countBadge.textContent();');
  console.log('    expect(Number(filterCount)).toBeGreaterThan(0);');
  console.log('    expect(Number(filterCount)).toBeLessThan(30);');
  console.log('');

  // ── Step 6: Verify Apple label still checked ──
  console.log('    // ══ 断言: Apple 标签应处于选中态 ══');
  console.log("    const appleLabel = page.getByLabel('Apple');");
  console.log('    await expect(appleLabel).toBeVisible();');
  console.log('    // TODO: verify checkbox checked state (need browser_verify_value for checkbox)');
  console.log('');

  console.log('  });');
  console.log('});');

  proc.kill();
  setTimeout(() => process.exit(0), 500);
}

main().catch(e => { console.error(e); proc.kill(); process.exit(1); });
