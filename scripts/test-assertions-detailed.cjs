// Round 2: Detailed tests using real snapshot refs
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
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    } catch(e) {}
  }
});

proc.stderr.on('data', d => process.stderr.write('SRV_ERR: ' + d.toString().slice(0,200) + '\n'));

function send(method, params) {
  const id = ++msgId;
  const msg = JSON.stringify({ jsonrpc: '2.0', id, method, params });
  proc.stdin.write(msg + '\n');
  return new Promise((resolve, reject) => {
    pending.set(id, resolve);
    setTimeout(() => { pending.delete(id); reject(new Error(`Timeout: ${method}`)); }, 30000);
  });
}

function ok(r) {
  const text = r.result?.content?.[0]?.text || '';
  return !text.startsWith('### Error');
}

function resultText(r) {
  return (r.result?.content || []).map(c => c.text).join('\n').slice(0, 300);
}

async function main() {
  try {
    await send('initialize', { protocolVersion: '1.0', clientInfo: { name: 'test' }, capabilities: {} });

    // Navigate
    console.log('--- Navigate ---');
    await send('tools/call', { name: 'browser_navigate', arguments: { url: URL } });

    // Get snapshot and extract refs
    console.log('--- Snapshot ---');
    const snap = await send('tools/call', { name: 'browser_snapshot', arguments: {} });
    const snapText = snap.result?.content?.[0]?.text || '';

    // Extract some refs from snapshot for testing
    // Find refs with text or role info
    const refs = [...snapText.matchAll(/\[ref=([^\]]+)\]/g)].map(m => m[1]);
    console.log('Available refs (first 20):', refs.slice(0, 20).join(', '));

    // Find a button ref
    const buttonMatch = snapText.match(/button\s+"([^"]+)"\s+\[ref=([^\]]+)\]/);
    console.log('Button found:', buttonMatch ? `${buttonMatch[1]} -> ${buttonMatch[2]}` : 'none');

    // Find a textbox/input ref
    const inputMatch = snapText.match(/textbox\s+"([^"]*)"\s+\[ref=([^\]]+)\]/);
    console.log('Textbox found:', inputMatch ? `${inputMatch[1]} -> ${inputMatch[2]}` : 'none');

    // Find checkbox refs
    const checkboxes = [...snapText.matchAll(/checkbox\s+"([^"]*)"\s+\[ref=([^\]]+)\]/g)];
    console.log('Checkboxes found:', checkboxes.map(m => `${m[1]} -> ${m[2]}`).join(', '));

    // Find a link ref
    const linkMatch = snapText.match(/link\s+"([^"]+)"\s+\[ref=([^\]]+)\]/);
    console.log('Link found:', linkMatch ? `${linkMatch[1]} -> ${linkMatch[2]}` : 'none');

    // Test 1: verifyElement (element visible) with a known ref
    console.log('\n--- Test: verifyElement ---');
    if (refs[0]) {
      const r = await send('tools/call', { name: 'browser_verify_element_visible', arguments: { element: 'page container', ref: refs[0] } });
      console.log('Element visible (ref=' + refs[0] + '):', ok(r) ? 'PASS' : 'FAIL', '-', resultText(r));
    }

    // Test 2: verifyState for a button (enabled)
    console.log('\n--- Test: verifyState (enabled) ---');
    if (buttonMatch) {
      const r = await send('tools/call', { name: 'browser_verify_state', arguments: { element: buttonMatch[1], ref: buttonMatch[2], state: 'enabled' } });
      console.log('Button enabled:', ok(r) ? 'PASS' : 'FAIL', '-', resultText(r));
    }

    // Test 3: verifyState (inDOM) for page element
    console.log('\n--- Test: verifyState (inDOM) ---');
    if (refs[1]) {
      const r = await send('tools/call', { name: 'browser_verify_state', arguments: { element: 'nav element', ref: refs[1], state: 'inDOM' } });
      console.log('In DOM:', ok(r) ? 'PASS' : 'FAIL', '-', resultText(r));
    }

    // Test 4: verifyState (attached)
    console.log('\n--- Test: verifyState (attached) ---');
    if (refs[0]) {
      const r = await send('tools/call', { name: 'browser_verify_state', arguments: { element: 'root element', ref: refs[0], state: 'attached' } });
      console.log('Attached:', ok(r) ? 'PASS' : 'FAIL', '-', resultText(r));
    }

    // Test 5: verifyText (text content) on a text element
    console.log('\n--- Test: verifyText ---');
    // Find a generic with specific text
    const textMatch = snapText.match(/generic\s+\[ref=([^\]]+)\]:\s+([^\n]+)/);
    if (textMatch) {
      const fullText = textMatch[2].trim();
      const r = await send('tools/call', { name: 'browser_verify_text', arguments: { element: 'text element', ref: textMatch[1], text: fullText, mode: 'equals' } });
      console.log('Text equals "' + fullText.slice(0, 40) + '":', ok(r) ? 'PASS' : 'FAIL', '-', resultText(r));
    }

    // Test 6: verifyText with contains mode
    console.log('\n--- Test: verifyText (contains) ---');
    const headingMatch = snapText.match(/generic\s+\[ref=([^\]]+)\]:\s+📱\s+设备管理平台/);
    if (headingMatch) {
      const r = await send('tools/call', { name: 'browser_verify_text', arguments: { element: 'heading', ref: headingMatch[1], text: '设备管理', mode: 'contains' } });
      console.log('Text contains "设备管理":', ok(r) ? 'PASS' : 'FAIL', '-', resultText(r));
    }

    // Test 7: verifyCSS
    console.log('\n--- Test: verifyCSS ---');
    if (linkMatch) {
      const r = await send('tools/call', { name: 'browser_verify_css', arguments: { element: linkMatch[1], ref: linkMatch[2], property: 'cursor', expected: 'pointer' } });
      console.log('CSS cursor:pointer:', ok(r) ? 'PASS' : 'FAIL', '-', resultText(r));
    }

    // Test 8: verifyAttribute
    console.log('\n--- Test: verifyAttribute ---');
    if (linkMatch) {
      const r = await send('tools/call', { name: 'browser_verify_attribute', arguments: { element: linkMatch[1], ref: linkMatch[2], name: 'href', expected: 'index.html' } });
      console.log('href attribute:', ok(r) ? 'PASS' : 'FAIL', '-', resultText(r));
    }

    // Test 9: verifyCount with selector
    console.log('\n--- Test: verifyCount (selector) ---');
    const navRef = snapText.match(/navigation\s+\[ref=([^\]]+)\]/);
    if (navRef) {
      const r = await send('tools/call', { name: 'browser_verify_count', arguments: { element: 'navigation', ref: navRef[1], count: 5, operator: 'greater_than' } });
      console.log('Nav links > 5:', ok(r) ? 'PASS' : 'FAIL', '-', resultText(r));
    }

    // Test 10: verifyValue
    console.log('\n--- Test: verifyValue ---');
    if (inputMatch && inputMatch[1]) {
      const r = await send('tools/call', { name: 'browser_verify_value', arguments: { element: inputMatch[1], ref: inputMatch[2], value: '' } });
      console.log('Input empty value:', ok(r) ? 'PASS' : 'FAIL', '-', resultText(r));
    }

    // Test 11: verifyList
    console.log('\n--- Test: verifyList ---');
    const listRef = snapText.match(/list\s+\[ref=([^\]]+)\]/);
    if (listRef) {
      const r = await send('tools/call', { name: 'browser_verify_list_visible', arguments: { element: 'list', ref: listRef[1] } });
      console.log('List visible:', ok(r) ? 'PASS' : 'FAIL', '-', resultText(r));
    }

    // Test 12: verifyState (hidden) - expect fail on visible element
    console.log('\n--- Test: verifyState (hidden — should fail) ---');
    if (refs[0]) {
      const r = await send('tools/call', { name: 'browser_verify_state', arguments: { element: 'visible element', ref: refs[0], state: 'hidden' } });
      console.log('Hidden check:', !ok(r) ? 'Correctly FAILED' : 'UNEXPECTED PASS', '-', resultText(r));
    }

    // Test 13: verifyState (focused) - expect fail
    console.log('\n--- Test: verifyState (focused — should fail) ---');
    if (refs[0]) {
      const r = await send('tools/call', { name: 'browser_verify_state', arguments: { element: 'unfocused element', ref: refs[0], state: 'focused' } });
      console.log('Focused check:', !ok(r) ? 'Correctly FAILED' : 'UNEXPECTED PASS', '-', resultText(r));
    }

    // Test 14: Error case - verifyTextVisible with missing text
    console.log('\n--- Test: verifyTextVisible (should fail) ---');
    const r14 = await send('tools/call', { name: 'browser_verify_text_visible', arguments: { text: 'XYZZY_NONEXISTENT_12345' } });
    console.log('Missing text:', !ok(r14) ? 'Correctly FAILED' : 'UNEXPECTED PASS', '-', resultText(r14));

    // Test 15: verifyCount with count=0 for nonexistent text
    console.log('\n--- Test: verifyCount (zero count) ---');
    const r15 = await send('tools/call', { name: 'browser_verify_count', arguments: { text: 'XYZZY_NONEXISTENT_12345', count: 0 } });
    console.log('Count 0 for missing:', ok(r15) ? 'PASS' : 'FAIL', '-', resultText(r15));

    console.log('\n=== ALL DETAILED TESTS COMPLETE ===');
  } catch(e) {
    console.error('TEST ERROR:', e.message);
  } finally {
    proc.kill();
    setTimeout(() => process.exit(0), 500);
  }
}

main();
