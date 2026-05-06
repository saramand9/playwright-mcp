// Final comprehensive test of all 11 assertion tools
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
  return new Promise((resolve, reject) => {
    pending.set(id, resolve);
    setTimeout(() => { pending.delete(id); reject(new Error(`Timeout: ${method}`)); }, 30000);
  });
}

function ok(r) { return !(r.result?.content?.[0]?.text || '').startsWith('### Error'); }
function text(r) { return (r.result?.content || []).map(c => c.text).join('\n').replace(/\n/g, ' | ').slice(0, 150); }
function code(r) { const t = (r.result?.content || []).map(c => c.text).join('\n'); const m = t.match(/```js\n([^`]+)```/); return m ? m[1].trim() : t.slice(0, 100); }

async function test(name, fn) {
  try {
    const result = await fn();
    const passed = result;
    console.log(`${passed ? '✅' : '❌'} ${name}`);
    return passed;
  } catch(e) {
    console.log(`💥 ${name} — ${e.message}`);
    return false;
  }
}

async function main() {
  let passed = 0, total = 0;
  const t = (name, fn) => test(name, fn).then(r => { total++; if(r) passed++; return r; });

  await send('initialize', { protocolVersion: '1.0', clientInfo: { name: 'test' }, capabilities: {} });
  await send('tools/call', { name: 'browser_navigate', arguments: { url: URL } });
  const snap = await send('tools/call', { name: 'browser_snapshot', arguments: {} });
  const snapText = snap.result?.content?.[0]?.text || '';

  // Extract refs
  const btnQuery = snapText.match(/button\s+"查询"\s+\[ref=([^\]]+)\]/);
  const btnReset = snapText.match(/button\s+"([^"]*重置[^"]*)"\s+\[ref=([^\]]+)\]/);
  const linkHome = snapText.match(/link\s+"🏠 首页"\s+\[ref=([^\]]+)\]/);
  const genericHeading = snapText.match(/\[ref=(e3)\]/);
  const nav = snapText.match(/navigation\s+\[ref=([^\]]+)\]/);
  const table = snapText.match(/table\s+\[ref=([^\]]+)\]/);

  console.log('=== PAGE-LEVEL TOOLS ===\n');

  // 1. verifyTextVisible
  await t('verifyTextVisible — finds page heading', async () => {
    const r = await send('tools/call', { name: 'browser_verify_text_visible', arguments: { text: '设备管理' } });
    return ok(r) && code(r).includes('toBeVisible');
  });

  // 2. verifyTextVisible — negative
  await t('verifyTextVisible — rejects missing text', async () => {
    const r = await send('tools/call', { name: 'browser_verify_text_visible', arguments: { text: 'XYZZY_MISSING_999' } });
    return !ok(r);
  });

  // 3. verifyTextNotVisible
  await t('verifyTextNotVisible — confirms text absent', async () => {
    const r = await send('tools/call', { name: 'browser_verify_text_not_visible', arguments: { text: 'XYZZY_NONEXISTENT' } });
    return ok(r);
  });

  // 4. verifyTextNotVisible — negative
  await t('verifyTextNotVisible — rejects visible text', async () => {
    const r = await send('tools/call', { name: 'browser_verify_text_not_visible', arguments: { text: '设备管理' } });
    return !ok(r);
  });

  // 5. verifyPageURL — equals
  await t('verifyPageURL — equals mode', async () => {
    const r = await send('tools/call', { name: 'browser_verify_page_url', arguments: { expected: URL, mode: 'equals' } });
    return ok(r) && code(r).includes('toHaveURL');
  });

  // 6. verifyPageURL — contains
  await t('verifyPageURL — contains mode', async () => {
    const r = await send('tools/call', { name: 'browser_verify_page_url', arguments: { expected: 'device-manager', mode: 'contains' } });
    return ok(r) && code(r).includes('toHaveURL');
  });

  // 7. verifyPageURL — negative
  await t('verifyPageURL — rejects wrong URL', async () => {
    const r = await send('tools/call', { name: 'browser_verify_page_url', arguments: { expected: 'WRONG', mode: 'equals' } });
    return !ok(r);
  });

  // 8. verifyCount — page-level text
  await t('verifyCount — page-level text equals', async () => {
    const r = await send('tools/call', { name: 'browser_verify_count', arguments: { text: 'Apple', count: 1 } });
    return ok(r) && code(r).includes('toHaveCount');
  });

  // 9. verifyCount — zero count
  await t('verifyCount — zero for missing text', async () => {
    const r = await send('tools/call', { name: 'browser_verify_count', arguments: { text: 'XYZZY_999', count: 0 } });
    return ok(r);
  });

  // 10. verifyCount — negative
  await t('verifyCount — rejects wrong count', async () => {
    const r = await send('tools/call', { name: 'browser_verify_count', arguments: { text: '设备管理', count: 999 } });
    return !ok(r);
  });

  console.log('\n=== ELEMENT-LEVEL TOOLS ===\n');

  // 11. verifyState — enabled (button)
  await t('verifyState — button enabled', async () => {
    if (!btnQuery) return false;
    const r = await send('tools/call', { name: 'browser_verify_state', arguments: { element: '查询按钮', ref: btnQuery[1], state: 'enabled' } });
    return ok(r) && code(r).includes('toBeEnabled');
  });

  // 12. verifyState — inDOM
  await t('verifyState — element in DOM', async () => {
    if (!genericHeading) return false;
    const r = await send('tools/call', { name: 'browser_verify_state', arguments: { element: 'heading', ref: genericHeading[1], state: 'inDOM' } });
    return ok(r);
  });

  // 13. verifyState — attached
  await t('verifyState — element attached', async () => {
    if (!genericHeading) return false;
    const r = await send('tools/call', { name: 'browser_verify_state', arguments: { element: 'heading', ref: genericHeading[1], state: 'attached' } });
    return ok(r) && code(r).includes('toBeAttached');
  });

  // 14. verifyState — hidden (negative on visible element)
  await t('verifyState — rejects hidden on visible element', async () => {
    if (!genericHeading) return false;
    const r = await send('tools/call', { name: 'browser_verify_state', arguments: { element: 'heading', ref: genericHeading[1], state: 'hidden' } });
    return !ok(r);
  });

  // 15. verifyText — contains mode
  await t('verifyText — contains text', async () => {
    if (!genericHeading) return false;
    const r = await send('tools/call', { name: 'browser_verify_text', arguments: { element: 'heading', ref: genericHeading[1], text: '设备管理', mode: 'contains' } });
    return ok(r) && code(r).includes('toContainText');
  });

  // 16. verifyText — equals mode
  await t('verifyText — equals mode', async () => {
    if (!linkHome) return false;
    const r = await send('tools/call', { name: 'browser_verify_text', arguments: { element: 'home link', ref: linkHome[1], text: '🏠 首页', mode: 'equals' } });
    return ok(r) && code(r).includes('toHaveText');
  });

  // 17. verifyText — negative (wrong text)
  await t('verifyText — rejects wrong text', async () => {
    if (!linkHome) return false;
    const r = await send('tools/call', { name: 'browser_verify_text', arguments: { element: 'home link', ref: linkHome[1], text: 'WRONG TEXT', mode: 'equals' } });
    return !ok(r);
  });

  // 18. verifyAttribute
  await t('verifyAttribute — href value', async () => {
    if (!linkHome) return false;
    const r = await send('tools/call', { name: 'browser_verify_attribute', arguments: { element: 'home link', ref: linkHome[1], name: 'href', expected: 'index.html' } });
    return ok(r) && code(r).includes('toHaveAttribute');
  });

  // 19. verifyAttribute — negative
  await t('verifyAttribute — rejects wrong value', async () => {
    if (!linkHome) return false;
    const r = await send('tools/call', { name: 'browser_verify_attribute', arguments: { element: 'home link', ref: linkHome[1], name: 'href', expected: 'WRONG.html' } });
    return !ok(r);
  });

  // 20. verifyCSS
  await t('verifyCSS — computed style', async () => {
    if (!linkHome) return false;
    const r = await send('tools/call', { name: 'browser_verify_css', arguments: { element: 'home link', ref: linkHome[1], property: 'cursor', expected: 'pointer' } });
    return ok(r) && code(r).includes('toHaveCSS');
  });

  // 21. verifyCSS — negative
  await t('verifyCSS — rejects wrong value', async () => {
    if (!linkHome) return false;
    const r = await send('tools/call', { name: 'browser_verify_css', arguments: { element: 'home link', ref: linkHome[1], property: 'display', expected: 'none' } });
    return !ok(r);
  });

  // 22. verifyCount — scoped (ref)
  await t('verifyCount — scoped to element', async () => {
    if (!nav) return false;
    const r = await send('tools/call', { name: 'browser_verify_count', arguments: { element: 'navigation', ref: nav[1], count: 1, operator: 'greater_than_or_equal' } });
    return ok(r) && code(r).includes('toHaveCount');
  });

  // 23. verifyCount — table count
  await t('verifyCount — table exists', async () => {
    if (!table) return false;
    const r = await send('tools/call', { name: 'browser_verify_count', arguments: { element: 'device table', ref: table[1], count: 1, operator: 'greater_than_or_equal' } });
    return ok(r);
  });

  console.log(`\n=== RESULTS: ${passed}/${total} passed ===`);

  proc.kill();
  setTimeout(() => process.exit(passed === total ? 0 : 1), 500);
}

main().catch(e => { console.error(e); proc.kill(); process.exit(1); });
