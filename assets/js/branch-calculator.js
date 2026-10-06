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
  const trash = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg>';
  const item = (name = '') => ({id:id(),name,qty:1,unit:0});
  const fresh = () => ({id:id(),name:'',sections:names.map((name,i) => ({id:id(),name,items:[],collapsed:i!==0}))});
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
      #branchCalcModal{padding:20px;z-index:1000;background:#16212e88;direction:rtl}
      #branchCalcModal,#branchCalcModal *{box-sizing:border-box}
      #branchCalcModal .mbox{width:100%;max-width:1080px;height:90dvh;max-height:920px;display:flex;flex-direction:column;overflow:hidden;border-radius:16px;background:#f5f7fb;box-shadow:0 20px 70px #16212e30}
      #branchCalcModal .mhead{flex-shrink:0;background:#fff;padding:14px 20px;border-bottom:1px solid #e0e6ef;display:flex;align-items:center;gap:12px}
      #branchCalcModal h2{margin:0;font-size:19px;color:#16212e}#branchCalcModal h3{margin:0;font-size:16px}
      #branchCalcModal .bc-sub{margin:4px 0 0;color:#65748a;font-size:12px;line-height:1.6}
      #branchCalcModal .mbody{flex:1;min-height:0;overflow:auto;padding:16px 20px;overscroll-behavior:contain}
      #branchCalcModal .bc-nav{display:flex;gap:4px;padding:6px 20px;background:#fff;border-bottom:1px solid #e0e6ef}
      #branchCalcModal .bc-nav button{background:transparent;border:0;color:#526176;border-radius:6px}#branchCalcModal .bc-nav button[aria-current=page]{background:#edf2ff;color:#0f369d;font-weight:700}
      #branchCalcModal .bc-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px}
      #branchCalcModal .bc-toolbar h3{flex:1}#branchCalcModal .bc-actions{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:0}
      #branchCalcModal button,#branchCalcModal .btn{font:inherit;font-size:13px;line-height:1.3;min-height:36px;padding:7px 12px;border-radius:7px;cursor:pointer;width:auto;min-width:0;box-shadow:none;white-space:nowrap}
      #branchCalcModal button:disabled{opacity:.45;cursor:default}#branchCalcModal button:focus-visible{outline:3px solid #0f369d55;outline-offset:2px}
      #branchCalcModal .bc-icon{width:36px;padding:6px!important;font-size:19px}#branchCalcModal .bc-danger{color:#b43b2a;background:transparent}
      #branchCalcModal input,#branchCalcModal select{font:inherit;font-size:14px;width:100%;min-width:0;min-height:36px;padding:7px 10px;border:1px solid #cdd6e3;border-radius:7px;background:#fff;color:#16212e}
      #branchCalcModal input:focus,#branchCalcModal select:focus{outline:3px solid #0f369d22;border-color:#0f369d}
      #branchCalcModal label{display:block;font-size:12px;color:#526176;margin-bottom:5px}
      #branchCalcModal input[type=number]{direction:ltr;text-align:right;font-variant-numeric:tabular-nums}
      #branchCalcModal .bc-search{max-width:320px;margin-bottom:12px}#branchCalcModal .bc-study-list{display:grid;gap:8px}
      #branchCalcModal .bc-study-card{background:#fff;border:1px solid #e0e6ef;border-radius:10px;padding:12px;display:flex;gap:12px;align-items:center}
      #branchCalcModal .bc-study-info{flex:1;min-width:0}#branchCalcModal .bc-study-info strong{display:block;font-size:14px;overflow-wrap:anywhere}#branchCalcModal .bc-study-info small{display:block;font-size:11px;color:#65748a;margin-top:3px}
      #branchCalcModal .bc-study-card b{font-size:14px;font-variant-numeric:tabular-nums}#branchCalcModal .bc-study-card .bc-actions{flex-shrink:0}
      #branchCalcModal .bc-tools{margin-top:14px;border-top:1px solid #e0e6ef;padding-top:10px;font-size:12px;color:#526176}#branchCalcModal .bc-tools summary{cursor:pointer;padding:5px 0}#branchCalcModal .bc-tools .bc-actions{margin-top:8px}
      #branchCalcModal .bc-editor-meta{display:flex;align-items:center;gap:12px;background:#fff;padding:12px;border:1px solid #e0e6ef;border-radius:10px;margin-bottom:12px}#branchCalcModal .bc-editor-meta>div{flex:1;min-width:0}#branchCalcModal #bcPermission{font-size:11px;color:#0f369d;background:#edf2ff;padding:5px 8px;border-radius:6px;white-space:nowrap}
      #branchCalcModal .bc-section-toolbar{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:8px}
      #branchCalcModal .bc-section{background:#fff;border:1px solid #e0e6ef;border-radius:10px;margin:8px 0;overflow:hidden}
      #branchCalcModal .bc-heading{display:flex;gap:8px;align-items:center;background:#f0f4fc;padding:8px 10px}
      #branchCalcModal .bc-heading input{font-weight:700;color:#0f369d;background:transparent;border-color:transparent;flex:1;min-width:0;padding:6px}
      #branchCalcModal .bc-heading input:hover{border-color:#b6c6e8}#branchCalcModal .bc-heading button{font-size:12px;padding:6px 8px}
      #branchCalcModal .bc-count{font-size:11px;color:#526176;white-space:nowrap}#branchCalcModal [data-section-total]{font-size:13px;white-space:nowrap;color:#0f369d;font-variant-numeric:tabular-nums}
      #branchCalcModal .bc-row{display:grid;grid-template-columns:minmax(140px,2fr) minmax(65px,.6fr) minmax(90px,1fr) minmax(105px,1fr) 36px;gap:10px;align-items:end;padding:9px 12px;border-top:1px solid #edf0f5}
      #branchCalcModal .bc-row label{margin:0;font-size:11px}#branchCalcModal .bc-row input{margin-top:4px}#branchCalcModal [data-total]{display:flex;align-items:center;min-height:36px;font-size:13px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}
      #branchCalcModal .bc-empty{padding:14px;color:#65748a;margin:0;font-size:12px}
      #branchCalcModal .bc-sharing{max-width:720px;margin:auto;background:#fff;border:1px solid #e0e6ef;border-radius:10px;padding:16px}
      #branchCalcModal .bc-open-row{display:flex;gap:8px;align-items:center}#branchCalcModal .bc-open-row select{flex:1;min-width:0}
      #branchCalcModal .bc-member{display:flex;gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid #edf0f5}#branchCalcModal .bc-member span{flex:1;min-width:0;overflow-wrap:anywhere;font-size:13px}#branchCalcModal .bc-member select{width:150px;max-width:50%}
      #branchCalcModal .bc-footer{flex-shrink:0;padding:10px 20px;background:#fff;border-top:1px solid #dce4ef;display:flex;align-items:center;justify-content:space-between;gap:12px}
      #branchCalcModal .bc-footer>div{min-width:0;flex:1}#branchCalcModal .bc-total-wrap{display:flex;align-items:baseline;gap:12px}#branchCalcModal #branchCalcTotal{font-size:24px;font-weight:800;color:#0f369d;line-height:1.4;white-space:nowrap;font-variant-numeric:tabular-nums}
      #branchCalcModal #bcStatus{font-size:11px;color:#526176;min-height:16px;margin:3px 0 0}#branchCalcModal #bcSave{min-width:120px}
      #branchCalcModal [hidden]{display:none!important}
      @media(max-width:760px){#branchCalcModal .bc-study-card{flex-wrap:wrap}#branchCalcModal .bc-study-info{flex-basis:65%}#branchCalcModal .bc-study-card .bc-actions{width:100%;padding-top:8px;border-top:1px solid #edf0f5}#branchCalcModal .bc-heading{flex-wrap:wrap}#branchCalcModal .bc-heading input{flex-basis:calc(100% - 110px)}#branchCalcModal .bc-row{grid-template-columns:1fr 1fr 36px}#branchCalcModal .bc-item-name{grid-column:1/-1}#branchCalcModal .bc-row [data-total]{grid-column:1/3}#branchCalcModal .bc-row>button{grid-column:3;grid-row:3}}
      @media(max-width:480px){#branchCalcModal{padding:0}#branchCalcModal .mbox{height:100dvh;max-height:none;border-radius:0}#branchCalcModal .mhead{padding:12px 14px}#branchCalcModal h2{font-size:17px}#branchCalcModal .bc-nav{padding:5px 14px}#branchCalcModal .mbody{padding:12px 14px}#branchCalcModal button,#branchCalcModal .btn{min-height:40px;font-size:12px;padding:7px 10px}#branchCalcModal input,#branchCalcModal select{font-size:16px;min-height:40px}#branchCalcModal .bc-heading input{font-size:15px}#branchCalcModal .bc-editor-meta{flex-wrap:wrap}#branchCalcModal .bc-editor-meta>div{flex-basis:100%}#branchCalcModal .bc-footer{padding:10px 14px;align-items:center}#branchCalcModal .bc-total-wrap{display:block}#branchCalcModal #branchCalcTotal{font-size:clamp(16px,5vw,21px)}#branchCalcModal #bcSave{min-width:96px}#branchCalcModal .bc-toolbar h3{flex-basis:100%}#branchCalcModal .bc-search{max-width:none}#branchCalcModal .bc-sharing{padding:12px}}
    </style><div class="mbox"><div class="mhead"><div style="flex:1"><h2 id="bcTitle">دراسات إنشاء الفروع</h2><p class="bc-sub" id="bcSubtitle">احفظ دراساتك وراجع تكلفة كل فرع</p></div><button type="button" class="btn ghost bc-icon" id="branchCalcClose" aria-label="إغلاق">×</button></div>
    <nav class="bc-nav" aria-label="التنقل داخل الحاسبة"><button type="button" id="bcNavList" aria-current="page">الدراسات</button><button type="button" id="bcNavEditor">الدراسة الحالية</button></nav>
    <div class="mbody">
      <section id="bcListView" aria-label="الدراسات المحفوظة"><div class="bc-toolbar"><h3>الدراسات المحفوظة <span id="bcStudyCount" class="bc-count"></span></h3><button type="button" class="btn" id="bcNew">دراسة جديدة</button><button type="button" class="btn ghost" id="bcSync">مزامنة</button></div><label for="bcSearch">البحث باسم الدراسة أو صاحبها</label><input class="bc-search" id="bcSearch" type="search" placeholder="ابحث عن دراسة"><div id="bcStudyList" class="bc-study-list"></div><details class="bc-tools"><summary>النسخ الاحتياطي والاستعادة</summary><div class="bc-actions"><button type="button" class="btn ghost" id="bcBackup">تنزيل نسخة احتياطية</button><button type="button" class="btn ghost" id="bcImport">استعادة نسخة</button><input type="file" id="bcImportFile" accept="application/json,.json" hidden></div></details><div hidden><select id="bcSaved" aria-label="الدراسات"></select><button id="bcOpen" type="button">فتح</button></div></section>
      <section id="bcEditorView" aria-label="تفاصيل الدراسة" hidden><div class="bc-editor-meta"><div><label for="branchCalcName">اسم الفرع أو الدراسة</label><input id="branchCalcName" maxlength="160" placeholder="مثال فرع الشيخ زايد"></div><span id="bcPermission"></span></div><div class="bc-section-toolbar"><h3>أقسام التكلفة</h3><div class="bc-actions"><button type="button" class="btn ghost" id="bcCollapseAll">طي الكل</button><button type="button" class="btn ghost" id="bcExpandAll">فتح الكل</button><button type="button" class="btn ghost" id="branchCalcAdd">إضافة قسم</button></div></div><div id="branchCalcRows"></div></section>
      <section id="bcSharingView" aria-label="مشاركة الدراسة" hidden><div class="bc-toolbar"><h3>المستخدمون والصلاحيات</h3><button type="button" class="btn ghost" id="bcSharingBack">العودة للدراسات</button></div><div id="bcSharing" class="bc-sharing" hidden></div></section>
    </div><div class="bc-footer"><div><div id="bcTotalGroup" class="bc-total-wrap" hidden><span class="bc-sub">الإجمالي</span><div id="branchCalcTotal"></div></div><p id="bcStatus" role="status" aria-live="polite"></p></div><button type="button" class="btn" id="bcSave" hidden>حفظ الدراسة</button></div></div>`;
    document.body.appendChild(modal);
    const $ = s => modal.querySelector(s);
    const status = text => $('#bcStatus').textContent = text;
    let currentView='list';
    function showView(view,focus=true){
      currentView=view;
      $('#bcListView').hidden=view!=='list';$('#bcEditorView').hidden=view!=='editor';$('#bcSharingView').hidden=view!=='sharing';
      $('#bcTotalGroup').hidden=view!=='editor';$('#bcSave').hidden=view!=='editor';
      $('#bcNavList').setAttribute('aria-current',view==='list'?'page':'false');$('#bcNavEditor').setAttribute('aria-current',view==='editor'?'page':'false');
      $('#bcSubtitle').textContent=view==='list'?'اختر دراسة أو ابدأ دراسة جديدة':view==='editor'?'عدّل البنود ثم احفظ الدراسة على الحساب':'حدّد وصول كل مستخدم لهذه الدراسة';
      $('.mbody').scrollTop=0;
      if(focus)(view==='editor'?($('#branchCalcName').disabled?$('#bcNavEditor'):$('#branchCalcName')):$('#bcNavList')).focus();
    }
    $('#bcNavList').onclick=()=>{persist();list();showView('list');};
    $('#bcNavEditor').onclick=()=>showView('editor');
    $('#bcSharingBack').onclick=()=>showView('list');
    $('#bcSearch').oninput=()=>list();

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
      $('#bcPermission').textContent=({owner:'صاحب الدراسة',full:'إضافة وتعديل وحذف',add:'إضافة فقط',edit:'تعديل فقط',view:'استعراض فقط'})[permission()]||'استعراض فقط';
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
      $('#bcStudyCount').textContent='('+db.studies.length+')';
      const term=$('#bcSearch').value.trim().toLocaleLowerCase(),visible=db.studies.filter(s=>!term||(s.name+' '+(s.ownerName||'')).toLocaleLowerCase().includes(term));
      $('#bcStudyList').innerHTML=visible.length?visible.map(s=>`<article class="bc-study-card"><div class="bc-study-info"><strong>${esc(s.name)}</strong><small>صاحب الدراسة ${esc(s.ownerName||'غير مسجل')} · ${esc(s.cloudId?'على الحساب':'نسخة الجهاز')}</small><small>آخر تعديل ${esc(s.updatedAt?new Date(s.updatedAt).toLocaleString('ar-EG'):'—')}</small></div><b style="white-space:nowrap;color:#0f369d">${money(s.sections.reduce((n,x)=>n+subtotal(x),0))}</b><div class="bc-actions" style="margin:0"><button class="btn ghost sm" data-open-study="${esc(s.id)}">فتح الدراسة</button>${s.cloudId&&manage(s)?`<button class="btn ghost sm" data-share-study="${esc(s.id)}" aria-label="صلاحيات ${esc(s.name)}">الصلاحيات</button>`:''}${manage(s)?`<button class="btn ghost sm bc-icon" aria-label="حذف ${esc(s.name)}" title="حذف الدراسة" data-delete-study="${esc(s.id)}" style="color:#b43b2a">${trash}</button>`:''}</div></article>`).join(''):'<p class="bc-sub">'+(term?'لا توجد نتائج لهذا البحث.':'لا توجد دراسات محفوظة. ابدأ دراسة جديدة أو زامن الحساب.')+'</p>';
    }
    function sectionHtml(s) {
      return `<section class="bc-section" data-section="${esc(s.id)}"><div class="bc-heading"><input aria-label="اسم القسم" data-section-name value="${esc(s.name)}" style="flex:1"><span class="bc-count">${s.items.length} بند</span><b data-section-total="${esc(s.id)}"></b><button type="button" class="btn ghost sm" data-toggle aria-expanded="${!s.collapsed}" aria-controls="bc-items-${esc(s.id)}">${s.collapsed ? 'عرض' : 'طي'}</button><button type="button" class="btn ghost sm" data-add>إضافة بند</button><button type="button" class="btn ghost sm bc-danger bc-icon" aria-label="حذف القسم" title="حذف القسم" data-delete-section>${trash}</button></div><div id="bc-items-${esc(s.id)}" ${s.collapsed ? 'hidden' : ''}>${s.items.length ? '' : '<p class="bc-empty">أضف بنود هذا القسم وحدّد الكمية وتكلفة الوحدة لكل بند.</p>'}${s.items.map(r=>`<div class="bc-row" data-item="${esc(r.id)}"><label class="bc-item-name">البند التفصيلي<input data-k="name" value="${esc(r.name)}" placeholder="اسم البند"></label><label>الكمية<input data-k="qty" type="number" min="0" step="any" value="${num(r.qty)}"></label><label>تكلفة الوحدة<input data-k="unit" type="number" min="0" step="any" value="${num(r.unit)}"></label><div data-total aria-label="إجمالي البند">${money(num(r.qty)*num(r.unit))}</div><button type="button" class="btn ghost sm bc-danger bc-icon" aria-label="حذف البند" title="حذف البند" data-delete-item>${trash}</button></div>`).join('')}</div></section>`;
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
      if(e.target.closest('[data-toggle]')){s.collapsed=!s.collapsed;const panel=Array.from(el.children).find(node=>node.id==='bc-items-'+s.id),toggle=el.querySelector('[data-toggle]');panel.hidden=!!s.collapsed;toggle.setAttribute('aria-expanded',String(!s.collapsed));toggle.textContent=s.collapsed?'عرض':'طي';persist();return;}
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
    $('#bcNew').onclick=()=>{if(!persist())return;db.draft=fresh();db.draft.sections.forEach((section,i)=>section.collapsed=i!==0);baseline=copy(db.draft);$('#bcSharing').hidden=true;render();showView('editor');persist('بدأت دراسة جديدة');};
    function openStudy(s){
      if(!s){status('اختر دراسة لفتحها.');return;}
      if(!confirm('فتح النسخة المحفوظة؟ احفظ الدراسة أولاً للاحتفاظ بتعديلات المسودة.'))return;
      db.draft=copy(s);db.draft.sections.forEach((section,i)=>section.collapsed=i!==0);baseline=copy(s);$('#bcSharing').hidden=true;render();showView('editor');persist(permission()==='view'?'تم فتح الدراسة للاستعراض':'تم فتح الدراسة');
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
        const users=await window.SonoStudyStore.users(s),panel=$('#bcSharing');panel.hidden=false;showView('sharing');
        panel.innerHTML=`<h3>مشاركة ${esc(s.name)}</h3><label for="bcAddUser">إضافة مستخدم</label><div class="bc-open-row"><select id="bcAddUser"><option value="">اختر حساباً</option>${users.filter(u=>!u.permission).map(u=>`<option value="${esc(u.user_id)}">${esc(u.name||u.email)}</option>`).join('')}</select><button class="btn ghost" id="bcGrant">إضافة مستخدم</button></div><p class="bc-sub">كل الصلاحيات تسمح بإضافة وتعديل وحذف البنود. مشاركة الدراسة وحذفها بالكامل لصاحب الدراسة والسوبر أدمن.</p>${users.filter(u=>u.permission).map(u=>`<div class="bc-member"><span>${esc(u.name||u.email)}</span><select data-member="${esc(u.user_id)}" aria-label="صلاحيات ${esc(u.name||u.email)}">${Object.entries(labels).map(([k,v])=>`<option value="${k}" ${u.permission===k?'selected':''}>${v}</option>`).join('')}<option value="">إلغاء الوصول</option></select></div>`).join('')}`;
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
      try{if(s.cloudId)await window.SonoStudyStore.remove(s);db.studies=db.studies.filter(x=>x!==s);if(db.draft.id===s.id){db.draft=fresh();baseline=copy(db.draft);}$('#bcSharing').hidden=true;render();showView('list');persist('تم حذف الدراسة.');}catch(e){status(e.message);button.disabled=false;}
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
        db.studies.push(...studies);db.draft=draft;baseline=copy(draft);render();showView('editor');persist('تمت استعادة النسخة');
      }catch(e){status('الملف لا يحتوي نسخة صالحة من دراسات الفروع.');}finally{$('#bcImportFile').value='';}
    };
    const close=()=>{persist();modal.classList.add('hide');document.body.style.overflow=previousOverflow;btn.focus();};let previousOverflow='';$('#branchCalcClose').onclick=close;
    modal.addEventListener('click',e=>{if(e.target===modal)close();});
    modal.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();}if(e.key==='Tab'){const focusable=Array.from(modal.querySelectorAll('button,input,select')).filter(el=>!el.disabled&&!el.closest('[hidden]'));const first=focusable[0],last=focusable[focusable.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
    window.addEventListener('pagehide',()=>persist());
    btn.onclick=()=>{selectAccount();render();previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';modal.classList.remove('hide');showView('list');if(window.SonoStudyStore?.ready())sync();};render();if(readError)status('تعذر قراءة البيانات المحفوظة. لم يتم استبدالها.');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
