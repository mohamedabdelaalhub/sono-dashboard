-- ============================================================
--  ترقية إضافية على تاب «توزيع أرباح الأميدا»: تحويل الجنيه المصري
--  شغّله مرة واحدة بعد migration-amida.sql
--  آمن للتشغيل أكثر من مرة. لا يمسّ أي بيانات موجودة.
-- ============================================================

alter table public.amida_settings add column if not exists exchange_rate numeric not null default 75;
alter table public.amida_settings add column if not exists deduction     numeric not null default 5;

alter table public.amida_archive  add column if not exists exchange_rate numeric;
alter table public.amida_archive  add column if not exists deduction     numeric;
