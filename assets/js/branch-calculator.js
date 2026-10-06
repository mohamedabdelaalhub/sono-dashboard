(function () {
  'use strict';
  const OLD = 'sono_branch_setup_calculator_v1';
  let KEY = 'sono_branch_setup_calculator_v2';
  let accountKey=null;
  const names = ['التشطيب','الأجهزة الطبية','الأثاث والتجهيزات','الإيجار والتأمين','التراخيص والرسوم','الشبكات والـ IT','التسويق قبل الافتتاح','رأس المال التشغيلي'];
  const id = () => crypto.randomUUID();
  const copy = x => JSON.parse(JSON.stringify(x));
  const num = x => Number.isFinite(Number(x)) ? Math.max(0, Number(x)) : 0;
  const money = x => num(x).toLocaleString('en-US', {maximumFractionDigits:2}) + ' جنيه';
  const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const item = (name = '') => ({id:id(),name,qty:1,unit:0});
  const fresh = () => ({id:id(),name:'',sections:names.map(name => ({id:id(),name,items:[]}))});
  const subtotal = s => s.items.reduce((n,r) => n + num(r.qty)*num(r.unit),0);
  let db, readError = false;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved) {
      if (!Array.isArray(saved.studies) || !saved.draft || !Array.isArray(saved.draft.sections)) throw Error();
      db = saved;
    } else {
      const draft = fresh();
      const rows = JSON.parse(localStorage.getItem(OLD) || 'null');
      if (Array.isArray(rows)) draft.sections = rows.map(r => ({id:id(),name:String(r.name || 'بند'),items:[{...item('قيمة سابقة'),qty:num(r.qty),unit:num(r.unit)}]}));
      draft.name = localStorage.getItem(OLD + '_name') || '';
      db = {studies:[],draft};
    }
  } catch { readError = true; db = {studies:[],draft:fresh()}; }
  function mount() {
    const tabs = document.getElementById('tabs');
    if (!tabs || document.getElementById('branchCalcBtn')) return;
    const btn = document.createElement('button');
    btn.id = 'branchCalcBtn'; btn.type = 'button'; btn.textContent = 'حاسبة إنشاء فرع جديد';
    tabs.appendChild(btn);
    const modal = document.createElement('div');
    modal.id = 'branchCalcModal'; modal.className = 'modal hide';
    modal.setAttribute('role','dialog');
    modal.setAttribute('aria-modal','true');
    modal.setAttribute('aria-labelledby','bcTitle');
    modal.innerHTML = `<style>
      #branchCalcModal{padding:24px;z-index:1000;background:rgba(22,33,46,.55)}
      #branchCalcModal,#branchCalcModal *{box-sizing:border-box}
      #branchCalcModal .mbox{width:100%;max-width:1100px;height:90dvh;max-height:920px;display:flex;flex-direction:column;overflow:hidden;border-radius:20px;background:#f5f7fb;box-shadow:0 24px 80px #16212e30}
      #branchCalcModal .mhead{flex-shrink:0;background:#fff;padding:20px 24px;border-bottom:1px solid #e0e6ef;display:flex;align-items:center;gap:12px}
      #branchCalcModal h2{margin:0;font-size:21px;color:#16212e}
      #branchCalcModal .bc-sub{margin:6px 0 0;color:#65748a;font-size:13px}
      #branchCalcModal .mbody{flex:1;min-height:0;overflow:auto;padding:24px;overscroll-behavior:contain}
      #branchCalcModal .bc-workspace{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px}
      #branchCalcModal .bc-panel{background:#fff;border:1px solid #e0e6ef;border-radius:14px;padding:16px;min-width:0}
      #branchCalcModal .bc-actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 0}
      #branchCalcModal .bc-open-row{display:flex;gap:8px;align-items:center}
      #branchCalcModal .bc-open-row select{flex:1;min-width:0}
      #branchCalcModal .bc-section{background:#fff;border:1px solid #e0e6ef;border-radius:16px;margin:14px 0;overflow:hidden}
      #branchCalcModal .bc-heading{display:flex;gap:12px;align-items:center;flex-wrap:wrap;background:#f0f4fc;padding:16px;border-bottom:1px solid #e0e6ef}
      #branchCalcModal .bc-heading input{font-weight:700;color:#0f369d;background:transparent;border-color:transparent;flex:1;min-width:160px}
      #branchCalcModal .bc-heading input:hover{border-color:#b6c6e8}
      #branchCalcModal [data-section-total]{font-variant-numeric:tabular-nums;white-space:nowrap;color:#0f369d}
      #branchCalcModal input,#branchCalcModal select{font:inherit;width:100%;min-width:0;min-height:44px;padding:10px 12px;border:1px solid #cdd6e3;border-radius:9px;background:#fff;color:#16212e}
      #branchCalcModal input:focus,#branchCalcModal select:focus{outline:3px solid #0f369d22;border-color:#0f369d}
      #branchCalcModal button{font:inherit;min-height:44px;cursor:pointer;border-radius:9px}
      #branchCalcModal button:focus-visible{outline:3px solid #0f369d55;outline-offset:2px}
      #branchCalcModal [data-delete-item],#branchCalcModal [data-delete-section]{color:#b43b2a;background:transparent}
      #branchCalcModal .bc-row{display:grid;grid-template-columns:minmax(180px,2fr) minmax(80px,.7fr) minmax(100px,1fr) minmax(110px,1fr) auto;gap:12px;align-items:end;padding:16px;border-bottom:1px solid #edf0f5}
      #branchCalcModal .bc-row:last-child{border-bottom:0}
      #branchCalcModal label{display:block;font-size:13px;color:#526176;margin-bottom:6px}
      #branchCalcModal .bc-row label{margin:0}
      #branchCalcModal .bc-row input{margin-top:6px}
      #branchCalcModal input[type=number]{direction:ltr;text-align:right;font-variant-numeric:tabular-nums}
      #branchCalcModal [data-total]{display:flex;align-items:center;min-height:44px;font-weight:700;font-variant-numeric:tabular-nums}
      #branchCalcModal .bc-empty{padding:18px;color:#65748a;margin:0;font-size:14px}
      #branchCalcModal .bc-section-toolbar{flex-wrap:wrap;display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:20px}
      #branchCalcModal [hidden]{display:none!important}
      #branchCalcModal .bc-study-list{display:grid;gap:10px;margin:16px 0}#branchCalcModal .bc-study-card{background:#fff;border:1px solid #e0e6ef;border-radius:12px;padding:14px;display:flex;gap:12px;flex-wrap:wrap;align-items:center}#branchCalcModal .bc-study-info{flex:1;min-width:160px}#branchCalcModal .bc-study-info strong{display:block}#branchCalcModal .bc-study-info small{display:block;color:#526176;margin-top:4px}#branchCalcModal .bc-sharing{background:#fff;border:1px solid #cdd6e3;border-radius:14px;padding:16px;margin:16px 0}#branchCalcModal .bc-member{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0}#branchCalcModal .bc-member span{flex:1;min-width:120px}#branchCalcModal .bc-member select{width:auto;max-width:100%}#branchCalcModal button:disabled{opacity:.5;cursor:default}
      #branchCalcModal .bc-count{font-size:12px;color:#526176;white-space:nowrap}
      #branchCalcModal .bc-section-toolbar h3{margin:0;font-size:17px}
      #branchCalcModal .bc-footer{flex-shrink:0;padding:16px 24px;background:#fff;border-top:1px solid #dce4ef;display:flex;align-items:center;justify-content:space-between;gap:16px}
      #branchCalcModal #branchCalcTotal{font-size:26px;font-weight:800;color:#0f369d;line-height:1.4;white-space:nowrap;direction:rtl}
      #branchCalcModal #bcStatus{font-size:12px;color:#526176;min-height:18px;margin:4px 0 0}
      #branchCalcModal .bc-footer .btn{min-width:160px}
      @media(max-width:800px){#branchCalcModal .bc-workspace{grid-template-columns:1fr}#branchCalcModal .bc-row{grid-template-columns:1fr 1fr}#branchCalcModal .bc-item-name{grid-column:1/-1}#branchCalcModal .bc-row>button{grid-column:2;grid-row:3}#branchCalcModal .bc-row [data-total]{grid-column:1;grid-row:3}#branchCalcModal .bc-heading input{flex-basis:100%;min-width:0}}
      @media(max-width:480px){#branchCalcModal{padding:0}#branchCalcModal .mbox{height:100dvh;max-height:none;border-radius:0}#branchCalcModal .mhead{padding:16px}#branchCalcModal h2{font-size:18px}#branchCalcModal .mbody{padding:14px}#branchCalcModal .bc-heading,#branchCalcModal .bc-row{padding:12px;gap:10px}#branchCalcModal input,#branchCalcModal select{font-size:16px}#branchCalcModal .bc-heading [data-section-total]{flex-basis:100%}#branchCalcModal .bc-footer{padding:12px 14px;gap:8px;flex-direction:column;align-items:stretch}#branchCalcModal .bc-footer>div{width:100%;min-width:0}#branchCalcModal .bc-footer .btn{width:100%;min-width:0}#branchCalcModal #branchCalcTotal{font-size:clamp(16px,5.5vw,22px)}}
      @media(prefers-reduced-motion:reduce){#branchCalcModal *{scroll-behavior:auto}}
    </style><div class="mbox"><div class="mhead"><div style="flex:1"><h2 id="bcTitle">تكلفة إنشاء فرع جديد</h2><p class="bc-sub">نظّم مصروفات التأسيس واحسب تكلفة كل قسم</p></div><button type="button" class="btn ghost icon" id="branchCalcClose" aria-label="إغلاق">×</button></div><div class="mbody">
      <div class="bc-workspace"><div class="bc-panel"><label for="branchCalcName">اسم الفرع أو الدراسة</label><input id="branchCalcName" placeholder="مثال فرع الشيخ زايد"><div class="bc-actions"><button type="button" class="btn ghost" id="bcNew">دراسة جديدة</button></div></div>
      <div class="bc-panel"><label for="bcSaved">الدراسات المحفوظة</label><div class="bc-open-row"><select id="bcSaved"></select><button type="button" class="btn ghost" id="bcOpen">فتح</button></div><div class="bc-actions"><button type="button" class="btn ghost sm" id="bcSync">مزامنة الحساب</button><button type="button" class="btn ghost sm" id="bcBackup">تنزيل نسخة احتياطية</button><button type="button" class="btn ghost sm" id="bcImport">استعادة نسخة</button><input type="file" id="bcImportFile" accept="application/json,.json" hidden></div><p class="bc-sub">المسودة تُحفظ على الجهاز أثناء الكتابة. زر حفظ الدراسة يحفظ نسخة على الحساب عند الاتصال.</p></div></div>
      <h3>قائمة الدراسات</h3><div id="bcStudyList" class="bc-study-list"></div><div id="bcSharing" class="bc-sharing" hidden></div><div class="bc-section-toolbar"><h3>أقسام التأسيس</h3><div class="bc-actions" style="margin:0"><button type="button" class="btn ghost sm" id="bcCollapseAll">طي الكل</button><button type="button" class="btn ghost sm" id="bcExpandAll">فتح الكل</button><button type="button" class="btn ghost" id="branchCalcAdd">إضافة قسم</button></div></div><div id="branchCalcRows"></div>
    </div><div class="bc-footer"><div><span class="bc-sub">إجمالي تكلفة الفرع</span><div id="branchCalcTotal"></div><p id="bcStatus" role="status" aria-live="polite"></p></div><button type="button" class="btn" id="bcSave">حفظ الدراسة</button></div></div>`;
    document.body.appendChild(modal);
    const $ = s => modal.querySelector(s);
    const status = text => $('#bcStatus').textContent = text;
    let saveTimer=null, baseline=copy(db.draft), syncBusy=false;
    const permission=()=>db.draft.cloudId?(db.draft.permission||'owner'):'owner';
    const manage=s=>!s.cloudId || s.permission==='owner' || window.SonoRoles?.isSuper(window.SonoAuth?.user());
    const canAdd=()=>['owner','full','add'].includes(permission());
    const canDelete=()=>['owner','full'].includes(permission());
    function canEdit(sectionId,itemId){
      if(['owner','full','edit'].includes(permission()))return true;
      if(permission()!=='add')return false;
      const old=baseline.sections.find(s=>s.id===sectionId);
      return !old || (itemId && !old.items.some(r=>r.id===itemId));
    }
    function permissions(){
      $('#branchCalcName').disabled=!['owner','full','edit'].includes(permission());
      $('#branchCalcAdd').disabled=!canAdd();
      $('#bcSave').disabled=permission()==='view';
      modal.querySelectorAll('[data-section]').forEach(el=>{
        const sid=el.dataset.section;
        el.querySelector('[data-section-name]').disabled=!canEdit(sid);
        el.querySelector('[data-add]').disabled=!canAdd();
        el.querySelector('[data-delete-section]').disabled=!canDelete();
        el.querySelectorAll('[data-item]').forEach(row=>{
          row.querySelectorAll('input').forEach(input=>input.disabled=!canEdit(sid,row.dataset.item));
          row.querySelector('[data-delete-item]').disabled=!canDelete();
        });
      });
    }
    function selectAccount(){
      const uid=window.SonoAuth?.user()?.id||'local';if(accountKey===uid)return;
      clearTimeout(saveTimer);accountKey=uid;
      KEY='sono_branch_setup_calculator_v2'+(uid==='local'?'':':'+uid);
      try{
        let raw=localStorage.getItem(KEY);
        if(!raw && uid!=='local' && !localStorage.getItem('sono_branch_legacy_owner')){raw=localStorage.getItem('sono_branch_setup_calculator_v2');localStorage.setItem('sono_branch_legacy_owner',uid);}
        const saved=raw?JSON.parse(raw):null;
        db=saved&&Array.isArray(saved.studies)&&Array.isArray(saved.draft?.sections)?saved:{studies:[],draft:fresh()};readError=false;
      }catch{db={studies:[],draft:fresh()};readError=true;}
      baseline=copy(db.draft);
    }
    function queuePersist(){clearTimeout(saveTimer);status('جارٍ حفظ المسودة…');saveTimer=setTimeout(()=>persist(),350);}
    function persist(message) {
      clearTimeout(saveTimer);saveTimer=null;
      if (readError) { status('تعذر قراءة البيانات المحفوظة. لم يتم استبدالها.'); return false; }
      try {localStorage.setItem(KEY,JSON.stringify(db));status(message || 'تم حفظ المسودة');return true;}
      catch {status('تعذر الحفظ على هذا المتصفح. المدخلات ما زالت معروضة.');return false;}
    }
    function totals() {
      db.draft.sections.forEach(s => {const el = Array.from(modal.querySelectorAll("[data-section-total]")).find(el=>el.dataset.sectionTotal===s.id);if(el)el.textContent=money(subtotal(s));});
      $('#branchCalcTotal').textContent = money(db.draft.sections.reduce((n,s)=>n+subtotal(s),0));
    }
    function list() {
      const selected = $('#bcSaved').value;
      $('#bcSaved').innerHTML = '<option value="">اختر دراسة</option>' + db.studies.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');
      $('#bcSaved').value = selected;
      $('#bcStudyList').innerHTML=db.studies.length?db.studies.map(s=>`<article class="bc-study-card"><div class="bc-study-info"><strong>${esc(s.name)}</strong><small>أنشأها ${esc(s.ownerName||'على هذا الجهاز')} · ${esc(s.cloudId?'على الحساب':'نسخة الجهاز')}</small><small>آخر تعديل ${esc(s.updatedAt?new Date(s.updatedAt).toLocaleString('ar-EG'):'—')}</small></div><b style="white-space:nowrap;color:#0f369d">${money(s.sections.reduce((n,x)=>n+subtotal(x),0))}</b><div class="bc-actions" style="margin:0"><button class="btn ghost sm" data-open-study="${esc(s.id)}">فتح التفاصيل</button>${s.cloudId&&manage(s)?`<button class="btn ghost sm" data-share-study="${esc(s.id)}" aria-label="صلاحيات ${esc(s.name)}">الصلاحيات</button>`:''}${manage(s)?`<button class="btn ghost sm" data-delete-study="${esc(s.id)}" style="color:#b43b2a">حذف الدراسة</button>`:''}</div></article>`).join(''):'<p class="bc-sub">لا توجد دراسات محفوظة. احفظ الدراسة أو زامن الحساب.</p>';
    }
    function sectionHtml(s) {
      return `<section class="bc-section" data-section="${esc(s.id)}"><div class="bc-heading"><input aria-label="اسم القسم" data-section-name value="${esc(s.name)}" style="flex:1"><span class="bc-count">${s.items.length} بند</span><b data-section-total="${esc(s.id)}"></b><button type="button" class="btn ghost sm" data-toggle aria-expanded="${!s.collapsed}" aria-controls="bc-items-${esc(s.id)}">${s.collapsed ? 'فتح التفاصيل' : 'طي التفاصيل'}</button><button type="button" class="btn ghost sm" data-add>إضافة بند تفصيلي</button><button type="button" class="btn ghost sm" data-delete-section>حذف القسم</button></div><div id="bc-items-${esc(s.id)}" ${s.collapsed ? 'hidden' : ''}>${s.items.length ? '' : '<p class="bc-empty">أضف بنود هذا القسم وحدّد الكمية وتكلفة الوحدة لكل بند.</p>'}${s.items.map(r=>`<div class="bc-row" data-item="${esc(r.id)}"><label class="bc-item-name">البند التفصيلي<input data-k="name" value="${esc(r.name)}" placeholder="اسم البند"></label><label>الكمية<input data-k="qty" type="number" min="0" step="any" value="${num(r.qty)}"></label><label>تكلفة الوحدة<input data-k="unit" type="number" min="0" step="any" value="${num(r.unit)}"></label><div data-total aria-label="إجمالي البند">${money(num(r.qty)*num(r.unit))}</div><button type="button" class="btn ghost sm" data-delete-item>حذف</button></div>`).join('')}</div></section>`;
    }
    function renderSection(s){const node=Array.from(modal.querySelectorAll("[data-section]")).find(el=>el.dataset.section===s.id);if(node)node.outerHTML=sectionHtml(s);totals();permissions();}
    function render() {
      $('#branchCalcName').value = db.draft.name;
      $('#branchCalcRows').innerHTML = db.draft.sections.map(sectionHtml).join('');
      totals();list();permissions();
    }
    $('#branchCalcName').oninput = e => {if(!['owner','full','edit'].includes(permission()))return;db.draft.name=e.target.value;queuePersist();};
    $('#branchCalcRows').addEventListener('input', e=>{
      const el=e.target.closest('[data-section]');if(!el)return;
      const s=db.draft.sections.find(s=>s.id===el.dataset.section);
      if(e.target.hasAttribute('data-section-name')){if(!canEdit(s.id))return;s.name=e.target.value;}
      else {const row=e.target.closest('[data-item]');if(!row)return;const r=s.items.find(r=>r.id===row.dataset.item);const k=e.target.dataset.k;if(!canEdit(s.id,row.dataset.item))return;if(!['name','qty','unit'].includes(k))return;r[k]=k==='name'?e.target.value:num(e.target.value);row.querySelector('[data-total]').textContent=money(num(r.qty)*num(r.unit));}
      totals();queuePersist();
    });
    $('#branchCalcRows').addEventListener('click', e=>{
      const el=e.target.closest('[data-section]');if(!el)return;const s=db.draft.sections.find(s=>s.id===el.dataset.section);
      if(e.target.closest('[data-toggle]')){s.collapsed=!s.collapsed;const panel=el.querySelector('#bc-items-'+s.id),toggle=el.querySelector('[data-toggle]');panel.hidden=!!s.collapsed;toggle.setAttribute('aria-expanded',String(!s.collapsed));toggle.textContent=s.collapsed?'فتح التفاصيل':'طي التفاصيل';persist();return;}
      if(e.target.closest('[data-add]')){if(!canAdd())return;s.collapsed=false;s.items.push(item());}
      else if(e.target.closest('[data-delete-item]')){if(!canDelete())return;const row=e.target.closest('[data-item]');s.items=s.items.filter(r=>r.id!==row.dataset.item);}
      else if(e.target.closest('[data-delete-section]')){if(!canDelete())return;if(!confirm('حذف القسم وكل بنوده؟'))return;db.draft.sections=db.draft.sections.filter(x=>x.id!==s.id);}
      else return;
      if(Array.from(modal.querySelectorAll("[data-section]")).find(el=>el.dataset.section===s.id) && db.draft.sections.includes(s))renderSection(s);else {el.remove();totals();}
      persist();
      if(e.target.closest('[data-add]')){const inputs=Array.from(modal.querySelectorAll("[data-section]")).find(el=>el.dataset.section===s.id)?.querySelectorAll('[data-k="name"]')||[];inputs[inputs.length-1]?.focus();}
    });
    $('#bcCollapseAll').onclick=()=>{db.draft.sections.forEach(s=>s.collapsed=true);render();persist();};
    $('#bcExpandAll').onclick=()=>{db.draft.sections.forEach(s=>s.collapsed=false);render();persist();};
    $('#branchCalcAdd').onclick=()=>{if(!canAdd())return;db.draft.sections.push({id:id(),name:'قسم جديد',items:[]});render();persist();};
    $('#bcSave').onclick=async()=>{
      if(permission()==='view'){status('صلاحيتك استعراض فقط.');return;}
      if(!db.draft.name.trim()){status('اكتب اسم الفرع أو الدراسة قبل الحفظ.');$('#branchCalcName').focus();return;}
      const previous=copy(db.studies), snapshot=copy(db.draft);snapshot.name=snapshot.name.trim();snapshot.updatedAt=new Date().toISOString();
      const i=db.studies.findIndex(s=>s.id===snapshot.id);if(i<0)db.studies.push(snapshot);else db.studies[i]=snapshot;
      if(!persist('تم حفظ الدراسة على الجهاز')){db.studies=previous;return;}
      list();$('#bcSaved').value=snapshot.id;
      if(window.SonoStudyStore?.ready()){
        $('#bcSave').disabled=true;
        try{const cloud=await window.SonoStudyStore.save(snapshot);const local=db.studies.find(s=>s.id===snapshot.id);if(local)Object.assign(local,cloud);if(db.draft.id===snapshot.id)Object.assign(db.draft,cloud);baseline=copy(db.draft);persist('تم حفظ الدراسة على الجهاز والحساب');list();permissions();}
        catch(e){status(e.message);}
        finally{permissions();}
      }
    };
    $('#bcNew').onclick=()=>{if(!persist())return;db.draft=fresh();baseline=copy(db.draft);$('#bcSharing').hidden=true;render();persist('بدأت دراسة جديدة');};
    function openStudy(s){
      if(!s){status('اختر دراسة لفتحها.');return;}
      if(!confirm('فتح النسخة المحفوظة؟ احفظ الدراسة أولاً للاحتفاظ بتعديلات المسودة.'))return;
      db.draft=copy(s);baseline=copy(s);$('#bcSharing').hidden=true;render();persist(permission()==='view'?'تم فتح الدراسة للاستعراض':'تم فتح الدراسة');
    }
    $('#bcOpen').onclick=()=>openStudy(db.studies.find(s=>s.id===$('#bcSaved').value));
    async function sync(){
      if(syncBusy)return;
      if(!window.SonoStudyStore?.ready()){status('سجّل الدخول واتصل بالإنترنت لمزامنة الحساب.');return;}
      syncBusy=true;$('#bcSync').disabled=true;
      try{
        const studies=await window.SonoStudyStore.list(),ids=new Set(studies.map(s=>s.cloudId));
        db.studies=db.studies.filter(s=>!s.cloudId||ids.has(s.cloudId));
        studies.forEach(remote=>{
          const i=db.studies.findIndex(s=>s.cloudId===remote.cloudId || (!s.cloudId && s.id===remote.id));
          if(i<0){db.studies.push(remote);return;}
          const local=db.studies[i];
          if(remote.cloudUpdatedAt!==local.cloudUpdatedAt && (local.updatedAt||'')>(local.cloudUpdatedAt||'')){
            const preserved=copy(local);preserved.id=id();preserved.name+=' — نسخة الجهاز';for(const k of ['cloudId','cloudUpdatedAt','cloudVersion','ownerId','ownerName','permission'])delete preserved[k];db.studies.push(preserved);
          }
          db.studies[i]=remote;
        });
        if(db.draft.cloudId){const remote=studies.find(s=>s.cloudId===db.draft.cloudId);db.draft.permission=remote?.permission||'view';}
        persist('تم تحميل الدراسات. افتح الدراسة المطلوبة لعرض آخر نسخة.');list();permissions();
      }catch(e){status(e.message);}finally{syncBusy=false;$('#bcSync').disabled=false;}
    }
    $('#bcSync').onclick=sync;
    const labels={view:'استعراض فقط',edit:'تعديل',add:'إضافة',full:'كل الصلاحيات'};
    async function sharing(s){
      try{
        const users=await window.SonoStudyStore.users(s),panel=$('#bcSharing');panel.hidden=false;
        panel.innerHTML=`<h3>مشاركة ${esc(s.name)}</h3><label for="bcAddUser">إضافة مستخدم</label><div class="bc-open-row"><select id="bcAddUser"><option value="">اختر حساباً</option>${users.filter(u=>!u.permission).map(u=>`<option value="${esc(u.user_id)}">${esc(u.name||u.email)}</option>`).join('')}</select><button class="btn ghost" id="bcGrant">إضافة مستخدم</button></div><p class="bc-sub">السوبر أدمن لديه كل الصلاحيات تلقائياً. كل الصلاحيات للمشارك تشمل حذف البنود، وإدارة المستخدمين وحذف الدراسة لصاحبها والسوبر أدمن.</p>${users.filter(u=>u.permission).map(u=>`<div class="bc-member"><span>${esc(u.name||u.email)}</span><select data-member="${esc(u.user_id)}" aria-label="صلاحيات ${esc(u.name||u.email)}">${Object.entries(labels).map(([k,v])=>`<option value="${k}" ${u.permission===k?'selected':''}>${v}</option>`).join('')}<option value="">إلغاء الوصول</option></select></div>`).join('')}<button class="btn ghost sm" id="bcShareClose">إغلاق الصلاحيات</button>`;
        $('#bcShareClose').onclick=()=>panel.hidden=true;
        $('#bcGrant').onclick=async()=>{const uid=$('#bcAddUser').value;if(!uid)return;$('#bcGrant').disabled=true;try{await window.SonoStudyStore.share(s,uid,'view');await sharing(s);status('أضفنا المستخدم بصلاحية استعراض فقط.');}catch(e){status(e.message);$('#bcGrant').disabled=false;}};
        panel.querySelectorAll('[data-member]').forEach(el=>el.onchange=async()=>{el.disabled=true;try{await window.SonoStudyStore.share(s,el.dataset.member,el.value);await sharing(s);status('تم تحديث الصلاحيات.');}catch(e){status(e.message);await sharing(s);}});
        panel.scrollIntoView?.({block:'nearest'});
      }catch(e){status(e.message);}
    }
    $('#bcStudyList').onclick=async e=>{
      const button=e.target.closest('button');if(!button)return;
      const sid=button.dataset.openStudy||button.dataset.shareStudy||button.dataset.deleteStudy,s=db.studies.find(s=>s.id===sid);if(!s)return;
      if(button.dataset.openStudy){openStudy(s);return;}
      if(button.dataset.shareStudy){await sharing(s);return;}
      if(!manage(s)||!confirm('حذف الدراسة «'+s.name+'»؟ سيزيلها من الحساب وكل الأجهزة بعد المزامنة.'))return;
      button.disabled=true;
      try{if(s.cloudId)await window.SonoStudyStore.remove(s);db.studies=db.studies.filter(x=>x!==s);if(db.draft.id===s.id){db.draft=fresh();baseline=copy(db.draft);}$('#bcSharing').hidden=true;render();persist('تم حذف الدراسة.');}catch(e){status(e.message);button.disabled=false;}
    };
    $('#bcBackup').onclick=()=>{
      if(!persist())return;
      const blob=new Blob([JSON.stringify({version:2,studies:db.studies,draft:db.draft},null,2)],{type:'application/json'});
      const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download='Swnw-branch-studies-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    };
    $('#bcImport').onclick=()=>$('#bcImportFile').click();
    $('#bcImportFile').onchange=async e=>{
      const file=e.target.files[0];if(!file)return;
      try{
        if(file.size>10*1024*1024)throw Error();
        const source=JSON.parse(await file.text());if(source.version!==2||!Array.isArray(source.studies)||!source.draft)throw Error();
        const normalize=study=>{
          if(!study||typeof study.name!=='string'||!Array.isArray(study.sections))throw Error();
          return {id:id(),name:study.name,updatedAt:new Date().toISOString(),sections:study.sections.map(s=>{
            if(!s||typeof s.name!=='string'||!Array.isArray(s.items))throw Error();
            return {id:id(),name:s.name,collapsed:!!s.collapsed,items:s.items.map(r=>{if(!r||typeof r.name!=='string'||!Number.isFinite(Number(r.qty))||!Number.isFinite(Number(r.unit)))throw Error();return {id:id(),name:r.name,qty:num(r.qty),unit:num(r.unit)};})};
          })};
        };
        const studies=source.studies.map(normalize),draft=normalize(source.draft);
        if(!confirm('إضافة الدراسات من النسخة وفتح مسودتها؟'))return;
        db.studies.push(...studies);db.draft=draft;baseline=copy(draft);render();persist('تمت استعادة النسخة');
      }catch(e){status('الملف لا يحتوي نسخة صالحة من دراسات الفروع.');}finally{$('#bcImportFile').value='';}
    };
    const close=()=>{persist();modal.classList.add('hide');document.body.style.overflow=previousOverflow;btn.focus();};let previousOverflow='';$('#branchCalcClose').onclick=close;
    modal.addEventListener('click',e=>{if(e.target===modal)close();});
    modal.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();}if(e.key==='Tab'){const focusable=Array.from(modal.querySelectorAll('button,input,select')).filter(el=>!el.disabled&&!el.closest('[hidden]'));const first=focusable[0],last=focusable[focusable.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
    window.addEventListener('pagehide',()=>persist());
    btn.onclick=()=>{selectAccount();render();previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';modal.classList.remove('hide');$('#branchCalcName').focus();if(window.SonoStudyStore?.ready())sync();};render();if(readError)status('تعذر قراءة البيانات المحفوظة. لم يتم استبدالها.');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
