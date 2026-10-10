'use strict';
self.window=self;
importScripts('parser.js?v=54','parser-status.js?v=54','parser-meta.js?v=54','parser-auto.js?v=54','schedule.js?v=54','analytics.js?v=54','reports.js?v=54','data-integrity.js?v=54','privacy.js?v=54','insights.js?v=54','rules.js?v=54','compute-logic.js?v=54');
self.onmessage=function(e){
  const {id,task,payload}=e.data;
  try{
    if((task==='workbook'||task==='parseReport')&&!self.XLSX)importScripts('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
    self.postMessage({id,result:self.SonoComputeLogic.execute(task,payload)});
  }catch(error){self.postMessage({id,error:error.message||String(error)});}
};

