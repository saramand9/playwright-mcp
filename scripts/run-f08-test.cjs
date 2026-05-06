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
  fs.writeFileSync(path.join(outDir, 'f08-raw-mcp-log.json'), JSON.stringify(artifacts.mcpLog, null, 2), 'utf-8');
  fs.writeFileSync(path.join(outDir, 'f08-addcode-list.json'), JSON.stringify(artifacts.addCodes, null, 2), 'utf-8');
  fs.writeFileSync(path.join(outDir, 'f08-xpath-data.json'), JSON.stringify(artifacts.xpathData, null, 2), 'utf-8');
  console.log(`\n产物已保存:`);
  console.log(`  f08-raw-mcp-log.json  — ${artifacts.mcpLog.length} 条`);
  console.log(`  f08-addcode-list.json — ${artifacts.addCodes.length} 条`);
  console.log(`  f08-xpath-data.json   — ${artifacts.xpathData.length} 条`);
}

async function main(){
  await send('initialize',{protocolVersion:'1.0',clientInfo:{name:'t',version:'1.0.0'},capabilities:{}});
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
    if (name === 'browser_evaluate') console.log(`  evalResult: ${text}`);
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

  await runTool('Verify "运行内存" filter label visible', 'browser_verify_text_visible', {
    text: '运行内存'
  });

  await runTool('Verify "存储容量" filter label visible', 'browser_verify_text_visible', {
    text: '存储容量'
  });

  await runTool('Verify "设备状态" filter label visible', 'browser_verify_text_visible', {
    text: '设备状态'
  });

  await runTool('Verify "30" count badge visible', 'browser_verify_text_visible', {
    text: '30'
  });

  await runTool('Verify table visible', 'browser_verify_state', {
    element: '设备表格', ref: 'e89', state: 'visible'
  });

  await runTool('Verify paginator visible', 'browser_verify_state', {
    element: '分页器', ref: 'e289', state: 'visible'
  });

  // ═══════════════════════════════════════════════════════
  // Phase 2: 执行 — 展开更多筛选 + 输入价格范围 + 查询
  // ═══════════════════════════════════════════════════════
  console.log('\n═══════ PHASE 2: Execution ═══════');

  // Step: Expand more filters via evaluate (browser_click hits parent div, not span with onclick)
  await runTool('Expand more filters (toggleExtended)', 'browser_evaluate', {
    function: 'toggleExtended()'
  });

  // CRITICAL: Take fresh snapshot after expand to get correct spinbutton refs
  const snapExpanded = await send('tools/call',{name:'browser_snapshot',arguments:{}});
  const sExp = snapExpanded?.result?.content?.[0]?.text||'';

  // Find price spinbutton refs from expanded snapshot
  // Pattern: "价格区间" label followed by two spinbuttons
  const priceSectionIdx = sExp.indexOf('价格区间');
  let minPriceRef, maxPriceRef;
  if (priceSectionIdx >= 0) {
    const priceSection = sExp.slice(priceSectionIdx, priceSectionIdx + 500);
    const spinbuttons = [...priceSection.matchAll(/spinbutton\s+\[ref=([^\]]+)\]/g)];
    console.log(`\n  Price section spinbuttons: ${JSON.stringify(spinbuttons.map(m=>m[1]))}`);
    if (spinbuttons.length >= 2) {
      minPriceRef = spinbuttons[0][1];
      maxPriceRef = spinbuttons[1][1];
    }
  }

  // Now type price range using browser_evaluate (browser_type is broken on spinbutton — extractXPath not defined)
  // Strategy: find ALL number inputs on the page, pick the two closest to "价格区间" text
  if (minPriceRef && maxPriceRef) {
    await runTool('Set min price 3000 and max price 8000 via evaluate', 'browser_evaluate', {
      function: `(() => {
        // Try multiple strategies to find price inputs
        let found = [];
        // Strategy 1: by ID
        const byId = document.querySelectorAll('#filter-price-min, #filter-price-max, #price-min, #price-max, [id*="price"]');
        if (byId.length >= 2) found = [byId[0], byId[1]];
        // Strategy 2: number inputs in extended-filters
        if (found.length < 2) {
          const inExtended = document.querySelectorAll('#extended-filters input[type="number"]');
          if (inExtended.length >= 2) found = [inExtended[0], inExtended[1]];
        }
        // Strategy 3: all number inputs
        if (found.length < 2) {
          const allNum = document.querySelectorAll('input[type="number"]');
          if (allNum.length >= 2) found = [allNum[0], allNum[1]];
        }
        if (found.length >= 2) {
          found[0].value = '3000';
          found[0].dispatchEvent(new Event('input', { bubbles: true }));
          found[0].dispatchEvent(new Event('change', { bubbles: true }));
          found[1].value = '8000';
          found[1].dispatchEvent(new Event('input', { bubbles: true }));
          found[1].dispatchEvent(new Event('change', { bubbles: true }));
          return 'OK: set ' + (found[0].id||found[0].name||'input0') + '=3000, ' + (found[1].id||found[1].name||'input1') + '=8000';
        }
        return 'FAIL: found ' + found.length + ' number inputs total. IDs: ' + JSON.stringify(Array.from(document.querySelectorAll('input[type="number"]')).map(e => e.id||e.name||'(none)'));
      })()`
    });
  } else {
    console.log('  WARNING: Could not find price spinbutton refs!');
  }

  // Click "查询" button
  await runTool('Click "查询" button', 'browser_click', {
    element: '查询按钮', ref: 'e82'
  });

  // Wait for table update
  await new Promise(r => setTimeout(r, 1500));

  // ═══════════════════════════════════════════════════════
  // Phase 3: 预期结果验证
  // ═══════════════════════════════════════════════════════
  console.log('\n═══════ PHASE 3: Expected Results ═══════');

  const snap3 = await send('tools/call',{name:'browser_snapshot',arguments:{}});
  const s3 = snap3?.result?.content?.[0]?.text||'';

  // Check count changed
  const countMatch = s3.match(/设备筛选\s+(\d+)/);
  const newCount = countMatch?.[1] || 'unknown';
  console.log(`\n  设备计数: 筛选前=30, 筛选后=${newCount}`);

  // Verify count changed
  if (newCount !== '30') {
    await runTool('Verify filtered result count changed', 'browser_verify_text_visible', {
      text: newCount
    });
  }

  // Verify "查询" button still visible
  await runTool('Verify "查询" button still visible', 'browser_verify_state', {
    element: '查询按钮', ref: 'e82', state: 'visible'
  });

  // Check all visible prices in the table are between 3000-8000
  const priceCells = [...s3.matchAll(/cell\s+"¥(\d+)"\s+\[ref=([^\]]+)\]/g)];
  console.log('\n  Price cells in filtered table:');
  let allInRange = true;
  for (const [, priceStr, ref] of priceCells) {
    const price = parseInt(priceStr);
    const inRange = price >= 3000 && price <= 8000;
    if (!inRange) allInRange = false;
    console.log(`    ¥${priceStr} [${ref}] ${inRange ? '✓' : '✗ OUT OF RANGE'}`);
  }
  console.log(`  Total visible rows: ${priceCells.length}`);
  console.log(`  All in range (3000-8000): ${allInRange ? 'YES ✓' : 'NO ✗'}`);

  console.log('\n═══════ TEST COMPLETE ═══════');
  saveArtifacts();
  proc.kill();
}
main().catch(e => { console.error(e); proc.kill(); });
