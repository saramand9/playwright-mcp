const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const CLI = 'D:/ai/ai_case-project/playwright-mcp/packages/playwright-mcp/cli.js';
const URL = 'http://localhost:8080/device-manager.html';
const proc = spawn('node', [CLI, '--headless', '--caps', 'core'], {stdio:['pipe','pipe','pipe'], env:{...process.env}});
let buf='',id=0;const pending=new Map();
proc.stdout.on('data',d=>{buf+=d.toString();const lines=buf.split('\n');buf=lines.pop();for(const l of lines){if(!l.trim())continue;try{const m=JSON.parse(l);if(m.id&&pending.has(m.id))pending.get(m.id)(m),pending.delete(m.id)}catch(e){}}});
proc.stderr.on('data',d=>process.stderr.write(d));
function send(m,p){const i=++id;const req={jsonrpc:'2.0',id:i,method:m,params:p};proc.stdin.write(JSON.stringify(req)+'\n');return new Promise(resolve=>{pending.set(i,msg=>{msg._request=req;resolve(msg);});setTimeout(()=>resolve(null),15000)});}
function extractCode(r){const t=(r?.result?.content||[]).map(c=>c.text).join('\n')||'';const m=t.match(/```js\n([^`]+)```/);return m?m[1].trim():null;}
function fullText(r){return (r?.result?.content||[]).map(c=>c.text).join('\n')||'';}
function extractXPath(r){const t=fullText(r);const m=t.match(/\{"xpath":".*?","fullXPath":".*?"\}/);return m?JSON.parse(m[0]):null;}

const artifacts = { mcpLog: [], addCodes: [], xpathData: [] };

function saveArtifacts() {
  const outDir = path.join(__dirname, 'pipeline-demo', 'output');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'tc027-raw-mcp-log.json'), JSON.stringify(artifacts.mcpLog, null, 2), 'utf-8');
  fs.writeFileSync(path.join(outDir, 'tc027-addcode-list.json'), JSON.stringify(artifacts.addCodes, null, 2), 'utf-8');
  fs.writeFileSync(path.join(outDir, 'tc027-xpath-data.json'), JSON.stringify(artifacts.xpathData, null, 2), 'utf-8');
  console.log(`\n产物已保存:`);
  console.log(`  tc027-raw-mcp-log.json  — ${artifacts.mcpLog.length} 条`);
  console.log(`  tc027-addcode-list.json — ${artifacts.addCodes.length} 条`);
  console.log(`  tc027-xpath-data.json   — ${artifacts.xpathData.length} 条`);
}

async function main(){
  await send('initialize',{protocolVersion:'1.0',clientInfo:{name:'t',version:'1.0.0'},capabilities:{}});
  console.log('=== TC-027: 表格-数值排序-按价格列排序 ===\n');
  console.log('=== Step 0: Navigate ===');
  await send('tools/call',{name:'browser_navigate',arguments:{url:URL}});

  let stepNum = 0;
  async function runTool(label, name, args) {
    stepNum++;
    console.log(`\n--- Step ${stepNum}: ${label} ---`);
    console.log(`  Tool: ${name}`);
    console.log(`  Args: ${JSON.stringify(args)}`);
    const r = await send('tools/call', {name, arguments: args});
    if (!r) { console.log('  ERROR: 无响应'); return {r: null, code: null, xpathData: null}; }
    const code = extractCode(r);
    const text = fullText(r);
    const xp = extractXPath(r);
    console.log(`  addCode: ${code || '(none)'}`);
    if (name === 'browser_evaluate') console.log(`  evalResult: ${(text||'').slice(0,200)}`);
    if (xp) console.log(`  xpath:   ${xp.xpath || '(empty)'}`);
    if (xp) console.log(`  fullXPath: ${xp.fullXPath || '(empty)'}`);

    artifacts.mcpLog.push({ step: stepNum, label, request: r._request, response: { id: r.id, result: r?.result } });
    if (code) artifacts.addCodes.push({ step: stepNum, tool: name, label, addCode: code });
    if (xp) artifacts.xpathData.push({ step: stepNum, tool: name, label, xpath: xp.xpath, fullXPath: xp.fullXPath });
    return {r, code, xpathData: xp};
  }

  // ═══════════════════════════════════════════════════════
  // Phase 1: 前置验证
  // ═══════════════════════════════════════════════════════
  console.log('\n═══════ PHASE 1: Precondition Verification ═══════');

  await runTool('Verify URL contains device-manager', 'browser_verify_page_url', {
    expected: 'device-manager', mode: 'contains'
  });

  await runTool('Verify "设备管理" text visible', 'browser_verify_text_visible', {
    text: '设备管理'
  });

  await runTool('Verify "品牌" filter label visible', 'browser_verify_text_visible', {
    text: '品牌'
  });

  await runTool('Verify "操作系统" filter label visible', 'browser_verify_text_visible', {
    text: '操作系统'
  });

  await runTool('Verify "30" count badge visible', 'browser_verify_text_visible', {
    text: '30'
  });

  // Get initial snapshot for table ref and price header ref
  const snap1 = await send('tools/call',{name:'browser_snapshot',arguments:{}});
  const s1 = snap1?.result?.content?.[0]?.text||'';

  // Find price column header ref
  // Look for "价格" in table header row, then find the columnheader ref
  const priceHeaderMatch = s1.match(/columnheader\s+"价格[^"]*"\s+\[ref=([^\]]+)\]/);
  const priceHeaderRef = priceHeaderMatch?.[1];
  console.log(`\n  价格列表头 ref: ${priceHeaderRef || '(not found)'}`);

  // Also look for any cell with ¥ to verify table content
  const tableRefMatch = s1.match(/table\s+\[ref=([^\]]+)\]/);
  console.log(`  表格 ref: ${tableRefMatch?.[1] || '(not found)'}`);

  await runTool('Verify table visible', 'browser_verify_state', {
    element: '设备表格', ref: 'e89', state: 'visible'
  });

  await runTool('Verify paginator visible', 'browser_verify_state', {
    element: '分页器', ref: 'e289', state: 'visible'
  });

  // ═══════════════════════════════════════════════════════
  // Phase 2: 执行 — 点击价格表头排序
  // ═══════════════════════════════════════════════════════
  console.log('\n═══════ PHASE 2: Execution — Click Price Header ═══════');

  if (!priceHeaderRef) {
    console.log('  ERROR: Price header ref not found in snapshot!');
    console.log('  Looking for "价格" in snapshot...');
    const priceIdx = s1.indexOf('价格');
    if (priceIdx >= 0) console.log(s1.slice(priceIdx, priceIdx + 300));
  }

  // First click: sort ascending
  await runTool('Click price column header (ascending)', 'browser_click', {
    element: '价格列表头', ref: priceHeaderRef || 'e93'
  });

  // Wait for sort to take effect
  await new Promise(r => setTimeout(r, 1000));

  // Take snapshot after first sort
  const snapAsc = await send('tools/call',{name:'browser_snapshot',arguments:{}});
  const sAsc = snapAsc?.result?.content?.[0]?.text||'';

  // Extract price cells from sorted table
  const priceCellsAsc = [...sAsc.matchAll(/cell\s+"¥(\d+)"\s+\[ref=([^\]]+)\]/g)];
  const pricesAsc = priceCellsAsc.map(([, price]) => parseInt(price));
  const isAscending = pricesAsc.every((p, i) => i === 0 || p >= pricesAsc[i-1]);
  console.log(`\n  升序价格: [${pricesAsc.join(', ')}]`);
  console.log(`  升序验证: ${isAscending ? '✓ 严格升序' : '✗ 非升序'}`);

  // Verify the price header now shows sort indicator
  const headerStateAsc = sAsc.match(new RegExp(`columnheader\\s+"价格[^"]*"\\s+\\[ref=([^\\]]+)\\]`));
  const newPriceRef = headerStateAsc?.[1];
  console.log(`  排序后表头 ref: ${newPriceRef || '(not found, reusing old)'}`);

  // Second click: sort descending (use fresh ref if available)
  await runTool('Click price column header (descending)', 'browser_click', {
    element: '价格列表头', ref: newPriceRef || priceHeaderRef || 'e102'
  });

  // Wait for sort to take effect
  await new Promise(r => setTimeout(r, 1000));

  // Take snapshot after second sort
  const snapDesc = await send('tools/call',{name:'browser_snapshot',arguments:{}});
  const sDesc = snapDesc?.result?.content?.[0]?.text||'';

  // Extract price cells from descending sorted table
  const priceCellsDesc = [...sDesc.matchAll(/cell\s+"¥(\d+)"\s+\[ref=([^\]]+)\]/g)];
  const pricesDesc = priceCellsDesc.map(([, price]) => parseInt(price));
  const isDescending = pricesDesc.every((p, i) => i === 0 || p <= pricesDesc[i-1]);
  console.log(`\n  降序价格: [${pricesDesc.join(', ')}]`);
  console.log(`  降序验证: ${isDescending ? '✓ 严格降序' : '✗ 非降序'}`);

  // ═══════════════════════════════════════════════════════
  // Phase 3: 预期结果验证
  // ═══════════════════════════════════════════════════════
  console.log('\n═══════ PHASE 3: Expected Results ═══════');

  // Verify table still visible
  await runTool('Verify table still visible after sort', 'browser_verify_state', {
    element: '设备表格', ref: 'e89', state: 'visible'
  });

  // Verify count still 30 (sorting doesn't filter)
  await runTool('Verify count still 30', 'browser_verify_text_visible', {
    text: '30'
  });

  console.log(`\n═══════ TEST COMPLETE ═══════`);
  console.log(`  升序: ${isAscending ? 'PASS ✓' : 'FAIL ✗'}`);
  console.log(`  降序: ${isDescending ? 'PASS ✓' : 'FAIL ✗'}`);
  saveArtifacts();
  proc.kill();
}
main().catch(e => { console.error(e); proc.kill(); });
