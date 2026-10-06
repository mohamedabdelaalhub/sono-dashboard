const {JSDOM}=require('jsdom'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const base=path.resolve(__dirname,'..'),key='sono_branch_setup_calculator_v2';
const pause=()=>new Promise(r=>setTimeout(r,20));
function app(saved){
  const dom=new JSDOM('<body><nav id="tabs"></nav></body>',{url:'https://example.test/',runScripts:'outside-only'}),w=dom.window;
  w.confirm=()=>true;if(saved)w.localStorage.setItem(key,saved);
  w.SonoAuth={client:()=>null,user:()=>null,mode:()=> 'local'};
  w.eval(fs.readFileSync(base+'/assets/js/study-store.js','utf8'));
  w.eval(fs.readFileSync(base+'/assets/js/branch-calculator.js','utf8'));
  return dom;
}
(async()=>{
  let dom=app();await pause();const w=dom.window,d=w.document;
  const input=(el,value)=>{el.value=value;el.dispatchEvent(new w.Event('input',{bubbles:true}));};
  d.getElementById('branchCalcBtn').click();d.getElementById('bcNavEditor').click();
  const other=d.querySelectorAll('[data-section]')[1];
  d.querySelector('[data-add]').click();assert.equal(d.querySelectorAll('[data-section]')[1],other);
  input(d.querySelector('[data-k="name"]'),'جهاز');input(d.querySelector('[data-k="qty"]'),'4');input(d.querySelector('[data-k="unit"]'),'123.5');
  assert(d.getElementById('branchCalcTotal').textContent.includes('494'));
  d.querySelector('[data-toggle]').click();assert.equal(d.querySelector('[data-toggle]').getAttribute('aria-expanded'),'false');
  input(d.getElementById('branchCalcName'),'فرع تجريبي');
  d.getElementById('branchCalcClose').click();const saved=w.localStorage.getItem(key);assert(saved.includes('فرع تجريبي'));
  d.getElementById('branchCalcBtn').click();await d.getElementById('bcSave').onclick();assert.equal(JSON.parse(w.localStorage.getItem(key)).studies.length,1);
  let blob;w.Blob=Blob;w.URL.createObjectURL=b=>{blob=b;return 'blob:test'};w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=function(){};
  d.getElementById('bcBackup').click();const backup=JSON.parse(await blob.text());assert.equal(backup.version,2);assert.equal(backup.studies[0].name,'فرع تجريبي');
  const file={size:100,text:async()=>JSON.stringify(backup)};
  await d.getElementById('bcImportFile').onchange({target:{files:[file]}});
  assert.equal(JSON.parse(w.localStorage.getItem(key)).studies.length,2);
  const latest=w.localStorage.getItem(key);dom.window.close();dom=app(latest);await pause();dom.window.document.getElementById('branchCalcBtn').click();assert(dom.window.document.getElementById('branchCalcTotal').textContent.includes('494'));dom.window.close();
  console.log('PASS calculator totals, partial DOM update, collapse, close/reload persistence, save, JSON backup and restore');
})().catch(e=>{console.error(e);process.exitCode=1;});
