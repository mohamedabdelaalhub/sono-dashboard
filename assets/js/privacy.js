(function(root){
'use strict';
const hidden = new Set(['patient','fileNo','nid','birth','card','bookingNo','visit','phone','mobile','address','nationalId','diagnosis','diagnoses','reason','note','desc','bayan','email']);
function columns(cols){return (cols || []).filter(c=>!hidden.has(c) && c!=='_row');}
function forAnalysis(datasets){
  const identities=new Map(),phones=new Map();
  function token(map,value,prefix){if(!value)return '';const k=String(value);if(!map.has(k))map.set(k,prefix+(map.size+1));return map.get(k);}
  return (datasets||[]).map(ds=>Object.assign({},ds,{rows:(ds.rows||[]).map(row=>{
    const r=Object.assign({},row), identity=token(identities,row.fileNo?'file:'+row.fileNo:'name:'+row.patient,'P');
    if('patient' in r){r._patientNameIssue=/\.|\s{2,}|[^ء-ي\sA-Za-z']/.test(String(row.patient||'').trim());r.patient=row.patient?'مريض '+identity:'';}
    if('fileNo' in r)r.fileNo=row.fileNo?identity:'';
    if('phone' in r)r.phone=token(phones,row.phone,'T');
    ['mobile','address','nationalId','nid','birth','email','card','bookingNo','visit'].forEach(k=>{if(k in r)r[k]=row[k]?'محجوب':'';});
    ['diagnosis','diagnoses','note','reason','desc'].forEach(k=>{if(k in r)r[k]='';});
    if(ds.id==='accountDisplay'){
      const text=String(row.desc||'');
      const kind=['قبض','صرف','افتتاحي','تسوية','يومية','بيع','شراء','مرتجع','دائن','مدين','سند','فاتورة'].find(k=>new RegExp('(^|\\s)'+k+'(\\s|$)').test(text));
      r.desc=kind?'قيد '+kind:'غير محدد';
    }
    return r;
  })}));
}
function insights(value){
  const out=JSON.parse(JSON.stringify(value||{has:false,modules:[]}));
  (out.modules||[]).forEach(m=>{delete m.userErrorDetails;});
  return out;
}
root.SonoPrivacy={columns,forAnalysis,insights};
})(typeof window!=='undefined'?window:self);
