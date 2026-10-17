'use strict';
self.window=self;
importScripts('parser.js?v=revenue-workspace-20261017-1','parser-status.js?v=revenue-workspace-20261017-1','parser-meta.js?v=revenue-workspace-20261017-1','parser-auto.js?v=revenue-workspace-20261017-1','schedule.js?v=revenue-workspace-20261017-1','analytics.js?v=revenue-workspace-20261017-1','reports.js?v=revenue-workspace-20261017-1','data-integrity.js?v=revenue-workspace-20261017-1','privacy.js?v=revenue-workspace-20261017-1','insights.js?v=revenue-workspace-20261017-1','rules.js?v=revenue-workspace-20261017-1','compute-logic.js?v=revenue-workspace-20261017-1');
self.onmessage=function(e){
  const {id,task,payload}=e.data;
  try{
    if((task==='workbook'||task==='parseReport')&&!self.XLSX)importScripts('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
    self.postMessage({id,result:self.SonoComputeLogic.execute(task,payload)});
  }catch(error){self.postMessage({id,error:error.message||String(error)});}
};

