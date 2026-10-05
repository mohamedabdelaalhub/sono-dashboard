(function(root){
'use strict';
function analyze(p){
  const A=root.SonoAnalytics.analyze(p.cur.income,p.cur.expense,{label:p.label});
  const ins=root.SonoPrivacy.insights(root.SonoInsights.build(p.datasets,{doctorRevenue:p.doctorRevenue}));
  A.ins=ins;A.periodExcluded=p.periodExcluded||[];
  A.status=root.SonoAnalytics.analyzeStatus(p.statusRows,A.doctors,p.periods);
  if(A.status&&!A.meta.from&&p.statusPeriod){
    A.meta.from=p.statusPeriod.from;A.meta.to=p.statusPeriod.to;
    if(A.meta.from&&A.meta.to)A.meta.rangeLabel=root.SonoAnalytics.fmtDateAr(A.meta.from)+' → '+root.SonoAnalytics.fmtDateAr(A.meta.to);
  }
  const prev=p.prev?root.SonoAnalytics.analyze(p.prev.income,p.prev.expense,{}):null;
  const cmp=A.kpi.revenue>0||A.kpi.cost>0?root.SonoAnalytics.compare(A,prev):null;
  return {A,ins,cmp,E:root.SonoRules.evaluate(A,cmp)};
}
function parseReport(p){
  const wb=root.XLSX.read(p.buffer,{type:'array',cellDates:true,raw:true});
  if(/\.csv$/i.test(p.fileName)&&root.SonoMetaParser){
    let utf=wb;
    try{utf=root.XLSX.read(new TextDecoder('utf-8').decode(p.buffer).replace(/^\uFEFF/,''),{type:'string',cellDates:true,raw:true});}catch(e){}
    const campaign=root.SonoMetaParser.parseCampaigns(utf,p.fileName);
    if(campaign)return {kind:'metaCampaigns',data:campaign};
    const invoice=root.SonoMetaParser.parseInvoice(utf,p.fileName);
    if(invoice)return {kind:'metaInvoice',data:invoice};
    const bank=root.SonoMetaParser.parseBankWithdrawals(utf,p.fileName,new Date().getFullYear());
    if(bank)return {kind:'bankWithdrawals',data:bank};
  }
  const schedule=root.SonoSchedule.parse(wb,p.fileName);
  if(schedule)return {kind:'schedule',data:schedule};
  const status=root.SonoStatusParser.parse(wb,p.fileName);
  const datasets=root.SonoAuto.parseAll(wb,p.fileName);
  if(status&&status.rows.length)return {kind:'status',data:status,datasets};
  if(datasets.length)return {kind:'report',datasets};
  const treasury=root.SonoParser.parseWorkbook(wb,p.fileName);
  if(treasury.income.length||treasury.expense.length)return {kind:'treasury',data:treasury};
  return {kind:'unknown'};
}
function execute(task,p){
  if(task==='parseReport')return parseReport(p);
  if(task==='analyze')return analyze(p);
  if(task==='workbook')return root.XLSX.read(p.buffer,p.options);
  throw new Error('Unknown computation task');
}
root.SonoComputeLogic={execute};
})(typeof window!=='undefined'?window:self);
