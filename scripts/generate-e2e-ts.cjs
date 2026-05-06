// 生成完整 E2E 测试脚本：Action + Assertion 混合
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

function extractCode(r) {
  const text = (r?.result?.content || []).map(c => c.text).join('\n') || '';
  const m = text.match(/```js\n([^`]+)```/);
  return m ? m[1].trim() : null;
}

function extractError(r) {
  const text = (r?.result?.content || []).map(c => c.text).join('\n') || '';
  if (text.startsWith('### Error')) return text.replace('### Error\n', '');
  return null;
}

async function main() {
  await send('initialize', { protocolVersion: '1.0', clientInfo: { name: 'test' }, capabilities: {} });

  const steps = [];

  // ═══════════════════════════════════════════════════════════
  // 完整 E2E 流程：设备管理页面的真实测试场景
  // ═══════════════════════════════════════════════════════════

  // Step 1: 导航
  let r = await send('tools/call', { name: 'browser_navigate', arguments: { url: URL } });
  steps.push({ label: '1. 打开页面', code: extractCode(r), error: extractError(r) });

  // Step 2: 快照，了解页面结构
  r = await send('tools/call', { name: 'browser_snapshot', arguments: {} });
  const snapText = r?.result?.content?.[0]?.text || '';
  steps.push({ label: '2. 获取页面快照', code: null, error: null, skip: true });

  // Step 3: 验证页面标题
  r = await send('tools/call', { name: 'browser_verify_text_visible', arguments: { text: '设备管理平台' } });
  steps.push({ label: '3. 验证页面标题可见', code: extractCode(r), error: extractError(r) });

  // Step 4: 验证 URL
  r = await send('tools/call', { name: 'browser_verify_page_url', arguments: { expected: 'device-manager', mode: 'contains' } });
  steps.push({ label: '4. 验证 URL 包含 device-manager', code: extractCode(r), error: extractError(r) });

  // Step 5: 验证表格行数
  r = await send('tools/call', { name: 'browser_verify_count', arguments: { text: 'Apple', count: 1, operator: 'greater_than_or_equal' } });
  steps.push({ label: '5. 验证表格中有 Apple 数据', code: extractCode(r), error: extractError(r) });

  // Step 6: 点击查询按钮 (ACTION)
  const btnQuery = snapText.match(/button\s+"查询"\s+\[ref=([^\]]+)\]/);
  if (btnQuery) {
    r = await send('tools/call', { name: 'browser_click', arguments: { element: '查询按钮', ref: btnQuery[1] } });
    steps.push({ label: '6. 点击查询按钮', code: extractCode(r), error: extractError(r) });
  }

  // Step 7: 验证查询按钮依然可见（操作后状态）
  r = await send('tools/call', { name: 'browser_verify_state', arguments: { element: '查询按钮', ref: btnQuery[1], state: 'enabled' } });
  steps.push({ label: '7. 验证查询按钮仍可用', code: extractCode(r), error: extractError(r) });

  // Step 8: 找到搜索输入框并输入 (ACTION)
  const searchInput = snapText.match(/textbox\s+"([^"]*)"\s+\[ref=([^\]]+)\]/);
  if (searchInput) {
    r = await send('tools/call', { name: 'browser_type', arguments: { element: searchInput[1], ref: searchInput[2], text: 'iPhone 15' } });
    steps.push({ label: '8. 在搜索框输入 "iPhone 15"', code: extractCode(r), error: extractError(r) });
  }

  // Step 9: 再次点击查询 (ACTION)
  if (btnQuery) {
    r = await send('tools/call', { name: 'browser_click', arguments: { element: '查询按钮', ref: btnQuery[1] } });
    steps.push({ label: '9. 再次点击查询', code: extractCode(r), error: extractError(r) });
  }

  // Step 10: 验证页面未崩溃
  r = await send('tools/call', { name: 'browser_verify_text_visible', arguments: { text: '设备管理' } });
  steps.push({ label: '10. 操作后验证页面正常', code: extractCode(r), error: extractError(r) });

  // Step 11: 验证导航链接属性
  const linkHome = snapText.match(/link\s+"🏠 首页"\s+\[ref=([^\]]+)\]/);
  if (linkHome) {
    r = await send('tools/call', { name: 'browser_verify_attribute', arguments: { element: '首页链接', ref: linkHome[1], name: 'href', expected: 'index.html' } });
    steps.push({ label: '11. 验证导航链接 href', code: extractCode(r), error: extractError(r) });

    r = await send('tools/call', { name: 'browser_verify_css', arguments: { element: '首页链接', ref: linkHome[1], property: 'cursor', expected: 'pointer' } });
    steps.push({ label: '12. 验证链接样式 cursor:pointer', code: extractCode(r), error: extractError(r) });
  }

  // Step 13: 点击导航链接 (ACTION)
  if (linkHome) {
    r = await send('tools/call', { name: 'browser_click', arguments: { element: '首页链接', ref: linkHome[1] } });
    steps.push({ label: '13. 点击首页链接', code: extractCode(r), error: extractError(r) });
  }

  // Step 14: 验证跳转后 URL
  r = await send('tools/call', { name: 'browser_verify_page_url', arguments: { expected: 'index.html', mode: 'contains' } });
  steps.push({ label: '14. 验证跳转到首页', code: extractCode(r), error: extractError(r) });

  // ═══════════════════════════════════════════════════════════
  // 输出完整 TS 脚本
  // ═══════════════════════════════════════════════════════════
  console.log('');
  console.log("import { test, expect } from '@playwright/test';");
  console.log('');
  console.log("test('设备管理页面 — 端到端测试', async ({ page }) => {");
  console.log('');

  for (const step of steps) {
    if (step.skip) continue;
    console.log(`  // ${step.label}`);
    if (step.code) {
      step.code.split('\n').forEach(line => console.log(`  ${line}`));
    }
    if (step.error) {
      const errLines = step.error.split('\n').filter(l => l.trim());
      errLines.forEach(l => console.log(`  // ❌ ${l.trim()}`));
    }
    console.log('');
  }

  console.log('});');

  proc.kill();
  setTimeout(() => process.exit(0), 500);
}

main().catch(e => { console.error(e); proc.kill(); process.exit(1); });
