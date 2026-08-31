/* ============================================================
   notify-store.js — مركز الإشعارات: تسجيل الأحداث + بثّها لحظياً
   عبر Supabase Realtime للسوبر أدمن والمدير فقط.
   يعمل فقط مع Supabase — لا شيء في الوضع المحلي.
   ============================================================ */
(function (root) {
'use strict';
const LS_SEEN = 'sono_notif_seen_at';

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

/* آخر ٥٠ إشعاراً — للقائمة المنسدلة */
async function list(sb) {
  if (!sb) return [];
  try {
    const { data, error } = await sb.from('notifications')
      .select('id,event_type,actor_name,message,created_at')
      .order('created_at', { ascending: false }).limit(50);
    if (error) return [];
    return data || [];
  } catch (e) { return []; }
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

root.SonoNotify = { log, list, lastSeen, markSeen, subscribe };
})(window);
