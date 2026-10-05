const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const {stripTypeScriptTypes}=require('node:module');
(async()=>{
  const {authorized,request}=await import('../supabase/functions/dashboard-ai/validation.mjs');
  let handler,allowed=true,fetches=0,profile={active:true,role:'سوبر أدمن'},authValid=true;
  const settings={provider:'openai',model:'server-model',enable_for_admins:false,has_key:true};
  const admin={auth:{getUser:async()=>authValid?{data:{user:{id:'test'}},error:null}:{data:{user:null},error:{}}},rpc:async()=>({data:allowed,error:null}),from(table){
    const data=table==='admins'?profile:table==='app_settings'?settings:{api_key:'fake-provider-key'};
    const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data,error:null})};return q;
  }};
  const code=stripTypeScriptTypes(fs.readFileSync(path.resolve(__dirname,'../supabase/functions/dashboard-ai/index.ts'),'utf8').replace(/^import .*$/gm,''));
  const ctx={authorized,request,createClient:()=>admin,Deno:{env:{get:()=> 'test'},serve:f=>handler=f},Request,Response,AbortSignal,console,fetch:async(url,options)=>{
    fetches++;assert.equal(url,'https://api.openai.com/v1/chat/completions');assert.equal(JSON.parse(options.body).model,'server-model');return Response.json({choices:[{message:{content:'تحليل آمن'}}]});
  }};
  vm.createContext(ctx);vm.runInContext(code,ctx);
  const call=body=>handler(new Request('https://example.test',{method:'POST',headers:{authorization:'Bearer test','content-type':'application/json',origin:'https://mohamedabdelaalhub.github.io'},body:JSON.stringify(body)}));
  let response=await call({messages:[{role:'user',content:'test'}],model:'attacker-model'});assert.equal(response.status,200);const body=await response.json();assert.equal(body.text,'تحليل آمن');assert(!JSON.stringify(body).includes('fake-provider-key'));assert.equal(fetches,1);
  profile={active:true,role:'مستخدم'};response=await call({health:true});assert.equal(response.status,200);response=await call({messages:[{role:'user',content:'test'}]});assert.equal(response.status,403);assert.equal(fetches,1);
  profile={active:true,role:'سوبر أدمن'};allowed=false;response=await call({messages:[{role:'user',content:'test'}]});assert.equal(response.status,429);assert.equal(fetches,1);
  authValid=false;response=await call({health:true});assert.equal(response.status,401);
  console.log('PASS edge handler authentication, health, permission denial, rate limit, server-owned model and secret-free responses');
})().catch(e=>{console.error(e);process.exitCode=1;});
