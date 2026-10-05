(function(root){
'use strict';
let known=null;
async function available(){
  const sb=root.SonoAuth&&root.SonoAuth.client();
  if(!sb||!sb.functions)return false;
  if(known!==null)return known;
  const r=await sb.functions.invoke('dashboard-ai',{body:{health:true}});
  if(r.error){
    if(r.error.context&&r.error.context.status===404){known=false;return false;}
    throw new Error('تعذر التحقق من خدمة التحليل الآمنة. أعد المحاولة.');
  }
  known=!!(r.data&&r.data.ready);return known;
}
async function call(messages,maxTokens){
  const sb=root.SonoAuth.client();
  const r=await sb.functions.invoke('dashboard-ai',{body:{messages,maxTokens}});
  if(r.error||!r.data||r.data.error)throw new Error((r.data&&r.data.error)||'تعذر تنفيذ التحليل الآمن. أعد المحاولة.');
  if(!r.data.text)throw new Error('لم يرجع التحليل نصًا.');
  return r.data.text;
}
async function setKey(key){
  const r=await root.SonoAuth.client().rpc('set_ai_key',{new_key:key||null});
  if(r.error)throw new Error('تعذر حفظ مفتاح الخدمة على الخادم.');
}
function reset(){known=null;}
root.SonoAIProxy={available,call,setKey,reset};
})(window);
