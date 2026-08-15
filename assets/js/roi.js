/* ============================================================
   roi.js — تحليل «التسويق والعائد»: أداء حملات Meta، فجوة الإنفاق
   (الرسمي مقابل الفعلي)، والعائد الحقيقي (مطابقة قناة سوشيال ميديا
   من بيان الحالة التفصيلي مع الإنفاق الفعلي).
   بيانات فقط — لا واجهة هنا.
   ============================================================ */
(function (root) {
'use strict';

function isSocial(ch) {
  const t = String(ch || '').trim();
  return t.includes('سوشيال') || /social/i.test(t);
}

/* ---------- ١) أداء الحملات ---------- */
function perf(campaigns) {
  if (!campaigns || !campaigns.rows || !campaigns.rows.length) return null;
  const rows = campaigns.rows;
  const totalSpend = rows.reduce((s, r) => s + r.spend, 0);
  const totalMsgConv = rows.reduce((s, r) => s + r.messagingConv, 0);
  const totalLeads = rows.reduce((s, r) => s + r.leads, 0);
  const byCampaign = rows.map(r => ({
    name: r.name, spend: r.spend, results: r.results,
    costPerResult: r.costPerResult, messagingConv: r.messagingConv,
    leads: r.leads, costPerLead: r.costPerLead
  })).sort((a, b) => b.spend - a.spend);
  return {
    totalSpend, totalMsgConv, totalLeads,
    avgCostPerResult: totalSpend / (rows.reduce((s, r) => s + r.results, 0) || 1),
    avgCostPerLead: totalLeads ? totalSpend / totalLeads : 0,
    byCampaign, count: rows.length
  };
}

/* ---------- اتجاه الإنفاق اليومي من كشف السحوبات ---------- */
function spendTrend(bank) {
  if (!bank || !bank.rows || !bank.rows.length) return [];
  const byDay = {};
  bank.rows.forEach(r => { if (r.date) byDay[r.date] = (byDay[r.date] || 0) + r.amount; });
  return Object.keys(byDay).sort().map(d => ({ x: d, y: Math.round(byDay[d] * 100) / 100, full: 'يوم ' + d }));
}

/* ---------- ٢) فجوة الإنفاق: الرسمي (فاتورة Meta) مقابل الفعلي (سحوبات البنك) ---------- */
function gap(invoice, bank) {
  if (!invoice && !bank) return null;
  const official = invoice ? (invoice.total || invoice.rows.reduce((s, r) => s + r.amount, 0)) : 0;
  const actual = bank ? bank.rows.reduce((s, r) => s + r.amount, 0) : 0;
  const diff = actual - official;
  return {
    official, actual, gap: diff,
    gapPct: official ? diff / official : null,
    settlementsTotal: bank ? (bank.settlements || []).reduce((s, r) => s + (r.amount > 0 ? r.amount : 0), 0) : 0
  };
}

/* ---------- ٣) العائد الحقيقي: قناة سوشيال ميديا من بيان الحالة مقابل الإنفاق الفعلي ---------- */
function trueRoi(statusRows, bank, campaigns) {
  const social = (statusRows || []).filter(r => isSocial(r.channel));
  const bookings = social.length;
  const revenue = social.reduce((s, r) => s + (r.total || 0), 0);
  const spend = bank ? bank.rows.reduce((s, r) => s + r.amount, 0) : 0;
  const leads = campaigns ? campaigns.rows.reduce((s, r) => s + r.messagingConv + r.leads, 0) : 0;
  return {
    bookings, revenue, spend,
    hasData: bookings > 0 && spend > 0,
    conversionRate: leads ? bookings / leads : null,
    cac: bookings ? spend / bookings : null,
    roi: spend ? (revenue - spend) / spend : null,
    leads
  };
}

/* ---------- الواجهة العامة ---------- */
function analyze(inputs) {
  const { campaigns, bank, invoice, statusRows } = inputs || {};
  const P = perf(campaigns);
  const G = gap(invoice, bank);
  const R = trueRoi(statusRows, bank, campaigns);
  const has = !!(P || G || (statusRows && statusRows.length));
  return { has, perf: P, gap: G, roi: R, spendTrend: spendTrend(bank) };
}

root.SonoRoi = { analyze, isSocial };
})(window);
