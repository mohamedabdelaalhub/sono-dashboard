'use strict';
self.window=self;
importScripts('parser.js?v=revenue-workspace-20261017-2','parser-status.js?v=revenue-workspace-20261017-2','parser-meta.js?v=revenue-workspace-20261017-2','parser-auto.js?v=revenue-workspace-20261017-2','schedule.js?v=revenue-workspace-20261017-2','analytics.js?v=revenue-workspace-20261017-2','reports.js?v=revenue-workspace-20261017-2','data-integrity.js?v=revenue-workspace-20261017-2','privacy.js?v=revenue-workspace-20261017-2','insights.js?v=revenue-workspace-20261017-2','rules.js?v=revenue-workspace-20261017-2','compute-logic.js?v=revenue-workspace-20261017-2');
self.onmessage=function(e){
  const {id,task,payload}=e.data;
  try{
    if((task==='workbook'||task==='parseReport')&&!self.XLSX)importScripts('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
    self.postMessage({id,result:self.SonoComputeLogic.execute(task,payload)});
  }catch(error){self.postMessage({id,error:error.message||String(error)});}
};

