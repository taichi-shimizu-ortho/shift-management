create table public.user_settings (
  user_id uuid references public.profiles(id) on delete cascade primary key,
  external_duty_names text[] default '{"新小倉", "赤池", "稲築", "タケスポ", "新庄", "芳野", "小波瀬"}'::text[],
  night_duty_names text[] default '{"当直", "若松", "若松日当直"}'::text[],
  calendar_ids text[] default '{"primary", "family08074183291321109187@group.calendar.google.com"}'::text[],
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.user_settings enable row level security;

-- Create policies
create policy "Users can view own settings"
  on public.user_settings for select
  using (auth.uid() = user_id);

create policy "Users can insert own settings"
  on public.user_settings for insert
  with check (auth.uid() = user_id);

create policy "Users can update own settings"
  on public.user_settings for update
  using (auth.uid() = user_id);
