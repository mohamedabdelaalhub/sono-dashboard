'use strict';
self.window=self;
importScripts('parser.js?v=48','parser-status.js?v=48','parser-meta.js?v=48','parser-auto.js?v=48','schedule.js?v=48','analytics.js?v=48','reports.js?v=48','data-integrity.js?v=48','privacy.js?v=48','insights.js?v=48','rules.js?v=48','compute-logic.js?v=48');
self.onmessage=function(e){
  const {id,task,payload}=e.data;
  try{
    if((task==='workbook'||task==='parseReport')&&!self.XLSX)importScripts('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
    self.postMessage({id,result:self.SonoComputeLogic.execute(task,payload)});
  }catch(error){self.postMessage({id,error:error.message||String(error)});}
};
