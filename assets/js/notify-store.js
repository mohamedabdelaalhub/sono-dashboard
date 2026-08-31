/* ============================================================
   notify-store.js — مركز الإشعارات: تسجيل الأحداث + بثّها لحظياً
   عبر Supabase Realtime للسوبر أدمن والمدير فقط.
   يعمل فقط مع Supabase — لا شيء في الوضع المحلي.
   ============================================================ */
(function (root) {
'use strict';
const LS_SEEN = 'sono_notif_seen_at';
const LS_RET  = 'sono_notif_retention';

/* تسجيل حدث — لا يوقف أي عملية لو فشل (تسجيل ثانوي دائماً) */
async function log(sb, user, type, message) {
  if (!sb || !user) return;
  try {
    await sb.from('notifications').insert({
      event_type: type, actor_id: user.id || null,
      actor_name: user.name || user.email || 'مستخدم', message
    });
  } catch (e) {}
}

/* آخر إشعارات — بحد افتراضي ٥٠ للقائمة المنسدلة، أو أكتر لصفحة الإشعارات كاملة */
async function list(sb, limit) {
  if (!sb) return [];
  try {
    const { data, error } = await sb.from('notifications')
      .select('id,event_type,actor_name,message,created_at')
      .order('created_at', { ascending: false }).limit(limit || 50);
    if (error) return [];
    return data || [];
  } catch (e) { return []; }
}

/* ---------- دورية مسح الإشعارات: يحدّدها السوبر أدمن/المدير ----------
   محفوظة محلياً في متصفح من يضبطها. mode: 'count' (احتفظ بآخر N) أو 'days' (احذف الأقدم من N يوم). */
function getRetention() {
  try {
    const raw = localStorage.getItem(LS_RET);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { mode: 'days', value: 90 };
}
function setRetention(cfg) {
  try { localStorage.setItem(LS_RET, JSON.stringify(cfg)); } catch (e) {}
}

/* مسح فعلي حسب الإعداد — يُنادى مرة عند فتح صفحة الإشعارات أو عند الحفظ */
async function purge(sb, cfg) {
  if (!sb) return { deleted: 0 };
  cfg = cfg || getRetention();
  try {
    if (cfg.mode === 'count' && cfg.value > 0) {
      const { data } = await sb.from('notifications').select('id')
        .order('created_at', { ascending: false }).range(cfg.value, cfg.value + 1);
      if (data && data[0]) {
        const { error, count } = await sb.from('notifications').delete({ count: 'exact' })
          .lt('id', data[0].id);
        return { deleted: error ? 0 : (count || 0) };
      }
      return { deleted: 0 };
    }
    if (cfg.mode === 'days' && cfg.value > 0) {
      const cutoff = new Date(Date.now() - cfg.value * 86400000).toISOString();
      const { error, count } = await sb.from('notifications').delete({ count: 'exact' })
        .lt('created_at', cutoff);
      return { deleted: error ? 0 : (count || 0) };
    }
  } catch (e) {}
  return { deleted: 0 };
}

/* آخر وقت شاف فيه المستخدم الإشعارات — محفوظ محلياً في المتصفح */
function lastSeen() { try { return localStorage.getItem(LS_SEEN) || null; } catch (e) { return null; } }
function markSeen() { try { localStorage.setItem(LS_SEEN, new Date().toISOString()); } catch (e) {} }

/* اشتراك لحظي: ينادي onInsert بكل إشعار جديد فور حدوثه */
function subscribe(sb, onInsert) {
  if (!sb) return null;
  try {
    return sb.channel('notif-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' },
        payload => onInsert(payload.new))
      .subscribe();
  } catch (e) { return null; }
}

root.SonoNotify = { log, list, lastSeen, markSeen, subscribe, getRetention, setRetention, purge };
})(window);
