const {Worker}=require('node:worker_threads'),fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('node:assert/strict');
const XLSX=require('xlsx'),xlsxPath=require.resolve('xlsx');
const base=path.resolve(__dirname,'../assets/js');
const bootstrap=`const {parentPort}=require('node:worker_threads'),fs=require('fs'),vm=require('vm');global.self=global;global.importScripts=(...names)=>names.forEach(n=>{if(n.startsWith('https:')){global.XLSX=require(${JSON.stringify(xlsxPath)});return;}vm.runInThisContext(fs.readFileSync(${JSON.stringify(base)}+'/'+n.split('?')[0],'utf8'),{filename:n});});global.postMessage=data=>parentPort.postMessage(data);vm.runInThisContext(fs.readFileSync(${JSON.stringify(base+'/compute-worker.js')},'utf8'));parentPort.on('message',data=>self.onmessage({data}));`;
(async()=>{
  const worker=new Worker(bootstrap,{eval:true});
  const payload={cur:{income:[{date:'2026-09-01',amount:100,method:'نقدي',receipt:'1',fileNo:'1',patient:'',services:['كشف'],supplies:[]}],expense:[]},prev:null,label:'test',datasets:[],doctorRevenue:{},statusRows:[],periods:{},periodExcluded:[]};
  const result=await new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);worker.postMessage({id:1,task:'analyze',payload});});
  assert(!result.error);assert.equal(result.result.A.kpi.revenue,100);assert(result.result.A.meta.from instanceof Date);
  const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['التخصص','اسم الطبيب','الدرجة','سعر الكشف','الأيام','المواعيد','الهاتف','الخدمات'],['باطنة','أحمد محمود','استشاري',300,'السبت','09:00 - 12:00','','كشف']]),'جدول التخصصات');
  const buffer=XLSX.write(book,{type:'buffer',bookType:'xlsx'});
  const parsed=await new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);worker.postMessage({id:2,task:'parseReport',payload:{buffer,fileName:'schedule.xlsx'}});});
  assert(!parsed.error);assert.equal(parsed.result.kind,'schedule');assert.equal(parsed.result.data.doctors.length,1);
  const ctx={window:{XLSX},XLSX,TextDecoder,console,setTimeout,clearTimeout};vm.createContext(ctx);
  for(const n of ['parser','parser-status','parser-meta','parser-auto','schedule','analytics','reports','data-integrity','privacy','insights','rules','compute-logic','compute'])vm.runInContext(fs.readFileSync(base+'/'+n+'.js','utf8'),ctx);
  const fallback=await ctx.window.SonoCompute.run('analyze',payload);assert.equal(fallback.A.kpi.revenue,result.result.A.kpi.revenue);assert.equal(fallback.E.score,result.result.E.score);
  const parsedFallback=await ctx.window.SonoCompute.run('parseReport',{buffer,fileName:'schedule.xlsx'});assert.equal(parsedFallback.kind,parsed.result.kind);assert.equal(parsedFallback.data.doctors[0].price,parsed.result.data.doctors[0].price);
  await worker.terminate();console.log('PASS worker execution, structured Date results and main-thread fallback parity and actual Excel schedule reading');
})().catch(e=>{console.error(e);process.exitCode=1;});
