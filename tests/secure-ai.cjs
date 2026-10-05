const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
(async()=>{
 const {authorized,request}=await import('../supabase/functions/dashboard-ai/validation.mjs');
 assert(authorized({active:true,role:'سوبر أدمن'},{}));assert(!authorized({active:false,role:'سوبر أدمن'},{}));assert(!authorized({active:true,role:'مستخدم'},{}));assert(authorized({active:true,role:'مستخدم',ai_enabled:true},{}));assert(!authorized({active:true,role:'مستثمر الأميدا',ai_enabled:true},{enable_for_admins:true}));
 assert.throws(()=>request({messages:[{role:'system',content:'x'}]}));assert.throws(()=>request({messages:[{role:'user',content:'x'.repeat(100001)}]}));assert.equal(request({messages:[{role:'user',content:'x'}],maxTokens:100000}).maxTokens,6000);
 let calls=[];const sb={functions:{invoke:async(name,{body})=>{calls.push({name,body});return {data:body.health?{ready:true}:{text:'تحليل'},error:null};}},from(){throw Error('Provider key must not be read');}};
 const ctx={window:{SonoAuth:{client:()=>sb,user:()=>({role:'سوبر أدمن'})},SonoRoles:{isSuper:()=>true},SonoSettings:{get:()=>({provider:'openai',model:'test'}),resolveKey:()=>{throw Error('Provider key must not be resolved');}}}};vm.createContext(ctx);
 for(const name of ['parser','analytics','rules','ai-proxy','ai'])vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../assets/js/'+name+'.js'),'utf8'),ctx);
 const A=ctx.window.SonoAnalytics.analyze([],[],{}),E=ctx.window.SonoRules.evaluate(A,null);
 assert.equal(await ctx.window.SonoAI.narrative(A,E,null,{clinic:'test',branch:'test'}),'تحليل');
 assert(!JSON.stringify(calls).includes('apiKey'));assert.equal(await ctx.window.SonoAIProxy.call([{role:'user',content:'test'}],1000),'تحليل');
 console.log('PASS server authorization, request limits, secure client activation and absence of provider key reads');
})().catch(e=>{console.error(e);process.exitCode=1;});
