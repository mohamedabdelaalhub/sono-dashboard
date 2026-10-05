const fs = require('fs'), path = require('path'), assert = require('node:assert/strict');
const {JSDOM} = require('jsdom'); // Test-only dependency; no change to the dashboard runtime.
const base = path.resolve(__dirname, '..');
const dom = new JSDOM(fs.readFileSync(base + '/index.html', 'utf8'), {url:'https://example.test/',runScripts:'outside-only'});
const w = dom.window, d = w.document, errors = [];
w.alert = m => errors.push(m);
const load = name => w.eval(fs.readFileSync(base + '/assets/js/' + name + '.js', 'utf8'));
for (const name of ['parser','analytics','reports','parser-auto','adapters','data-integrity','privacy','insights','rules','roles','schedule','compute-logic','compute','charts','render','render-reports']) load(name);
w.SonoAuth = {mode:()=> 'local', user:()=>({id:'test',role:'سوبر أدمن'}),restore:async()=>null,isRecovery:()=>false};
w.SonoBrand = {mount(){}};
w.SonoAdmins = {init(){}};
w.SonoSettings = {};
let exported;
w.SonoExport = {toXlsx(a,e,ctx,datasets){exported = datasets;}};
load('app');
const pause = () => new Promise(resolve=>setTimeout(resolve,90));
const change = (id,value) => {d.getElementById(id).value=value;d.getElementById(id).dispatchEvent(new w.Event('change'));};
const income = (date,amount) => ({date,amount,receipt:'1',fileNo:'1',services:['كشف'],supplies:[],method:'نقدي'});
const expense = {date:'2026-09-15',amount:30,doctor:'دكتور',bayan:'أتعاب',cat:'أتعاب أطباء',group:'متغيّر'};
const period = (from,to) => ({from:new w.Date(from),to:new w.Date(to)});
const dataset = {id:'statusDetail',name:'بيان تفصيلي',file:'details.xlsx',sheet:'Sheet1',columns:['date','total','doctor','service'],group:'الخدمات',rows:[{date:'2026-08-01',total:100,doctor:'دكتور',service:'كشف'},{date:'2026-09-01',total:200,doctor:'دكتور',service:'كشف'}]};
(async()=>{
  await pause();
  const app=w.SonoApp,s=app.state;
  s.files=[{kind:'treasury',name:'cash.xlsx',income:[income('2026-08-01',100),income('2026-09-01',200)],expense:[expense],period:period('2026-08-01','2026-09-30')},{kind:'report',name:'details.xlsx',sourceFile:'details.xlsx',sourceSheet:'Sheet1',reportName:'بيان',income:[],expense:[],rows:2}];
  s.datasets=[dataset];app.rebuild();await pause();change('gran','all');await pause();
  assert.equal(s.A.kpi.revenue,300); // alternate representation is excluded
  assert(d.getElementById('pane-sum').textContent.includes('استُبعد'));
  change('gran','month');await pause();
  assert.equal(s.A.kpi.revenue,200);
  assert.equal(s.activeDatasets[0].rows.length,1);
  assert.equal(s.A.ins,s.ins);
  app.renderTab('rep');
  const september=d.getElementById('pane-rep').textContent;
  change('period','M|2026-08');await pause();
  assert.equal(s.A.kpi.revenue,100);
  assert.equal(s.activeDatasets[0].rows[0].total,100);
  assert.notEqual(d.getElementById('pane-rep').textContent,september); // invalidated report cache
  d.getElementById('btnXlsx').click();await pause();
  assert.equal(exported[0].rows[0].total,100);
  change('gran','custom');await pause();
  change('dFrom','2026-09-01');change('dTo','2026-09-30');await pause();
  assert.equal(s.A.kpi.revenue,200);
  assert.equal(s.activeDatasets[0].rows[0].total,200);
  // Same-month fee files need not have a payment on the first or last day.
  s.files.push({kind:'status',name:'summary.xlsx',income:[],expense:[],status:[{doctor:'دكتور',net:200,gross:200,discount:0,qty:1,service:'كشف'}],period:period('2026-09-01','2026-09-30')});
  app.rebuild();await pause();change('gran','month');await pause();
  assert.equal(s.A.status.matched,1);
  s.files[2].period=period('2026-08-01','2026-08-31');
  change('gran','all');await pause();
  assert(s.A.status.periodMismatch);
  assert.equal(s.A.status.matched,0);
  // Remove a report chip and check its rows disappear from future analyses.
  d.querySelector('#fileChips button[data-i="1"]').click();await pause();
  assert.equal(s.datasets.length,0);
  assert.equal(s.activeDatasets.length,0);
  assert.equal(s.ins.has,false);
  // Opening an archive clears raw report data before any export.
  s.files=[{kind:'treasury',name:'cash.xlsx',income:[income('2026-09-01',999)],expense:[]}];s.datasets=[dataset];app.rebuild();await pause();
  let handlers;w.SonoRender.renderArchive=(el,state,h)=>{handlers=h;};
  const archivedA=w.SonoAnalytics.analyze([income('2026-07-01',17)],[],{});archivedA.ins={has:false,modules:[]};
  w.SonoArchive={load:async()=>({A:archivedA,E:w.SonoRules.evaluate(archivedA,null),cmp:null,title:'محفوظ'})};
  app.renderTab('arch');await handlers.open('archive-id');
  assert.equal(s.A.kpi.revenue,17);assert.equal(s.files.length,0);assert.equal(s.datasets.length,0);assert.equal(s.activeDatasets.length,0);
  d.getElementById('btnXlsx').click();await pause();assert.equal(exported.length,0);
  d.getElementById('btnClear').click();
  assert.equal(s.A,null);assert.equal(s.ins,null);assert.equal(s.datasets.length,0);
  assert.deepEqual(errors,[]);
  console.log('PASS app UI period changes, summary/report rendering, scoped export, fee coverage, file removal and clear');
  dom.window.close();
})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1;});
