/* Financial source reconciliation and period filtering. No source rows are mutated. */
(function(root){
'use strict';
const P=()=>root.SonoParser;
function date(v){
  if(!v)return null;
  const d=v instanceof Date?v:P().parseDate(v);
  return d&&!isNaN(d)?P().iso(d):null;
}
function range(rows,period){
  const dates=(rows||[]).map(r=>date(r.date)).filter(Boolean).sort();
  return {from:date(period&&period.from)||dates[0]||null,to:date(period&&period.to)||dates[dates.length-1]||null};
}
function overlaps(a,b){return !a.from||!a.to||!b.from||!b.to||(a.from<=b.to&&b.from<=a.to);}
function contained(a,b){return !!(a.from&&a.to&&b.from&&b.to&&a.from>=b.from&&a.to<=b.to);}
function bounds(gran,key,from,to){
  if(gran==='all')return null;
  if(gran==='custom')return from&&to?{from,to}:null;
  const parts=String(key||'').split('|'),v=parts[1];if(!v)return null;
  let start,end;
  if(gran==='week'){start=P().parseDate(v);end=new Date(start);end.setDate(end.getDate()+6);}
  if(gran==='month'){const [y,m]=v.split('-').map(Number);start=new Date(y,m-1,1);end=new Date(y,m,0);}
  if(gran==='quarter'){const [y,q]=v.split('-Q').map(Number);start=new Date(y,(q-1)*3,1);end=new Date(y,q*3,0);}
  if(gran==='year'){start=new Date(+v,0,1);end=new Date(+v,11,31);}
  return start&&end?{from:date(start),to:date(end)}:null;
}
function matches(row,selected){
  if(!selected)return true;
  if(row._aggregatePeriod)return contained(row._aggregatePeriod,selected);
  const d=date(row.date);return !!d&&d>=selected.from&&d<=selected.to;
}
function sliceDatasets(datasets,selected){
  const kept=[],excluded=[];
  (datasets||[]).forEach(ds=>{
    if(!selected){kept.push(ds);return;}
    const dated=(ds.rows||[]).some(r=>date(r.date));
    if(dated){
      const rows=ds.rows.filter(r=>matches(r,selected));
      if(rows.length)kept.push(Object.assign({},ds,{rows,period:{from:P().parseDate(selected.from),to:P().parseDate(selected.to)}}));
      if(ds.rows.some(r=>!date(r.date)))excluded.push(ds.name+' — سطور بلا تاريخ');
    }else if(contained(range([],ds.period),selected))kept.push(ds);
    else if(overlaps(range([],ds.period),selected))excluded.push(ds.name+' — لا يمكن توزيع تقرير مجمّع على جزء من فترته');
  });return {datasets:kept,excluded};
}
const PRIORITY={treasury:100,expenseVouchers:95,receipts:90,statusDetail:80,dailyRevenue:70,statusSummary:60,doctorClaim:55,costCenter:50,patientBalance:40,doctorLaser:35,accountDisplay:30,invoice:20};
function fingerprint(r,side){
  return JSON.stringify(side==='income'?[r.date,r._aggregatePeriod,r.amount,r.receipt,r.fileNo,r.branch,r.services]:[r.date,r.amount,r.bayan,r.voucher,r.branch]);
}
function mergeSources(sources){
  const out={income:[],expense:[],excluded:[],used:[]};
  ['income','expense'].forEach(side=>{
    const accepted=[],maxCopies=new Map();
    sources.slice().sort((a,b)=>(PRIORITY[b.kind]||0)-(PRIORITY[a.kind]||0)).forEach(source=>{
      const rows=source[side]||[];if(!rows.length)return;
      const coverage=range(rows,source.period),counts=new Map();let used=0,skipped=0;
      const scope=side==='expense'&&['doctorClaim','receipts'].includes(source.kind)?'doctors':'all';
      rows.forEach(row=>{
        const rowRange=row._aggregatePeriod||range([row]);
        // Alternate report types are views of the same money. Keep the primary view for overlapping dates.
        const alternative=accepted.some(a=>a.kind!==source.kind&&(a.scope==='all'||a.scope===scope)
          &&(!row.branch||a.branches.has('')||a.branches.has(row.branch))&&overlaps(rowRange,a.coverage));
        const k=fingerprint(row,side),n=(counts.get(k)||0)+1;counts.set(k,n);
        if(alternative||n<=(maxCopies.get(k)||0)){skipped++;return;}
        out[side].push(Object.assign({},row,{_financialSource:source.name,_financialPeriod:coverage}));used++;
      });
      counts.forEach((n,k)=>maxCopies.set(k,Math.max(n,maxCopies.get(k)||0)));
      if(used){accepted.push({kind:source.kind,coverage,scope,branches:new Set(rows.map(r=>r.branch||''))});out.used.push({name:source.name,side,count:used});}
      if(skipped)out.excluded.push({name:source.name,side,count:skipped});
    });
  });return out;
}
function doctorRevenueRows(datasets){
  const field={statusDetail:'total',receipts:'amount',statusSummary:'net',doctorLaser:'collected',patientBalance:'amount',doctorClaim:'svcValue'};
  const sources=(datasets||[]).filter(ds=>field[ds.id]).map(ds=>({kind:ds.id,name:ds.file+' — '+(ds.sheet||ds.id),period:ds.period,
    income:(ds.rows||[]).filter(r=>r.doctor).map(r=>({date:r.date,_aggregatePeriod:date(r.date)?undefined:range([],ds.period),amount:+r[field[ds.id]]||0,receipt:r.receipt,fileNo:r.fileNo,branch:JSON.stringify([r.branch||'',root.SonoSchedule?root.SonoSchedule.docKey(r.doctor):P().normAr(r.doctor)]),services:[r.doctor||'',r.service||''],raw:r})),expense:[]}));
  return mergeSources(sources).income.map(r=>({row:r.raw,amount:r.amount}));
}
root.SonoDataIntegrity={doctorRevenueRows,date,range,bounds,matches,sliceDatasets,mergeSources,contained};
})(window);
