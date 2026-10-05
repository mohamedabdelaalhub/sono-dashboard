(function(root){
'use strict';
function context(){
  const auth=root.SonoAuth,user=auth&&auth.user(),sb=auth&&typeof auth.client==='function'&&auth.client();
  if(!sb||!user||!user.id||auth.mode()!=='supabase')return null;
  return {sb,user};
}
function ready(){return !!context();}
async function list(){
  const c=context();if(!c)return [];
  const r=await c.sb.from('reports').select('id,payload,created_at')
    .eq('created_by',c.user.id).eq('payload->>kind','branch-study')
    .order('created_at',{ascending:false}).limit(200);
  if(r.error)throw new Error('تعذر تحميل الدراسات من الحساب.');
  return (r.data||[]).filter(r=>r.payload&&r.payload.study).map(r=>Object.assign({},r.payload.study,{cloudId:r.id,cloudUpdatedAt:r.payload.updatedAt}));
}
async function save(study){
  const c=context();if(!c)return null;
  if(!root.SonoRoles.can(c.user,'upload'))throw new Error('دورك لا يسمح بحفظ دراسة على الحساب.');
  const snapshot=JSON.parse(JSON.stringify(study));delete snapshot.cloudId;delete snapshot.cloudUpdatedAt;
  const updatedAt=new Date().toISOString();
  const row={title:study.name.slice(0,160),period_from:null,period_to:null,files:[],revenue:0,cost:0,net:0,score:0,risk_count:0,
    payload:{v:1,kind:'branch-study',updatedAt,study:snapshot},created_by:c.user.id,created_name:c.user.name||c.user.email||''};
  let q;
  if(study.cloudId){
    q=c.sb.from('reports').update(row).eq('id',study.cloudId).eq('created_by',c.user.id).eq('payload->>kind','branch-study');
    if(study.cloudUpdatedAt)q=q.eq('payload->>updatedAt',study.cloudUpdatedAt);
  }else q=c.sb.from('reports').insert(row);
  const r=await q.select('id').maybeSingle();
  if(r.error)throw new Error('حفظنا الدراسة على الجهاز وتعذر حفظها على الحساب.');
  if(!r.data)throw new Error('الدراسة اتعدلت من جهاز آخر. زامن الدراسات قبل حفظها مرة أخرى.');
  return {cloudId:r.data.id,cloudUpdatedAt:updatedAt};
}
root.SonoStudyStore={ready,list,save};
})(window);
