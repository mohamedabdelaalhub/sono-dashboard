const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('path').resolve(__dirname,'../assets/js/study-store.js'),'utf8');
let calls=[],fault=null;
const study={id:'local',name:'فرع',sections:[]};
const row={id:'cloud',study,version:2,updated_at:'now',owner_id:'owner',owner_name:'صاحب الدراسة',permission:'edit'};
const sb={rpc:async(name,args)=>{calls.push({name,args});return fault?{error:fault}:{data:name==='branch_studies_list'?[row]:name==='branch_study_save'?row:name==='branch_study_users'?[]:true};},from(){throw new Error('must not fall back on authorization or network errors');}};
const window={SonoAuth:{user:()=>({id:'member'}),client:()=>sb,mode:()=> 'supabase'}};
vm.runInNewContext(source,{window});
(async()=>{
 const store=window.SonoStudyStore,list=await store.list();assert.equal(list[0].permission,'edit');assert.equal(list[0].ownerName,'صاحب الدراسة');assert(store.sharingReady());
 await store.save(list[0]);assert.equal(calls.at(-1).args.expected_version,2);assert.equal(calls.at(-1).args.sid,'cloud');
 await store.users(list[0]);await store.share(list[0],'other','add');assert.equal(calls.at(-1).args.p,'add');await store.share(list[0],'other','');assert.equal(calls.at(-1).args.p,null);
 await store.remove(list[0]);assert.equal(calls.at(-1).name,'branch_study_delete');
 fault={message:'version conflict'};await assert.rejects(()=>store.save(list[0]),/جهاز آخر/);
 fault={message:'permission denied',code:'42501'};await assert.rejects(()=>store.list(),/صلاحية/);
 fault={message:'offline'};await assert.rejects(()=>store.list(),/الاتصال/);
 console.log('PASS guarded study RPC mapping, versions, sharing, deletion and no fallback on denied/offline requests');
})().catch(e=>{console.error(e);process.exitCode=1;});
