const { spawn } = require('child_process');
const proc = spawn('node', ['D:/ai/ai_case-project/playwright-mcp/packages/playwright-mcp/cli.js', '--headless', '--caps', 'core'], {stdio:['pipe','pipe','pipe'], env:{...process.env}});
let buf='',id=0;const pending=new Map();
proc.stdout.on('data',d=>{buf+=d.toString();const lines=buf.split('\n');buf=lines.pop();for(const l of lines){if(!l.trim())continue;try{const m=JSON.parse(l);if(m.id&&pending.has(m.id))pending.get(m.id)(m),pending.delete(m.id)}catch(e){}}});
proc.stderr.on('data',d=>{});
function send(m,p){const i=++id;proc.stdin.write(JSON.stringify({jsonrpc:'2.0',id:i,method:m,params:p})+'\n');return new Promise(r=>{pending.set(i,r);setTimeout(()=>r(null),15000)});}
async function main(){
  await send('initialize',{protocolVersion:'1.0',clientInfo:{name:'t'},capabilities:{}});
  await send('tools/call',{name:'browser_navigate',arguments:{url:'http://localhost:8080/device-manager.html'}});
  const snap=await send('tools/call',{name:'browser_snapshot',arguments:{}});
  const snapText=snap?.result?.content?.[0]?.text||'';
  const btnQuery=snapText.match(/button\s+"查询"\s+\[ref=([^\]]+)\]/);
  const linkHome=snapText.match(/link\s+"([^"]*首页[^"]*)"\s+\[ref=([^\]]+)\]/);
  const heading=snapText.match(/\[ref=(e3)\]/);

  console.log('═══════ verifyState (enabled) ═══════');
  if(btnQuery){
    const r=await send('tools/call',{name:'browser_verify_state',arguments:{element:'查询按钮',ref:btnQuery[1],state:'enabled'}});
    const code=(r?.result?.content||[]).map(c=>c.text).join('\n');
    const m=code.match(/```js\n([^`]+)```/); console.log(m?m[1].trim():code.slice(0,400));
  }

  console.log('\n═══════ verifyCSS ═══════');
  if(linkHome){
    const r=await send('tools/call',{name:'browser_verify_css',arguments:{element:'首页链接',ref:linkHome[2],property:'cursor',expected:'pointer'}});
    const code=(r?.result?.content||[]).map(c=>c.text).join('\n');
    const m=code.match(/```js\n([^`]+)```/); console.log(m?m[1].trim():code.slice(0,400));
  }

  console.log('\n═══════ verifyText (contains) ═══════');
  if(heading){
    const r=await send('tools/call',{name:'browser_verify_text',arguments:{element:'页面标题',ref:heading[1],text:'设备管理',mode:'contains'}});
    const code=(r?.result?.content||[]).map(c=>c.text).join('\n');
    const m=code.match(/```js\n([^`]+)```/); console.log(m?m[1].trim():code.slice(0,400));
  }

  console.log('\n═══════ verifyCount (scoped) ═══════');
  const nav=snapText.match(/navigation\s+\[ref=([^\]]+)\]/);
  if(nav){
    const r=await send('tools/call',{name:'browser_verify_count',arguments:{element:'导航栏',ref:nav[1],count:1,operator:'greater_than_or_equal'}});
    const code=(r?.result?.content||[]).map(c=>c.text).join('\n');
    const m=code.match(/```js\n([^`]+)```/); console.log(m?m[1].trim():code.slice(0,400));
  }

  proc.kill();
}
main();
