/* Explicit approval saves a snapshot, then asks the durable outbox worker to deliver it. */
(function(root){'use strict';
function mount(host,A,E,ctx){
 if(!['سوبر أدمن','سوبر ادمن','مالك','مدير'].includes(root.SonoAuth.user()?.role))return;
 const box=document.createElement('section');box.className='card';
 box.innerHTML='<h3>إرسال التقرير لإدارة المحتوى</h3><p class="note">راجع النتيجة وحدد نطاقًا ثابتًا لنفس نوع التحليل. كل فترة جديدة تسجل ظهور المشكلة، وإعادة نفس التقرير لا تضاعفها.</p><div class="frow"><div class="fld"><label>الفرع<input data-branch maxlength="120"></label></div><div class="fld"><label>نطاق التحليل<input data-scope maxlength="120" value="تحليل المركز"></label></div></div><label><input type="checkbox" data-approve> راجعت نتائج التقرير وأعتمد إرسالها</label><p><button type="button" class="btn" data-send>إرسال التقرير المعتمد</button> <button type="button" class="btn ghost" data-retry>متابعة حالة الإرسال</button></p><p data-status role="status"></p>';
 host.prepend(box);box.querySelector('[data-branch]').value=(ctx&&ctx.branch)||'حدائق الأهرام';
 const status=box.querySelector('[data-status]'),send=box.querySelector('[data-send]');
 function sb(){const c=root.SonoAuth.client();if(!c||root.SonoAuth.mode()!=='supabase')throw Error('سجّل الدخول بحساب الإدارة لإرسال التقرير.');return c;}
 async function relay(){const r=await sb().functions.invoke('operations-relay',{body:{}});if(r.error)throw Error('التقرير محفوظ في طابور الإرسال. جسر التسليم يحتاج تفعيلًا أو إعادة محاولة.');}
 send.onclick=async()=>{try{
  if(!box.querySelector('[data-approve]').checked)throw Error('اعتمد نتائج التقرير قبل الإرسال.');
  const branch=box.querySelector('[data-branch]').value.trim(),scope=box.querySelector('[data-scope]').value.trim();
  if(branch.length<2||scope.length<2)throw Error('حدد الفرع ونطاق التحليل.');
  send.disabled=true;const c=sb();const ready=await c.from('operations_outbox').select('id').limit(1);if(ready.error)throw Error('ربط التقارير لم يفعّل بعد.');const record=await root.SonoArchive.save(A,E,null,[],A.meta.rangeLabel);
  const r=await c.rpc('operations_enqueue',{p_report_id:record.id,p_branch:branch,p_scope:scope});
  if(r.error)throw Error('تعذر تجهيز الإرسال. تأكد من تفعيل ربط التقارير وصلاحية الإدارة.');
  if(!r.data.delivered)await relay();
  const q=await c.from('operations_outbox').select('delivered_at').eq('id',r.data.id).single();
  status.textContent=q.data&&q.data.delivered_at?'وصل التقرير إلى تاب تقارير المؤشرات في لوحة المحتوى.':'التقرير محفوظ في طابور الإرسال وسيعاد تسليمه تلقائيًا بعد تفعيل الجسر.';
 }catch(e){status.textContent=e.message;}finally{send.disabled=false;}};
 box.querySelector('[data-retry]').onclick=async function(){this.disabled=true;try{await relay();const q=await sb().from('operations_outbox').select('delivered_at,last_error').order('approved_at',{ascending:false}).limit(10);if(q.error)throw q.error;const pending=q.data.filter(x=>!x.delivered_at).length;status.textContent=pending?'ما زال هناك '+pending+' تقارير في انتظار التسليم.':'تم تسليم التقارير المعروضة في الطابور.';}catch(e){status.textContent=e.message;}finally{this.disabled=false;}};
}
root.SonoOperationsExport={mount};
})(window);
