import {createClient} from 'npm:@supabase/supabase-js@2';
import {authorized,request} from './validation.mjs';

const origin='https://mohamedabdelaalhub.github.io';
const cors={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'};
const system='أنت محلل مالي وتشغيلي لمركز طبي في مصر. اعتمد فقط على الأرقام المرسلة ولا تخترع بيانات. استخدم العربية، واذكر الفترة والأرقام وما يحتاج إجراء. لا تطلب بيانات مرضى ولا تقدم معلومات شخصية. أرجع نص Markdown مختصرًا.';
function reply(body:unknown,status=200){return Response.json(body,{status,headers:cors});}
Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(req.method!=='POST')return reply({error:'Method not allowed'},405);
  if(req.headers.get('origin')&&req.headers.get('origin')!==origin)return reply({error:'Origin not allowed'},403);
  try{
    if(Number(req.headers.get('content-length')||0)>400000)return reply({error:'الطلب يتجاوز الحجم المتاح.'},413);
    const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
    if(!token)return reply({error:'سجّل الدخول أولًا.'},401);
    const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:auth,error:authError}=await admin.auth.getUser(token);
    if(authError||!auth.user)return reply({error:'الجلسة انتهت. سجّل الدخول مرة أخرى.'},401);
    const [{data:profile,error:pError},{data:settings,error:sError}]=await Promise.all([
      admin.from('admins').select('role,active,ai_enabled').eq('user_id',auth.user.id).maybeSingle(),
      admin.from('app_settings').select('provider,model,enable_for_admins,has_key').eq('id',1).maybeSingle()
    ]);
    if(pError||sError||!settings)return reply({error:'تعذر قراءة إعدادات الخدمة.'},503);
    if(!profile||!profile.active)return reply({error:'الحساب غير مفعّل.'},403);
    const text=await req.text();if(text.length>400000)return reply({error:'الطلب يتجاوز الحجم المتاح.'},413);
    const body=JSON.parse(text);
    if(body.health)return reply({ready:true,hasKey:!!settings.has_key});
    if(!authorized(profile,settings))return reply({error:'دورك لا يسمح باستخدام التحليل الذكي.'},403);
    const input=request(body);
    const {data:allowed,error:limitError}=await admin.rpc('consume_ai_request',{uid:auth.user.id});
    if(limitError)return reply({error:'تهيئة حماية الخدمة لم تكتمل.'},503);
    if(!allowed)return reply({error:'انتظر دقيقة قبل إرسال طلب آخر.'},429);
    const {data:secret,error:secretError}=await admin.from('app_secrets').select('api_key').eq('id',1).maybeSingle();
    if(secretError||!secret?.api_key)return reply({error:'لم يُضبط مفتاح الخدمة على الخادم.'},503);
    const openai=settings.provider==='openai';
    const url=openai?'https://api.openai.com/v1/chat/completions':'https://api.anthropic.com/v1/messages';
    const headers:Record<string,string>={'content-type':'application/json'};
    if(openai)headers.authorization='Bearer '+secret.api_key;
    else{headers['x-api-key']=secret.api_key;headers['anthropic-version']='2023-06-01';}
    const payload=openai?{model:settings.model,max_completion_tokens:input.maxTokens,messages:[{role:'system',content:system},...input.messages]}:{model:settings.model,max_tokens:input.maxTokens,system,messages:input.messages};
    const response=await fetch(url,{method:'POST',headers,body:JSON.stringify(payload),signal:AbortSignal.timeout(90000)});
    if(!response.ok)return reply({error:response.status===429?'تجاوز حساب المزوّد حد الاستخدام أو الرصيد.':'رفض المزوّد الطلب. راجع إعدادات النموذج والمفتاح.'},response.status===429?429:502);
    const data=await response.json();
    const output=openai?data.choices?.[0]?.message?.content:(data.content||[]).filter((c:{type:string,text:string})=>c.type==='text').map((c:{text:string})=>c.text).join('\n');
    if(!output)return reply({error:'لم يرجع المزوّد نصًا. قلّل حجم السؤال أو عدّل النموذج.'},502);
    return reply({text:output});
  }catch(error){return reply({error:error instanceof SyntaxError?'رسائل الطلب غير صالحة.':'تعذر تنفيذ الطلب. أعد المحاولة.'},400);}
});
