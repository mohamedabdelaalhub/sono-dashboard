-- ============================================================
--  ترقية إضافية على تاب «توزيع أرباح الأميدا»: تعديل وحذف الأرشيف
--  شغّله مرة واحدة بعد migration-amida.sql و migration-amida-fx.sql
--  آمن للتشغيل أكثر من مرة. لا يمسّ أي بيانات موجودة.
--
--  التعديل والحذف على سجل الأرشيف مقصوران على السوبر أدمن فقط —
--  حتى لو حد تاني ممنوح تاب "amida" (زي دور مستثمر الأميدا)، يقدر
--  يشوف السجل بس مايقدرش يعدّله ولا يحذفه.
-- ============================================================

drop policy if exists "amida granted delete archive" on public.amida_archive;
drop policy if exists "amida super delete archive"   on public.amida_archive;
drop policy if exists "amida super update archive"   on public.amida_archive;

create policy "amida super delete archive"
  on public.amida_archive for delete to authenticated
  using (public.is_super());

create policy "amida super update archive"
  on public.amida_archive for update to authenticated
  using (public.is_super()) with check (public.is_super());
