-- Google のリフレッシュトークン置き場。
-- アクセストークンは1時間で失効するため、これを使って Edge Function 側で再発行する。
create table public.google_refresh_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token text not null,
  updated_at timestamptz not null default now()
);

-- RLS を有効化した上でポリシーを1つも作らない。
-- これにより anon / authenticated キー経由（＝ブラウザ）からは読み書きとも一切できず、
-- service_role を持つ Edge Function だけが操作できる。
-- リフレッシュトークンは無期限に有効な資格情報なので、ブラウザには決して渡さない。
alter table public.google_refresh_tokens enable row level security;

revoke all on public.google_refresh_tokens from anon, authenticated;
