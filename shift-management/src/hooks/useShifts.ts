import { supabase } from '../lib/supabaseClient';
import type { Assignment, MonthlyCounts, ShiftType, Profile } from '../types';

// 月のシフト一覧を取得
export async function fetchMonth(yearMonth: string) {
  const start = `${yearMonth}-01`;
  const lastDay = new Date(
    parseInt(yearMonth.slice(0, 4)),
    parseInt(yearMonth.slice(5, 7)),
    0
  ).getDate();
  const end = `${yearMonth}-${String(lastDay).padStart(2, '0')}`;

  const { data, error } = await supabase
    .from('assignments')
    .select(
      'id, duty_date, note, doctor_id, shift_type_id, profiles(full_name), shift_types(name, color)'
    )
    .gte('duty_date', start)
    .lte('duty_date', end)
    .order('duty_date');

  if (error) throw error;
  return data as Array<Assignment & { profiles: { full_name: string }; shift_types: { name: string; color: string } }>;
}

// シフト種別を取得
export async function fetchShiftTypes() {
  const { data, error } = await supabase
    .from('shift_types')
    .select('*')
    .order('sort_order');

  if (error) throw error;
  return data as ShiftType[];
}

// 医師一覧を取得
export async function fetchDoctors() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('is_active', true)
    .order('full_name');

  if (error) throw error;
  return data as Profile[];
}

// シフト割り当て
export async function assignShift(
  doctorId: string,
  shiftTypeId: number,
  date: string
) {
  const { error } = await supabase.from('assignments').insert({
    doctor_id: doctorId,
    shift_type_id: shiftTypeId,
    duty_date: date,
  });

  if (error) throw error;
}

// シフト削除
export async function deleteAssignment(assignmentId: string) {
  const { error } = await supabase
    .from('assignments')
    .delete()
    .eq('id', assignmentId);

  if (error) throw error;
}

// 月別・医師別の集計
export async function fetchCounts(yearMonth: string) {
  const { data, error } = await supabase
    .from('monthly_counts')
    .select('*')
    .eq('month', yearMonth)
    .order('full_name');

  if (error) throw error;
  return data as MonthlyCounts[];
}
