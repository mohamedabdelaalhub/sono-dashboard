'use strict';
self.window=self;
importScripts('parser.js?v=52','parser-status.js?v=52','parser-meta.js?v=52','parser-auto.js?v=52','schedule.js?v=52','analytics.js?v=52','reports.js?v=52','data-integrity.js?v=52','privacy.js?v=52','insights.js?v=52','rules.js?v=52','compute-logic.js?v=52');
self.onmessage=function(e){
  const {id,task,payload}=e.data;
  try{
    if((task==='workbook'||task==='parseReport')&&!self.XLSX)importScripts('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
    self.postMessage({id,result:self.SonoComputeLogic.execute(task,payload)});
  }catch(error){self.postMessage({id,error:error.message||String(error)});}
};

