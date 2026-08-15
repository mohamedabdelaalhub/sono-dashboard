/* ============================================================
   parser-meta.js — قراءة ملفات التسويق: حملات Meta Ads،
   كشف سحوبات بنكية لدفع الإعلانات، وفاتورة Meta الرسمية.
   ملفات CSV مستقلة تماماً عن ملفات النظام — لا تتقاطع معها.
   ============================================================ */
(function (root) {
'use strict';
const P = () => root.SonoParser;

/* الشهور العربية بدون سنة — نفترض كل التواريخ خلال سنة واحدة تُمرَّر من الخارج */
const AR_MONTHS = {
  'يناير': 1, 'فبراير': 2, 'مارس': 3, 'ابريل': 4, 'أبريل': 4, 'مايو': 5, 'يونيو': 6,
  'يوليو': 7, 'اغسطس': 8, 'أغسطس': 8, 'سبتمبر': 9, 'اكتوبر': 10, 'أكتوبر': 10,
  'نوفمبر': 11, 'ديسمبر': 12
};
function parseArDate(v, assumeYear) {
  if (v === null || v === undefined) return null;
  const s = P().cleanAr(v).trim();
  const m = s.match(/^(\d{1,2})\s+([؀-ۿ]+)/);
  if (!m) return null;
  const day = +m[1], mon = AR_MONTHS[m[2].replace(/أ|إ|آ/g, 'ا')];
  if (!mon) return null;
  const d = new Date(assumeYear, mon - 1, day);
  return isNaN(d) ? null : d;
}
function iso(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
         String(d.getDate()).padStart(2, '0');
}
function sheetRows(wb) {
  const sn = wb.SheetNames[0];
  const ws = wb.Sheets[sn];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true });
}

/* ============================================================
   ١) تقرير حملات Meta Ads — عمود لكل حملة
   ============================================================ */
function detectCampaigns(rows) {
  const head = (rows[0] || []).map(c => String(c || '').trim());
  return head.includes('Campaign name') && head.some(h => /Amount spent/i.test(h));
}
function parseCampaigns(wb, fileName) {
  const rows = sheetRows(wb);
  if (!rows.length || !detectCampaigns(rows)) return null;
  const head = rows[0].map(c => String(c || '').trim());
  const idx = name => head.indexOf(name);
  const iName = idx('Campaign name'), iStatus = idx('Campaign delivery'),
        iSpend = idx('Amount spent (EGP)'), iResults = idx('Results'),
        iCostRes = idx('Cost per results'), iMsgConv = idx('Messaging conversations started'),
        iLeads = idx('Leads'), iCostLead = idx('Cost per lead (EGP)'),
        iStart = idx('Reporting starts'), iEnd = idx('Reporting ends'),
        iObjective = idx('Objective');
  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] || [];
    if (!row.some(c => c !== null && String(c).trim())) continue;
    const name = iName >= 0 ? String(row[iName] || '').trim() : '';
    if (!name) continue;
    const num = i => { const v = i >= 0 ? row[i] : null; const n = P().toNum(v); return n === null ? 0 : n; };
    out.push({
      name, status: iStatus >= 0 ? String(row[iStatus] || '') : '',
      objective: iObjective >= 0 ? String(row[iObjective] || '') : '',
      spend: num(iSpend), results: num(iResults), costPerResult: num(iCostRes),
      messagingConv: num(iMsgConv), leads: num(iLeads), costPerLead: num(iCostLead),
      start: iStart >= 0 ? row[iStart] : null, end: iEnd >= 0 ? row[iEnd] : null
    });
  }
  return { kind: 'metaCampaigns', file: fileName, rows: out };
}

/* ============================================================
   ٢) كشف سحوبات بنكية لدفع إعلانات — عربي، بدون سنة في التاريخ
   ============================================================ */
function detectBankWithdrawals(rows) {
  const head = (rows[0] || []).map(c => P().normAr(c));
  return head.some(h => h.includes('كود العمليه') || h.includes('كود العملية')) &&
         head.some(h => h.includes('البيان'));
}
function parseBankWithdrawals(wb, fileName, assumeYear) {
  const rows = sheetRows(wb);
  if (!rows.length || !detectBankWithdrawals(rows)) return null;
  assumeYear = assumeYear || new Date().getFullYear();
  const head = rows[0].map(c => P().normAr(c));
  const iDate = head.findIndex(h => h.includes('التاريخ')),
        iTime = head.findIndex(h => h.includes('الوقت')),
        iAmount = head.findIndex(h => h.includes('القيمه')),
        iCode = head.findIndex(h => h.includes('كود العمليه') || h.includes('كود العملية')),
        iDesc = head.findIndex(h => h.includes('البيان'));
  /* آخر الكشف فيه صفوف تسوية/إجمالي (إيداع مقدم، تحويل ١-٤، إجمالي السحوبات، صافي الرصيد)
     تحمل نصاً بدل التاريخ في عمود التاريخ — نستبعدها من سحوبات الإعلانات الفعلية
     لأنها مش معاملة سحب حقيقية، ونجمّعها في settlements للعرض فقط لو احتجناها. */
  const out = [], settlements = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] || [];
    if (!row.some(c => c !== null && String(c).trim())) continue;
    const d = iDate >= 0 ? parseArDate(row[iDate], assumeYear) : null;
    const amtRaw = iAmount >= 0 ? P().toNum(row[iAmount]) : null;
    if (amtRaw === null) continue;
    const desc = iDesc >= 0 ? P().cleanAr(row[iDesc]) : '';
    if (!d) { settlements.push({ label: iDate >= 0 ? String(row[iDate] || '') : '', amount: amtRaw, desc }); continue; }
    out.push({
      date: iso(d), dateRaw: iDate >= 0 ? String(row[iDate] || '') : '',
      time: iTime >= 0 ? String(row[iTime] || '') : '',
      amount: Math.abs(amtRaw),
      code: iCode >= 0 ? String(row[iCode] || '') : '',
      desc
    });
  }
  return { kind: 'bankWithdrawals', file: fileName, rows: out, settlements, assumeYear };
}

/* ============================================================
   ٣) فاتورة Meta الرسمية — ترويسة نصية ثم جدول معاملات
   ============================================================ */
function detectInvoice(rows) {
  return rows.some(r => (r || []).some(c => String(c || '').trim() === 'Transaction ID'));
}
function parseInvoice(wb, fileName) {
  const rows = sheetRows(wb);
  if (!rows.length || !detectInvoice(rows)) return null;
  const hdrIdx = rows.findIndex(r => (r || []).some(c => String(c || '').trim() === 'Transaction ID'));
  if (hdrIdx < 0) return null;
  const head = rows[hdrIdx].map(c => String(c || '').trim());
  const iDate = head.indexOf('Date'), iTxn = head.indexOf('Transaction ID'),
        iAmount = head.indexOf('Amount'), iCurrency = head.indexOf('Currency');
  const out = [];
  let total = null;
  for (let r = hdrIdx + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    if (!row.some(c => c !== null && String(c).trim())) continue;
    const txn = iTxn >= 0 ? String(row[iTxn] || '').trim() : '';
    const amt = iAmount >= 0 ? P().toNum(row[iAmount]) : null;
    if (!txn && row.some(c => /Total amount billed/i.test(String(c || '')))) {
      total = amt; continue;
    }
    if (!txn || amt === null) continue;
    const dRaw = iDate >= 0 ? String(row[iDate] || '') : '';
    const m = dRaw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    const dateIso = m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
    out.push({ date: dateIso, dateRaw: dRaw, txnId: txn, amount: amt,
               currency: iCurrency >= 0 ? String(row[iCurrency] || '') : 'EGP' });
  }
  return { kind: 'metaInvoice', file: fileName, rows: out,
           total: total !== null ? total : out.reduce((s, r) => s + r.amount, 0) };
}

root.SonoMetaParser = {
  detectCampaigns, parseCampaigns,
  detectBankWithdrawals, parseBankWithdrawals,
  detectInvoice, parseInvoice
};
})(window);
