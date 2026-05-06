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

// ═══════════════════════════════════════════════════════
// 产物收集器
// ═══════════════════════════════════════════════════════
const artifacts = {
  mcpLog: [],           // 原始 JSON-RPC 请求/响应
  addCodes: [],         // resolved locator 路径 (addCode)
  xpathData: [],        // xpath / fullXPath 数据
};

function saveArtifacts() {
  const outDir = path.join(__dirname, 'pipeline-demo', 'output');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  // 1. 原始 MCP JSON-RPC 日志
  fs.writeFileSync(
    path.join(outDir, 'raw-mcp-log.json'),
    JSON.stringify(artifacts.mcpLog, null, 2),
    'utf-8'
  );

  // 2. resolved locator 路径 (addCode)
  fs.writeFileSync(
    path.join(outDir, 'addcode-list.json'),
    JSON.stringify(artifacts.addCodes, null, 2),
    'utf-8'
  );

  // 3. xpath / fullXPath 数据
  fs.writeFileSync(
    path.join(outDir, 'xpath-data.json'),
    JSON.stringify(artifacts.xpathData, null, 2),
    'utf-8'
  );

  console.log(`\n产物已保存到 ${outDir}/`);
  console.log(`  raw-mcp-log.json   — ${artifacts.mcpLog.length} 条请求/响应`);
  console.log(`  addcode-list.json  — ${artifacts.addCodes.length} 条 addCode`);
  console.log(`  xpath-data.json    — ${artifacts.xpathData.length} 条 XPath`);
}

async function main(){
  await send('initialize',{protocolVersion:'1.0',clientInfo:{name:'t',version:'1.0.0'},capabilities:{}});

  // Step 0: Navigate
  console.log('=== Step 0: Navigate ===');
  await send('tools/call',{name:'browser_navigate',arguments:{url:URL}});

  // Step 1: Snapshot to get refs
  const snap=await send('tools/call',{name:'browser_snapshot',arguments:{}});
  const s=snap?.result?.content?.[0]?.text||'';
  console.log('Snapshot (first 2000 chars):');
  console.log(s.slice(0,2000));
  console.log('...\n');

  // Extract refs from snapshot
  const appleTag = s.match(/Apple/);
  const tableRef = s.match(/table\s+\[ref=([^\]]+)\]/);
  const paginatorRef = s.match(/navigation\s+\[ref=([^\]]+)\]/);
  const filterLabels = [...s.matchAll(/(?:label|checkbox|radio)\s+"([^"]*品牌[^"]*)"\s+\[ref=([^\]]+)\]/g)];
  const brandTags = [...s.matchAll(/(?:checkbox|button|link|label)\s+"(Apple|Samsung|Huawei|Xiaomi)"\s+\[ref=([^\]]+)\]/g)];

  console.log('=== Extracted Refs ===');
  console.log('table:', tableRef?.[1]);
  console.log('paginator:', paginatorRef?.[1]);
  console.log('filter labels:', filterLabels.map(m=>({name:m[1], ref:m[2]})));
  console.log('brand tags:', brandTags.map(m=>({name:m[1], ref:m[2]})));
  console.log('');

  // Helper to run a tool and print results
  let stepNum = 0;
  async function runTool(label, name, args) {
    stepNum++;
    console.log(`--- Step ${stepNum}: ${label} ---`);
    console.log(`  Tool: ${name}, Args: ${JSON.stringify(args)}`);
    const r = await send('tools/call', {name, arguments: args});
    if (!r) { console.log('  ERROR: 无响应\n'); return {r: null, code: null, xpathData: null}; }
    const code = extractCode(r);
    const text = fullText(r);
    const xp = extractXPath(r);
    console.log(`  Full output: ${text.slice(0,400)}`);
    if (code) console.log(`  addCode: ${code}`);
    if (xp) console.log(`  xpath: ${xp.xpath || '(empty)'}`);
    if (xp) console.log(`  fullXPath: ${xp.fullXPath || '(empty)'}`);
    console.log('');

    // ── 收集产物 ──
    artifacts.mcpLog.push({
      step: stepNum,
      label,
      request: r._request,
      response: { id: r.id, result: r?.result }
    });
    if (code) {
      artifacts.addCodes.push({
        step: stepNum,
        tool: name,
        label,
        addCode: code
      });
    }
    if (xp) {
      artifacts.xpathData.push({
        step: stepNum,
        tool: name,
        label,
        xpath: xp.xpath,
        fullXPath: xp.fullXPath
      });
    }

    return {r, code, xpathData: xp};
  }

  // ═══════════════════════════════════════════════════════
  // Phase 1: Precondition Verification
  // ═══════════════════════════════════════════════════════
  console.log('═══════ PHASE 1: Precondition Verification ═══════\n');

  // 1a. Page URL
  await runTool('Verify URL contains device-manager', 'browser_verify_page_url', {
    expected: 'device-manager', mode: 'contains'
  });

  // 1b. Page title text visible
  await runTool('Verify "设备管理" text visible', 'browser_verify_text_visible', {
    text: '设备管理'
  });

  // 1c. Verify filter panel exists and brand labels visible
  const filterPanelRef = s.match(/generic\s+\[ref=([^\]]+)\]\s*\n\s*- generic\s+\[ref=[^\]]+\]:\s+品牌/);
  if (s.includes('品牌')) {
    // Verify brand section heading exists
    await runTool('Verify "品牌" text visible in filter', 'browser_verify_text_visible', {
      text: '品牌'
    });
    await runTool('Verify "操作系统" text visible', 'browser_verify_text_visible', {
      text: '操作系统'
    });
  }

  // 1d. Verify heading shows "30" count
  await runTool('Verify "30" count badge visible', 'browser_verify_text_visible', {
    text: '30'
  });

  // 1e. Verify Apple/Samsung brand tags are visible in filter
  await runTool('Verify Apple tag visible', 'browser_verify_state', {
    element: 'Apple品牌标签', ref: 'e23', state: 'visible'
  });
  await runTool('Verify Samsung tag visible', 'browser_verify_state', {
    element: 'Samsung品牌标签', ref: 'e24', state: 'visible'
  });
  await runTool('Verify 华为 tag visible', 'browser_verify_state', {
    element: '华为品牌标签', ref: 'e25', state: 'visible'
  });

  // 1f. Verify table visible
  await runTool('Verify table visible', 'browser_verify_state', {
    element: '设备表格', ref: 'e89', state: 'visible'
  });

  // ═══════════════════════════════════════════════════════
  // Phase 2: Execution — Click Apple brand tag IN FILTER PANEL
  // ═══════════════════════════════════════════════════════
  console.log('═══════ PHASE 2: Execution — Click Apple ═══════\n');

  // Apple brand tag in filter panel: ref=e23 (generic with cursor=pointer)
  const appleFilterRef = s.match(/\[ref=e23\]\s+\[cursor=pointer\]:\s+Apple/);
  if (appleFilterRef) {
    await runTool('Click Apple brand filter tag', 'browser_click', {
      element: 'Apple品牌筛选标签', ref: 'e23'
    });
  } else {
    console.log('WARNING: ref=e23 Apple filter tag not found in expected format!');
  }

  // Small wait for UI update
  await new Promise(r => setTimeout(r, 1000));

  // ═══════════════════════════════════════════════════════
  // Phase 3: Expected Results Verification
  // ═══════════════════════════════════════════════════════
  console.log('═══════ PHASE 3: Expected Results ═══════\n');

  // Take fresh snapshot
  const snap2 = await send('tools/call',{name:'browser_snapshot',arguments:{}});
  const s2 = snap2?.result?.content?.[0]?.text||'';
  console.log('Post-click Snapshot (first 1500 chars):');
  console.log(s2.slice(0,1500));
  console.log('...\n');

  // 3a. Check heading count changed from "30"
  const countAfter = s2.match(/设备筛选\s+(\d+)/);
  console.log(`  Count badge before: "30", after: "${countAfter?.[1] || 'unknown'}"`);

  // 3b. Verify Apple still visible
  await runTool('Verify Apple still visible', 'browser_verify_text_visible', {
    text: 'Apple'
  });

  // 3c. Check non-Apple brands in filter panel status
  console.log('  Brand visibility after filter:');
  const brandCheck = ['Samsung', '华为', '小米', 'OPPO'];
  for (const brand of brandCheck) {
    if (s2.includes(brand)) {
      console.log(`    ${brand}: still present in page snapshot`);
    } else {
      console.log(`    ${brand}: NOT in page snapshot (filtered out)`);
    }
  }

  console.log('\n═══════ TEST COMPLETE ═══════');
  saveArtifacts();
  proc.kill();
}
main().catch(e => { console.error(e); proc.kill(); });
