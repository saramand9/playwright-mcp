// 提取所有 MCP 工具生成的 Playwright 测试代码
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

function send(method, params) {
  const id = ++msgId;
  proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  return new Promise(resolve => {
    pending.set(id, resolve);
    setTimeout(() => resolve(null), 15000);
  });
}

function extractCode(r) {
  const text = (r?.result?.content || []).map(c => c.text).join('\n') || '';
  const m = text.match(/```js\n([^`]+)```/);
  return m ? m[1].trim() : null;
}

function extractError(r) {
  const text = (r?.result?.content || []).map(c => c.text).join('\n') || '';
  if (text.startsWith('### Error')) return text.replace('### Error\n', '').slice(0, 200);
  return null;
}

async function main() {
  await send('initialize', { protocolVersion: '1.0', clientInfo: { name: 'test' }, capabilities: {} });
  await send('tools/call', { name: 'browser_navigate', arguments: { url: URL } });
  const snap = await send('tools/call', { name: 'browser_snapshot', arguments: {} });
  const snapText = snap?.result?.content?.[0]?.text || '';

  // Extract refs
  const btnQuery = snapText.match(/button\s+"查询"\s+\[ref=([^\]]+)\]/);
  const linkHome = snapText.match(/link\s+"🏠 首页"\s+\[ref=([^\]]+)\]/);
  const heading = snapText.match(/\[ref=(e3)\]/);
  const nav = snapText.match(/navigation\s+\[ref=([^\]]+)\]/);

  const results = [];

  // ── 页面级工具 ──

  // verifyTextVisible
  let r = await send('tools/call', { name: 'browser_verify_text_visible', arguments: { text: '设备管理' } });
  results.push({ tool: 'browser_verify_text_visible', args: { text: '设备管理' }, code: extractCode(r), error: extractError(r) });

  // verifyTextNotVisible
  r = await send('tools/call', { name: 'browser_verify_text_not_visible', arguments: { text: 'XYZZY_NONEXISTENT' } });
  results.push({ tool: 'browser_verify_text_not_visible', args: { text: 'XYZZY_NONEXISTENT' }, code: extractCode(r), error: extractError(r) });

  // verifyPageURL — equals
  r = await send('tools/call', { name: 'browser_verify_page_url', arguments: { expected: URL, mode: 'equals' } });
  results.push({ tool: 'browser_verify_page_url', args: { expected: URL, mode: 'equals' }, code: extractCode(r), error: extractError(r) });

  // verifyPageURL — contains
  r = await send('tools/call', { name: 'browser_verify_page_url', arguments: { expected: 'device-manager', mode: 'contains' } });
  results.push({ tool: 'browser_verify_page_url', args: { expected: 'device-manager', mode: 'contains' }, code: extractCode(r), error: extractError(r) });

  // verifyCount — page-level
  r = await send('tools/call', { name: 'browser_verify_count', arguments: { text: 'Apple', count: 5 } });
  results.push({ tool: 'browser_verify_count', args: { text: 'Apple', count: 5 }, code: extractCode(r), error: extractError(r) });

  // ── 元素级工具 ──

  // verifyState — enabled
  if (btnQuery) {
    r = await send('tools/call', { name: 'browser_verify_state', arguments: { element: '查询按钮', ref: btnQuery[1], state: 'enabled' } });
    results.push({ tool: 'browser_verify_state', args: { element: '查询按钮', ref: btnQuery[1], state: 'enabled' }, code: extractCode(r), error: extractError(r) });
  }

  // verifyState — inDOM
  if (heading) {
    r = await send('tools/call', { name: 'browser_verify_state', arguments: { element: '页面标题', ref: heading[1], state: 'inDOM' } });
    results.push({ tool: 'browser_verify_state', args: { element: '页面标题', ref: heading[1], state: 'inDOM' }, code: extractCode(r), error: extractError(r) });
  }

  // verifyState — attached
  if (heading) {
    r = await send('tools/call', { name: 'browser_verify_state', arguments: { element: '页面标题', ref: heading[1], state: 'attached' } });
    results.push({ tool: 'browser_verify_state', args: { element: '页面标题', ref: heading[1], state: 'attached' }, code: extractCode(r), error: extractError(r) });
  }

  // verifyState — hidden (negative)
  if (heading) {
    r = await send('tools/call', { name: 'browser_verify_state', arguments: { element: '页面标题', ref: heading[1], state: 'hidden' } });
    results.push({ tool: 'browser_verify_state (fail)', args: { element: '页面标题', ref: heading[1], state: 'hidden' }, code: extractCode(r), error: extractError(r) });
  }

  // verifyText — contains
  if (heading) {
    r = await send('tools/call', { name: 'browser_verify_text', arguments: { element: '页面标题', ref: heading[1], text: '设备管理', mode: 'contains' } });
    results.push({ tool: 'browser_verify_text', args: { element: '页面标题', ref: heading[1], text: '设备管理', mode: 'contains' }, code: extractCode(r), error: extractError(r) });
  }

  // verifyText — equals
  if (linkHome) {
    r = await send('tools/call', { name: 'browser_verify_text', arguments: { element: '首页链接', ref: linkHome[1], text: '🏠 首页', mode: 'equals' } });
    results.push({ tool: 'browser_verify_text', args: { element: '首页链接', ref: linkHome[1], text: '🏠 首页', mode: 'equals' }, code: extractCode(r), error: extractError(r) });
  }

  // verifyText — regex
  if (heading) {
    r = await send('tools/call', { name: 'browser_verify_text', arguments: { element: '页面标题', ref: heading[1], text: '设备.*平台', mode: 'regex' } });
    results.push({ tool: 'browser_verify_text', args: { element: '页面标题', ref: heading[1], text: '设备.*平台', mode: 'regex' }, code: extractCode(r), error: extractError(r) });
  }

  // verifyAttribute
  if (linkHome) {
    r = await send('tools/call', { name: 'browser_verify_attribute', arguments: { element: '首页链接', ref: linkHome[1], name: 'href', expected: 'index.html' } });
    results.push({ tool: 'browser_verify_attribute', args: { element: '首页链接', ref: linkHome[1], name: 'href', expected: 'index.html' }, code: extractCode(r), error: extractError(r) });
  }

  // verifyCSS
  if (linkHome) {
    r = await send('tools/call', { name: 'browser_verify_css', arguments: { element: '首页链接', ref: linkHome[1], property: 'cursor', expected: 'pointer' } });
    results.push({ tool: 'browser_verify_css', args: { element: '首页链接', ref: linkHome[1], property: 'cursor', expected: 'pointer' }, code: extractCode(r), error: extractError(r) });
  }

  // verifyCount — scoped
  if (nav) {
    r = await send('tools/call', { name: 'browser_verify_count', arguments: { element: '导航栏', ref: nav[1], count: 5, operator: 'greater_than_or_equal' } });
    results.push({ tool: 'browser_verify_count', args: { element: '导航栏', ref: nav[1], count: 5, operator: 'greater_than_or_equal' }, code: extractCode(r), error: extractError(r) });
  }

  // ── 输出最终 TS 脚本 ──
  console.log('='.repeat(70));
  console.log('// 生成的 Playwright 测试脚本');
  console.log('// 目标页面: http://localhost:8080/device-manager.html');
  console.log('='.repeat(70));
  console.log('');
  console.log("import { test, expect } from '@playwright/test';");
  console.log('');
  console.log("test('设备管理页面 — MCP 断言验证', async ({ page }) => {");
  console.log('');
  console.log("  // ── 导航 ──");
  console.log(`  await page.goto('${URL}');`);
  console.log('');

  for (const item of results) {
    console.log(`  // ── ${item.tool} ──`);
    console.log(`  // 参数: ${JSON.stringify(item.args)}`);
    if (item.code) {
      console.log(`  ${item.code}`);
    }
    if (item.error) {
      console.log(`  // ❌ 失败: ${item.error.replace(/\n/g, ' ')}`);
    }
    console.log('');
  }

  console.log('});');

  proc.kill();
  setTimeout(() => process.exit(0), 500);
}

main().catch(e => { console.error(e); proc.kill(); process.exit(1); });
