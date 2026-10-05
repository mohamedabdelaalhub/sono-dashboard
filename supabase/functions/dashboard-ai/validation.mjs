export function authorized(profile,settings){
  if(!profile||!profile.active)return false;
  const role=String(profile.role||'').trim().toLowerCase();
  if(['سوبر أدمن','سوبر ادمن','مالك','owner','superadmin','super admin'].includes(role))return true;
  return ['مدير','محاسب','مستخدم'].includes(role)&&!!(profile.ai_enabled||settings.enable_for_admins);
}
export function request(body){
  if(!Array.isArray(body.messages)||!body.messages.length||body.messages.length>30)throw Error('رسائل الطلب غير صالحة.');
  let length=0;
  const messages=body.messages.map(m=>{
    if(!m||!['user','assistant'].includes(m.role)||typeof m.content!=='string')throw Error('رسائل الطلب غير صالحة.');
    length+=m.content.length;return {role:m.role,content:m.content};
  });
  if(length>100000)throw Error('الطلب يتجاوز الحجم المتاح.');
  return {messages,maxTokens:Math.min(6000,Math.max(256,Math.trunc(Number(body.maxTokens)||2000)))};
}
