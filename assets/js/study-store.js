(function(root){
'use strict';
function context(){const auth=root.SonoAuth,user=auth&&auth.user(),sb=auth&&typeof auth.client==='function'&&auth.client();return sb&&user?.id&&auth.mode()==='supabase'?{sb,user}:null;}
const ready=()=>!!context();
let modern=null;
function missing(e){return e&&['PGRST202','42883'].includes(e.code);}
function error(e){if(/version conflict/i.test(e?.message||''))return new Error('الدراسة اتعدلت من جهاز آخر. زامن الدراسات وافتح آخر نسخة قبل الحفظ.');if(/permission denied/i.test(e?.message||''))return new Error('ليس لديك صلاحية لتنفيذ هذا الإجراء على الدراسة.');if(/unavailable/i.test(e?.message||''))return new Error('الدراسة لم تعد متاحة لحسابك.');return new Error('تعذر تنفيذ الإجراء على الحساب. تحقق من الاتصال وحاول مرة أخرى.');}
function mapped(r){return Object.assign({},r.study,{cloudId:r.id,cloudVersion:r.version,cloudUpdatedAt:r.updated_at,updatedAt:r.updated_at,ownerId:r.owner_id,ownerName:r.owner_name,permission:r.permission});}
async function rpc(name,args){const c=context();if(!c)throw new Error('سجّل الدخول لمتابعة الدراسة.');const r=await c.sb.rpc(name,args);if(r.error)throw error(r.error);return r.data;}
async function list(){
 const c=context();if(!c)return [];
 if(typeof c.sb.rpc==='function'){
  const r=await c.sb.rpc('branch_studies_list');
  if(!r.error){modern=true;return (r.data||[]).map(mapped);}
  if(!missing(r.error))throw error(r.error);modern=false;
 }
 const r=await c.sb.from('reports').select('id,payload,created_at,created_by,created_name').eq('created_by',c.user.id).eq('payload->>kind','branch-study').order('created_at',{ascending:false}).limit(200);
 if(r.error)throw error(r.error);
 return (r.data||[]).filter(r=>r.payload?.study).map(r=>Object.assign({},r.payload.study,{cloudId:r.id,cloudUpdatedAt:r.payload.updatedAt,ownerId:c.user.id,ownerName:r.created_name||c.user.name,permission:'owner'}));
}
async function save(study){
 const c=context();if(!c)return null;
 if(modern===null&&typeof c.sb.rpc==='function')await list();
 if(modern){return mapped(await rpc('branch_study_save',{sid:study.cloudId||null,doc:study,expected_version:study.cloudVersion??null}));}
 if(!root.SonoRoles.can(c.user,'upload'))throw new Error('دورك لا يسمح بإنشاء دراسة.');
 const snapshot=JSON.parse(JSON.stringify(study));for(const k of ['cloudId','cloudUpdatedAt','cloudVersion','permission','ownerId','ownerName'])delete snapshot[k];
 const updatedAt=new Date().toISOString(),row={title:study.name.slice(0,160),period_from:null,period_to:null,files:[],revenue:0,cost:0,net:0,score:0,risk_count:0,payload:{v:1,kind:'branch-study',updatedAt,study:snapshot},created_by:c.user.id,created_name:c.user.name||c.user.email||''};
 let q;if(study.cloudId){q=c.sb.from('reports').update(row).eq('id',study.cloudId).eq('created_by',c.user.id).eq('payload->>kind','branch-study');if(study.cloudUpdatedAt)q=q.eq('payload->>updatedAt',study.cloudUpdatedAt);}else q=c.sb.from('reports').insert(row);
 const r=await q.select('id').maybeSingle();if(r.error)throw new Error('حفظنا الدراسة على الجهاز وتعذر حفظها على الحساب.');if(!r.data)throw new Error('الدراسة اتعدلت من جهاز آخر. زامن الدراسات قبل حفظها مرة أخرى.');
 return {cloudId:r.data.id,cloudUpdatedAt:updatedAt,ownerId:c.user.id,ownerName:row.created_name,permission:'owner'};
}
async function remove(study){if(modern)return rpc('branch_study_delete',{sid:study.cloudId});throw new Error('فعّل تحديث قاعدة البيانات أولاً لحذف الدراسات من الحساب.');}
async function users(study){if(!modern)throw new Error('فعّل تحديث قاعدة البيانات أولاً لمشاركة الدراسات.');return rpc('branch_study_users',{sid:study.cloudId});}
const share=(study,userId,permission)=>rpc('branch_study_share',{sid:study.cloudId,uid:userId,p:permission||null});
root.SonoStudyStore={ready,list,save,remove,users,share,sharingReady:()=>modern===true};
})(window);
