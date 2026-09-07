-- カレンダー上の表示名。Google アカウントの表示名は「清水太一(taichi8)」のように
-- ID が併記されていたりフルネームだったりするため、表示用の名前を別に持てるようにする。
-- 未設定なら full_name にフォールバックする（アプリ側で処理）。
alter table public.profiles add column display_name text;
