'use strict';
self.window=self;
importScripts('parser.js?v=51','parser-status.js?v=51','parser-meta.js?v=51','parser-auto.js?v=51','schedule.js?v=51','analytics.js?v=51','reports.js?v=51','data-integrity.js?v=51','privacy.js?v=51','insights.js?v=51','rules.js?v=51','compute-logic.js?v=51');
self.onmessage=function(e){
  const {id,task,payload}=e.data;
  try{
    if((task==='workbook'||task==='parseReport')&&!self.XLSX)importScripts('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
    self.postMessage({id,result:self.SonoComputeLogic.execute(task,payload)});
  }catch(error){self.postMessage({id,error:error.message||String(error)});}
};

