'use strict';
self.window=self;
importScripts('parser.js?v=49','parser-status.js?v=49','parser-meta.js?v=49','parser-auto.js?v=49','schedule.js?v=49','analytics.js?v=49','reports.js?v=49','data-integrity.js?v=49','privacy.js?v=49','insights.js?v=49','rules.js?v=49','compute-logic.js?v=49');
self.onmessage=function(e){
  const {id,task,payload}=e.data;
  try{
    if((task==='workbook'||task==='parseReport')&&!self.XLSX)importScripts('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
    self.postMessage({id,result:self.SonoComputeLogic.execute(task,payload)});
  }catch(error){self.postMessage({id,error:error.message||String(error)});}
};
