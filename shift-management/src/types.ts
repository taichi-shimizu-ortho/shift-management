export type Profile = {
  id: string;
  full_name: string;
  role: 'doctor' | 'admin';
  is_active: boolean;
  created_at: string;
};

export type ShiftType = {
  id: number;
  name: string;
  color: string;
  sort_order: number;
};

export type Assignment = {
  id: string;
  doctor_id: string;
  shift_type_id: number;
  duty_date: string;
  note?: string;
  created_by?: string;
  created_at: string;
  profiles?: { full_name: string };
  shift_types?: { name: string; color: string };
};

export type MonthlyCounts = {
  doctor_id: string;
  full_name: string;
  shift_type_id: number;
  shift_name: string;
  month: string;
  cnt: number;
};
