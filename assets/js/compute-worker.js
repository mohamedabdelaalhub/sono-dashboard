'use strict';
self.window=self;
importScripts('parser.js?v=53','parser-status.js?v=53','parser-meta.js?v=53','parser-auto.js?v=53','schedule.js?v=53','analytics.js?v=53','reports.js?v=53','data-integrity.js?v=53','privacy.js?v=53','insights.js?v=53','rules.js?v=53','compute-logic.js?v=53');
self.onmessage=function(e){
  const {id,task,payload}=e.data;
  try{
    if((task==='workbook'||task==='parseReport')&&!self.XLSX)importScripts('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
    self.postMessage({id,result:self.SonoComputeLogic.execute(task,payload)});
  }catch(error){self.postMessage({id,error:error.message||String(error)});}
};

