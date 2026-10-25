const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
(async()=>{
 const calls=[],storage=new Map(),user={id:'target-auth-user',email:'test@example.invalid'};
 const client={
  auth:{signInWithPassword:async input=>{assert.equal(input.email,user.email);return {data:{user},error:null};}},
  from(table){const q={select(){return q;},eq(column,value){calls.push({table,column,value});return q;},maybeSingle:async()=>({data:{name:'Tester',role:'سوبر أدمن',active:true,ai_enabled:false},error:null}),upsert:async value=>{calls.push({table,value});return {error:null};}};return q;},
  channel(){return {on(event,filter){assert.equal(event,'postgres_changes');assert.equal(filter.schema,'legacy_dashboard');assert.equal(filter.table,'notifications');return this;},subscribe(){return 'subscribed';}};}
 };
 const window={SONO_CONFIG:{authMode:'supabase',supabase:{url:'https://target.supabase.co',anonKey:'test-publishable-key',schema:'legacy_dashboard'}},SonoRoles:{normalize:role=>role},
 supabase:{createClient:(url,key,options)=>{assert.equal(url,'https://target.supabase.co');assert.equal(options.db.schema,'legacy_dashboard');return client;}}};
 const ctx={window,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},console};
 vm.createContext(ctx);
 for(const name of ['auth','notify-store','schedule-store'])vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../assets/js/'+name+'.js'),'utf8'),ctx);
 const profile=await window.SonoAuth.signIn(user.email,'test-password');
 assert.equal(profile.id,user.id);assert(calls.some(c=>c.table==='admins'&&c.column==='user_id'&&c.value===user.id));
 assert.equal(window.SonoNotify.subscribe(client,()=>{}),'subscribed');
 const saved=await window.SonoScheduleStore.save({file:'test.xlsx',doctors:[],specialties:[],matrix:[],conflicts:[],gaps:[],solo:[],stats:{}},user);
 assert.equal(saved.where,'supabase');assert(calls.some(c=>c.table==='clinic_schedule'&&c.value.saved_by===user.id));
 assert(storage.has('sono.schedule.v1'),'local schedule copy remains available');
 console.log('PASS migrated auth profile, schema-scoped Realtime and shared schedule persistence with local copy');
})().catch(e=>{console.error(e);process.exitCode=1;});

