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
    modal.innerHTML = `<style>
      #branchCalcModal .bc-actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}
      #branchCalcModal .bc-section{border:1px solid #ddd;border-radius:12px;padding:12px;margin:12px 0}
      #branchCalcModal .bc-heading{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
      #branchCalcModal input{width:100%;min-width:0;padding:8px;box-sizing:border-box}
      #branchCalcModal .bc-row{display:grid;grid-template-columns:minmax(140px,2fr) 1fr 1fr 1fr auto;gap:8px;align-items:end;margin:10px 0}
      #branchCalcModal label{display:block;font-size:12px}
      @media(max-width:600px){#branchCalcModal .bc-row{grid-template-columns:1fr 1fr}#branchCalcModal .bc-item-name{grid-column:1/-1}}
    </style><div class="mbox" style="max-width:1000px"><div class="mhead"><h2>حاسبة تكلفة إنشاء فرع جديد</h2><button type="button" class="btn ghost icon" id="branchCalcClose" aria-label="إغلاق">×</button></div><div class="mbody">
      <label for="branchCalcName">اسم الفرع أو الدراسة</label><input id="branchCalcName" placeholder="مثال فرع الشيخ زايد">
      <div class="bc-actions"><button type="button" class="btn" id="bcSave">حفظ الدراسة</button><button type="button" class="btn ghost" id="bcNew">دراسة جديدة</button><button type="button" class="btn ghost" id="branchCalcAdd">إضافة قسم</button></div>
      <label for="bcSaved">الدراسات المحفوظة</label><select id="bcSaved" style="width:100%"></select><div class="bc-actions"><button type="button" class="btn ghost" id="bcOpen">فتح الدراسة</button></div>
      <p>الحفظ على هذا المتصفح والجهاز. التعديلات تُحفظ كمسودة. اضغط حفظ الدراسة لتحديث النسخة المحفوظة.</p>
      <p id="bcStatus" role="status"></p><div id="branchCalcRows"></div><div style="border-top:1px solid #ddd;padding:16px"><span>إجمالي تكلفة إنشاء الفرع</span><div id="branchCalcTotal" style="font-size:27px;font-weight:800"></div></div>
    </div></div>`;
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
      $('#branchCalcRows').innerHTML = db.draft.sections.map(s=>`<section class="bc-section" data-section="${s.id}"><div class="bc-heading"><input aria-label="اسم القسم" data-section-name value="${esc(s.name)}" style="flex:1"><b data-section-total="${s.id}"></b><button type="button" class="btn ghost sm" data-add>إضافة بند تفصيلي</button><button type="button" class="btn ghost sm" data-delete-section>حذف القسم</button></div>${s.items.map(r=>`<div class="bc-row" data-item="${r.id}"><label class="bc-item-name">البند التفصيلي<input data-k="name" value="${esc(r.name)}" placeholder="اسم البند"></label><label>الكمية<input data-k="qty" type="number" min="0" step="any" value="${num(r.qty)}"></label><label>تكلفة الوحدة<input data-k="unit" type="number" min="0" step="any" value="${num(r.unit)}"></label><div data-total>${money(num(r.qty)*num(r.unit))}</div><button type="button" class="btn ghost sm" data-delete-item>حذف</button></div>`).join('')}</section>`).join('');
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
      if(e.target.closest('[data-add]'))s.items.push(item());
      else if(e.target.closest('[data-delete-item]')){const row=e.target.closest('[data-item]');s.items=s.items.filter(r=>r.id!==row.dataset.item);}
      else if(e.target.closest('[data-delete-section]')){if(!confirm('حذف القسم وكل بنوده؟'))return;db.draft.sections=db.draft.sections.filter(x=>x.id!==s.id);}
      else return;
      render();persist();
    });
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
    const close=()=>modal.classList.add('hide');$('#branchCalcClose').onclick=close;
    modal.addEventListener('click',e=>{if(e.target===modal)close();});
    btn.onclick=()=>{render();modal.classList.remove('hide');};render();if(readError)status('تعذر قراءة البيانات المحفوظة. لم يتم استبدالها.');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
