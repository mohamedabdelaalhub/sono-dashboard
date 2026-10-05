(function () {
  'use strict';
  const OLD = 'sono_branch_setup_calculator_v1';
  const KEY = 'sono_branch_setup_calculator_v2';
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
      <div class="bc-panel"><label for="bcSaved">الدراسات المحفوظة</label><div class="bc-open-row"><select id="bcSaved"></select><button type="button" class="btn ghost" id="bcOpen">فتح</button></div><p class="bc-sub">الحفظ على هذا الجهاز والمتصفح. المسودة تُحفظ أثناء الكتابة.</p></div></div>
      <div class="bc-section-toolbar"><h3>أقسام التأسيس</h3><div class="bc-actions" style="margin:0"><button type="button" class="btn ghost sm" id="bcCollapseAll">طي الكل</button><button type="button" class="btn ghost sm" id="bcExpandAll">فتح الكل</button><button type="button" class="btn ghost" id="branchCalcAdd">إضافة قسم</button></div></div><div id="branchCalcRows"></div>
    </div><div class="bc-footer"><div><span class="bc-sub">إجمالي تكلفة الفرع</span><div id="branchCalcTotal"></div><p id="bcStatus" role="status" aria-live="polite"></p></div><button type="button" class="btn" id="bcSave">حفظ الدراسة</button></div></div>`;
    document.body.appendChild(modal);
    const $ = s => modal.querySelector(s);
    const status = text => $('#bcStatus').textContent = text;
    function persist(message) {
      if (readError) { status('تعذر قراءة البيانات المحفوظة. لم يتم استبدالها.'); return false; }
      try {localStorage.setItem(KEY,JSON.stringify(db));status(message || 'تم حفظ المسودة');return true;}
      catch {status('تعذر الحفظ على هذا المتصفح. المدخلات ما زالت معروضة.');return false;}
    }
    function totals() {
      db.draft.sections.forEach(s => {const el = modal.querySelector(`[data-section-total="${s.id}"]`);if(el)el.textContent=money(subtotal(s));});
      $('#branchCalcTotal').textContent = money(db.draft.sections.reduce((n,s)=>n+subtotal(s),0));
    }
    function list() {
      const selected = $('#bcSaved').value;
      $('#bcSaved').innerHTML = '<option value="">اختر دراسة</option>' + db.studies.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');
      $('#bcSaved').value = selected;
    }
    function render() {
      $('#branchCalcName').value = db.draft.name;
      $('#branchCalcRows').innerHTML = db.draft.sections.map(s=>`<section class="bc-section" data-section="${s.id}"><div class="bc-heading"><input aria-label="اسم القسم" data-section-name value="${esc(s.name)}" style="flex:1"><span class="bc-count">${s.items.length} بند</span><b data-section-total="${s.id}"></b><button type="button" class="btn ghost sm" data-toggle aria-expanded="${!s.collapsed}" aria-controls="bc-items-${s.id}">${s.collapsed ? 'فتح التفاصيل' : 'طي التفاصيل'}</button><button type="button" class="btn ghost sm" data-add>إضافة بند تفصيلي</button><button type="button" class="btn ghost sm" data-delete-section>حذف القسم</button></div><div id="bc-items-${s.id}" ${s.collapsed ? 'hidden' : ''}>${s.items.length ? '' : '<p class="bc-empty">أضف بنود هذا القسم وحدّد الكمية وتكلفة الوحدة لكل بند.</p>'}${s.items.map(r=>`<div class="bc-row" data-item="${r.id}"><label class="bc-item-name">البند التفصيلي<input data-k="name" value="${esc(r.name)}" placeholder="اسم البند"></label><label>الكمية<input data-k="qty" type="number" min="0" step="any" value="${num(r.qty)}"></label><label>تكلفة الوحدة<input data-k="unit" type="number" min="0" step="any" value="${num(r.unit)}"></label><div data-total aria-label="إجمالي البند">${money(num(r.qty)*num(r.unit))}</div><button type="button" class="btn ghost sm" data-delete-item>حذف</button></div>`).join('')}</div></section>`).join('');
      totals();list();
    }
    $('#branchCalcName').oninput = e => {db.draft.name=e.target.value;persist();};
    $('#branchCalcRows').addEventListener('input', e=>{
      const el=e.target.closest('[data-section]');if(!el)return;
      const s=db.draft.sections.find(s=>s.id===el.dataset.section);
      if(e.target.hasAttribute('data-section-name'))s.name=e.target.value;
      else {const row=e.target.closest('[data-item]');if(!row)return;const r=s.items.find(r=>r.id===row.dataset.item);const k=e.target.dataset.k;if(!['name','qty','unit'].includes(k))return;r[k]=k==='name'?e.target.value:num(e.target.value);row.querySelector('[data-total]').textContent=money(num(r.qty)*num(r.unit));}
      totals();persist();
    });
    $('#branchCalcRows').addEventListener('click', e=>{
      const el=e.target.closest('[data-section]');if(!el)return;const s=db.draft.sections.find(s=>s.id===el.dataset.section);
      if(e.target.closest('[data-toggle]')){s.collapsed=!s.collapsed;const panel=el.querySelector('#bc-items-'+s.id),toggle=el.querySelector('[data-toggle]');panel.hidden=!!s.collapsed;toggle.setAttribute('aria-expanded',String(!s.collapsed));toggle.textContent=s.collapsed?'فتح التفاصيل':'طي التفاصيل';persist();return;}
      if(e.target.closest('[data-add]')){s.collapsed=false;s.items.push(item());}
      else if(e.target.closest('[data-delete-item]')){const row=e.target.closest('[data-item]');s.items=s.items.filter(r=>r.id!==row.dataset.item);}
      else if(e.target.closest('[data-delete-section]')){if(!confirm('حذف القسم وكل بنوده؟'))return;db.draft.sections=db.draft.sections.filter(x=>x.id!==s.id);}
      else return;
      render();persist();
      if(e.target.closest('[data-add]')){const inputs=modal.querySelectorAll(`[data-section="${s.id}"] [data-k="name"]`);inputs[inputs.length-1]?.focus();}
    });
    $('#bcCollapseAll').onclick=()=>{db.draft.sections.forEach(s=>s.collapsed=true);render();persist();};
    $('#bcExpandAll').onclick=()=>{db.draft.sections.forEach(s=>s.collapsed=false);render();persist();};
    $('#branchCalcAdd').onclick=()=>{db.draft.sections.push({id:id(),name:'قسم جديد',items:[]});render();persist();};
    $('#bcSave').onclick=()=>{
      if(!db.draft.name.trim()){status('اكتب اسم الفرع أو الدراسة قبل الحفظ.');$('#branchCalcName').focus();return;}
      const previous=copy(db.studies), snapshot=copy(db.draft);snapshot.name=snapshot.name.trim();snapshot.updatedAt=new Date().toISOString();
      const i=db.studies.findIndex(s=>s.id===snapshot.id);if(i<0)db.studies.push(snapshot);else db.studies[i]=snapshot;
      if(!persist('تم حفظ الدراسة'))db.studies=previous;
      list();$('#bcSaved').value=snapshot.id;
    };
    $('#bcNew').onclick=()=>{if(!persist())return;db.draft=fresh();render();persist('بدأت دراسة جديدة');};
    $('#bcOpen').onclick=()=>{const s=db.studies.find(s=>s.id===$('#bcSaved').value);if(!s){status('اختر دراسة لفتحها.');return;}if(!confirm('فتح النسخة المحفوظة؟ اضغط حفظ الدراسة أولاً إذا أردت الاحتفاظ بتعديلات المسودة الحالية.'))return;db.draft=copy(s);render();persist('تم فتح الدراسة ويمكنك تعديلها');};
    const close=()=>{modal.classList.add('hide');document.body.style.overflow=previousOverflow;btn.focus();};let previousOverflow='';$('#branchCalcClose').onclick=close;
    modal.addEventListener('click',e=>{if(e.target===modal)close();});
    modal.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();}if(e.key==='Tab'){const focusable=Array.from(modal.querySelectorAll('button,input,select')).filter(el=>!el.disabled&&!el.closest('[hidden]'));const first=focusable[0],last=focusable[focusable.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
    btn.onclick=()=>{render();previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';modal.classList.remove('hide');$('#branchCalcName').focus();};render();if(readError)status('تعذر قراءة البيانات المحفوظة. لم يتم استبدالها.');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
