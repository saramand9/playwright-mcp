// Test MCP assertion tools against device-manager page
const { spawn } = require('child_process');
const path = require('path');

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
  buffer = lines.pop(); // keep incomplete line
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    } catch(e) { console.log('PARSE ERR:', line.slice(0,100)); }
  }
});

proc.stderr.on('data', d => process.stderr.write('SRV_ERR: ' + d.toString().slice(0,200) + '\n'));

function send(method, params) {
  const id = ++msgId;
  const msg = JSON.stringify({ jsonrpc: '2.0', id, method, params });
  proc.stdin.write(msg + '\n');
  return new Promise((resolve, reject) => {
    pending.set(id, resolve);
    setTimeout(() => { pending.delete(id); reject(new Error(`Timeout: ${method} (id=${id})`)); }, 30000);
  });
}

async function main() {
  try {
    // 1. Initialize
    console.log('=== 1. Initialize ===');
    const init = await send('initialize', { protocolVersion: '1.0', clientInfo: { name: 'test' }, capabilities: {} });
    console.log('Server:', init.result?.serverInfo?.name, init.result?.serverInfo?.version);

    // 2. List tools
    console.log('\n=== 2. List Tools ===');
    const tools = await send('tools/list', {});
    const toolNames = tools.result?.tools?.map(t => t.name).sort() || [];
    console.log('Total tools:', toolNames.length);

    // Show only assertion/verify tools
    const verifyTools = toolNames.filter(n => n.startsWith('browser_verify'));
    console.log('Verify tools (' + verifyTools.length + '):');
    verifyTools.forEach(n => console.log('  - ' + n));

    // 3. Navigate to device-manager page
    console.log('\n=== 3. Navigate ===');
    const nav = await send('tools/call', { name: 'browser_navigate', arguments: { url: URL } });
    console.log('Navigation result:', nav.result?.content?.[0]?.text?.slice(0,200) || 'OK');

    // 4. Take snapshot
    console.log('\n=== 4. Snapshot ===');
    const snap = await send('tools/call', { name: 'browser_snapshot', arguments: {} });
    const snapshotText = snap.result?.content?.[0]?.text || '';
    console.log('Snapshot length:', snapshotText.length);
    console.log('First 500 chars:');
    console.log(snapshotText.slice(0, 500));

    // 5. Test verifyTextVisible (page-level)
    console.log('\n=== 5. verifyTextVisible ===');
    const r1 = await send('tools/call', { name: 'browser_verify_text_visible', arguments: { text: '设备管理' } });
    console.log('Result:', JSON.stringify(r1.result?.content || r1));

    // 6. Test verifyTextNotVisible (negative)
    console.log('\n=== 6. verifyTextNotVisible ===');
    const r2 = await send('tools/call', { name: 'browser_verify_text_not_visible', arguments: { text: 'NONEXISTENT_TEXT_XYZ' } });
    console.log('Result:', JSON.stringify(r2.result?.content || r2));

    // 7. Test verifyPageURL
    console.log('\n=== 7. verifyPageURL ===');
    const r3 = await send('tools/call', { name: 'browser_verify_page_url', arguments: { expected: URL, mode: 'equals' } });
    console.log('Equals result:', JSON.stringify(r3.result?.content || r3));
    const r3b = await send('tools/call', { name: 'browser_verify_page_url', arguments: { expected: 'device-manager', mode: 'contains' } });
    console.log('Contains result:', JSON.stringify(r3b.result?.content || r3b));

    // 8. Test verifyState on elements from snapshot
    console.log('\n=== 8. verifyState ===');
    // Try to find a button and check it's enabled
    const r4 = await send('tools/call', { name: 'browser_verify_state', arguments: { element: 'reset button', ref: 'B1', state: 'enabled' } });
    console.log('State enabled:', JSON.stringify(r4.result?.content || r4));

    // 9. Test verifyCount (page-level text)
    console.log('\n=== 9. verifyCount (page-level) ===');
    const r5 = await send('tools/call', { name: 'browser_verify_count', arguments: { text: 'Apple', count: 1, operator: 'greater_than_or_equal' } });
    console.log('Count result:', JSON.stringify(r5.result?.content || r5));

    // 10. Test verifyPageURL with error case
    console.log('\n=== 10. verifyPageURL (should fail) ===');
    const r6 = await send('tools/call', { name: 'browser_verify_page_url', arguments: { expected: 'WRONG_URL', mode: 'equals' } });
    console.log('Expected fail:', JSON.stringify(r6.result?.content?.[0]?.text || r6));

    console.log('\n=== ALL TESTS COMPLETE ===');
  } catch(e) {
    console.error('TEST ERROR:', e.message);
  } finally {
    proc.kill();
    setTimeout(() => process.exit(0), 500);
  }
}

main();
