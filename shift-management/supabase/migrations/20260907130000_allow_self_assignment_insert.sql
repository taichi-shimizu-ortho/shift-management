-- Google カレンダー同期は本人が自分の予定を assignments に書き込む。
-- 既存の insert ポリシーは管理者のみを許可しているため、doctor ロールでは
-- 同期が RLS でブロックされていた。自分自身の行に限り登録・削除を許可する。
create policy "self_insert_assignments"
  on assignments for insert
  to authenticated
  with check (doctor_id = auth.uid());

create policy "self_delete_assignments"
  on assignments for delete
  to authenticated
  using (doctor_id = auth.uid());
