const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
let log=[],reply={data:{id:'cloud-id'},error:null};
function query(){
 const q={then(resolve,reject){return Promise.resolve(reply).then(resolve,reject);}};
 for(const method of ['select','eq','order','limit','insert','update','maybeSingle'])q[method]=(...args)=>{log.push({method,args});return q;};
 return q;
}
const user={id:'user-id',name:'test'},sb={from(name){assert.equal(name,'reports');return query();}};
const ctx={window:{SonoAuth:{client:()=>sb,user:()=>user,mode:()=> 'supabase'},SonoRoles:{can:()=>true}}};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../assets/js/study-store.js'),'utf8'),ctx);
(async()=>{
 const store=ctx.window.SonoStudyStore,study={id:'local-id',name:'دراسة',sections:[]};
 assert(store.ready());const cloud=await store.save(study);assert.equal(cloud.cloudId,'cloud-id');
 assert(log.some(x=>x.method==='insert'));assert(log.find(x=>x.method==='insert').args[0].payload.kind==='branch-study');
 log=[];await store.save({...study,...cloud});assert(log.some(x=>x.method==='update'));assert(log.some(x=>x.method==='eq'&&x.args[0]==='created_by'&&x.args[1]===user.id));assert(log.some(x=>x.method==='eq'&&x.args[0]==='payload->>updatedAt'));
 reply={data:null,error:null};await assert.rejects(()=>store.save({...study,...cloud}),/جهاز آخر/);
 reply={data:[{id:'cloud-id',payload:{study,updatedAt:'now'}}],error:null};log=[];const list=await store.list();assert.equal(list.length,1);assert(log.some(x=>x.method==='eq'&&x.args[0]==='payload->>kind'&&x.args[1]==='branch-study'));
 reply={data:null,error:{message:'offline'}};await assert.rejects(()=>store.save(study),/الجهاز/);
 console.log('PASS account study insert/update, owner scoping, optimistic conflict handling, filtering and offline errors');
})().catch(e=>{console.error(e);process.exitCode=1;});
