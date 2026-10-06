'use strict';
self.window=self;
importScripts('parser.js?v=50','parser-status.js?v=50','parser-meta.js?v=50','parser-auto.js?v=50','schedule.js?v=50','analytics.js?v=50','reports.js?v=50','data-integrity.js?v=50','privacy.js?v=50','insights.js?v=50','rules.js?v=50','compute-logic.js?v=50');
self.onmessage=function(e){
  const {id,task,payload}=e.data;
  try{
    if((task==='workbook'||task==='parseReport')&&!self.XLSX)importScripts('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
    self.postMessage({id,result:self.SonoComputeLogic.execute(task,payload)});
  }catch(error){self.postMessage({id,error:error.message||String(error)});}
};
