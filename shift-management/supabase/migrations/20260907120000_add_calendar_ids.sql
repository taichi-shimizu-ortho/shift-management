-- 同期対象の Google カレンダーID一覧
-- 'primary' はログイン中のアカウント本人のメインカレンダー
alter table public.user_settings
  add column calendar_ids text[] default '{"primary", "family08074183291321109187@group.calendar.google.com"}'::text[];
