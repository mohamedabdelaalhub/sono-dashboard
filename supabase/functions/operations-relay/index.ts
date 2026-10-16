import {createClient} from 'npm:@supabase/supabase-js@2';
import {signature} from './contract.mjs';
const cors={'Access-Control-Allow-Origin':'https://mohamedabdelaalhub.github.io','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:cors});
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return reply({error:'POST only'},405);
 try{
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
  const cron=Deno.env.get('OPERATIONS_CRON_SECRET'),isCron=!!cron&&req.headers.get('x-cron-secret')===cron;
  if(!isCron){
   const jwt=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
   const {data,error}=await db.auth.getUser(jwt);if(error||!data.user)return reply({error:'سجّل الدخول'},401);
   const {data:profile}=await db.from('admins').select('active,role').eq('user_id',data.user.id).maybeSingle();
   if(!profile?.active||!['سوبر أدمن','سوبر ادمن','مالك','مدير'].includes(profile.role))return reply({error:'للإدارة فقط'},403);
  }
  const secret=Deno.env.get('OPERATIONS_BRIDGE_SECRET');if(!secret||secret.length<32)return reply({error:'جسر التقارير يحتاج تفعيلًا'},503);
  const {data:rows,error}=await db.rpc('operations_delivery_claim',{p_id:null});if(error)return reply({error:'طابور الإرسال يحتاج تفعيلًا'},503);
  let delivered=0;
  for(const row of rows||[]){
   let ok=false;
   try{
    const body=JSON.stringify({source:'raocrmssjqsozibniujc',snapshot:row.snapshot,approved_by:row.approved_by,approved_at:row.approved_at});
    const stamp=String(Date.now());const sig=await signature(secret,stamp+'.'+body);
    const r=await fetch('https://uuijfbpgvtdxgaosqpxo.supabase.co/functions/v1/operations-ingest',{method:'POST',headers:{'content-type':'application/json','x-operations-time':stamp,'x-operations-signature':sig},body,signal:AbortSignal.timeout(10000)});
    if(r.ok){const result=await r.json();ok=result.ok===true;}
   }catch{/* Keep the durable pending row; a scheduled retry uses the same fingerprint. */}
   const {error:finishError}=await db.rpc('operations_delivery_finish',{p_id:row.id,p_lease:row.lease_token,p_ok:ok});
   if(ok&&!finishError)delivered++;
  }
  return reply({delivered,claimed:(rows||[]).length});
 }catch{return reply({error:'تعذر تشغيل التسليم'},503);}
});
