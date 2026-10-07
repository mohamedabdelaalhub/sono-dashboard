(function(root){
'use strict';
let worker=null,failed=false,next=0;
const jobs=new Map();
function stop(){
  failed=true;if(worker)worker.terminate();worker=null;
  jobs.forEach(j=>{clearTimeout(j.timer);j.reject(new Error('Worker unavailable'));});jobs.clear();
}
function start(){
  if(worker||failed||!root.Worker)return worker;
  try{
    worker=new root.Worker('assets/js/compute-worker.js?v=51');
    worker.onmessage=e=>{
      const j=jobs.get(e.data.id);if(!j)return;
      clearTimeout(j.timer);jobs.delete(e.data.id);
      if(e.data.error)j.reject(new Error(e.data.error));else j.resolve(e.data.result);
    };
    worker.onerror=stop;worker.onmessageerror=stop;
  }catch(e){stop();}
  return worker;
}
async function run(task,payload){
  if(start()){
    try{return await new Promise((resolve,reject)=>{
      const id=++next,timer=setTimeout(stop,60000);
      jobs.set(id,{resolve,reject,timer});
      try{worker.postMessage({id,task,payload});}catch(e){clearTimeout(timer);jobs.delete(id);reject(e);}
    });}catch(e){/* Retry in the page when workers are blocked or unavailable. */}
  }
  return root.SonoComputeLogic.execute(task,payload);
}
root.SonoCompute={run};
})(window);

