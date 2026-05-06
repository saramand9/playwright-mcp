const { spawn } = require('child_process');
const CLI = 'D:/ai/ai_case-project/playwright-mcp/packages/playwright-mcp/cli.js';
const URL = 'http://localhost:8080/device-manager.html';
const proc = spawn('node', [CLI, '--headless', '--caps', 'core'], {stdio:['pipe','pipe','pipe'], env:{...process.env}});
let buf='',id=0;const pending=new Map();
proc.stdout.on('data',d=>{buf+=d.toString();const lines=buf.split('\n');buf=lines.pop();for(const l of lines){if(!l.trim())continue;try{const m=JSON.parse(l);if(m.id&&pending.has(m.id))pending.get(m.id)(m),pending.delete(m.id)}catch(e){}}});
function send(m,p){const i=++id;proc.stdin.write(JSON.stringify({jsonrpc:'2.0',id:i,method:m,params:p})+'\n');return new Promise(r=>{pending.set(i,r);setTimeout(()=>r(null),15000)});}
function extractCode(r){const t=(r?.result?.content||[]).map(c=>c.text).join('\n')||'';const m=t.match(/```js\n([^`]+)```/);return m?m[1].trim():null;}
async function main(){
  await send('initialize',{protocolVersion:'1.0',clientInfo:{name:'t'},capabilities:{}});
  await send('tools/call',{name:'browser_navigate',arguments:{url:URL}});
  const snap=await send('tools/call',{name:'browser_snapshot',arguments:{}});
  const s=snap?.result?.content?.[0]?.text||'';
  const btn=s.match(/button\s+"查询"\s+\[ref=([^\]]+)\]/);
  const link=s.match(/link\s+"🏠 首页"\s+\[ref=([^\]]+)\]/);
  const heading=s.match(/\[ref=(e3)\]/);
  const nav=s.match(/navigation\s+\[ref=([^\]]+)\]/);

  // Collect all code blocks
  let r, code, lines=[];
  const add = async (label, p) => {
    r = await send('tools/call', p);
    code = extractCode(r);
    if (code) { lines.push(`  // ${label}`); code.split('\n').forEach(l=>lines.push('  '+l)); lines.push(''); }
  };

  await add('1. 验证页面标题可见', {name:'browser_verify_text_visible',arguments:{text:'设备管理'}});
  await add('2. 验证 URL', {name:'browser_verify_page_url',arguments:{expected:'device-manager',mode:'contains'}});
  if(heading) await add('3. 验证标题状态 (attached)', {name:'browser_verify_state',arguments:{element:'页面标题',ref:heading[1],state:'attached'}});
  if(btn) await add('4. 验证查询按钮 (enabled)', {name:'browser_verify_state',arguments:{element:'查询按钮',ref:btn[1],state:'enabled'}});
  if(link) await add('5. 验证首页链接属性 (href)', {name:'browser_verify_attribute',arguments:{element:'首页链接',ref:link[1],name:'href',expected:'index.html'}});
  if(link) await add('6. 验证首页链接样式 (cursor)', {name:'browser_verify_css',arguments:{element:'首页链接',ref:link[1],property:'cursor',expected:'pointer'}});
  if(link) await add('7. 验证首页链接文本', {name:'browser_verify_text',arguments:{element:'首页链接',ref:link[1],text:'🏠 首页',mode:'equals'}});
  if(nav) await add('8. 验证导航栏存在', {name:'browser_verify_count',arguments:{element:'导航栏',ref:nav[1],count:1,operator:'greater_than_or_equal'}});
  await add('9. 验证 Apple 数据存在', {name:'browser_verify_count',arguments:{text:'Apple',count:1,operator:'greater_than_or_equal'}});

  // Output final .spec.ts
  console.log("import { test, expect } from '@playwright/test';");
  console.log("const { robustLocate } = require('./helpers/repair-helper.js');");
  console.log('');
  console.log("const BASE_URL = 'http://127.0.0.1:8765/device-manager.html';");
  console.log('');
  console.log("test.describe('设备管理 — 页面验证', () => {");
  console.log('');
  console.log("  test.beforeEach(async ({ page }) => {");
  console.log("    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });");
  console.log("  });");
  console.log('');
  console.log("  test('页面元素断言验证', async ({ page }) => {");
  console.log("    test.setTimeout(180_000);");
  console.log('');
  console.log(lines.join('\n'));
  console.log('  });');
  console.log('});');

  proc.kill();
}
main();
