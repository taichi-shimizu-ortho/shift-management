import type { Assignment } from '../types';
import { cleanDisplayName } from '../lib/displayName';

interface ShiftBadgeProps {
  assignment: Assignment & {
    profiles: { full_name: string; display_name?: string | null };
    shift_types: { name: string; color: string };
  };
  isAdmin: boolean;
  onDelete?: (id: string) => void;
}

export function ShiftBadge({ assignment, isAdmin, onDelete }: ShiftBadgeProps) {
  // 埋め込み取得（profiles / shift_types）が欠けていても画面全体が落ちないようにする
  const color = assignment.shift_types?.color ?? '#6b7280';
  const shiftName = assignment.shift_types?.name ?? '種別不明';
  // 表示名が設定されていればそれを使い、無ければ full_name を整形して使う
  const profile = assignment.profiles;
  const doctorName =
    profile?.display_name?.trim() || cleanDisplayName(profile?.full_name ?? '担当不明');

  // 括弧の中は行先名（note）を優先し、手動登録などで note が無いものは勤務種別を出す。
  // 種別（当直／外勤）はバッジの色でも区別できる。
  const label = assignment.note?.trim() || shiftName;

  return (
    <div
      className="flex items-center justify-between gap-1 px-2 py-1 rounded text-xs text-white mb-1"
      style={{ backgroundColor: color }}
    >
      <span className="truncate">
        {doctorName}（{label}）
      </span>
      {isAdmin && onDelete && (
        <button
          onClick={() => onDelete(assignment.id)}
          className="ml-1 hover:opacity-80 font-bold"
        >
          ✕
        </button>
      )}
    </div>
  );
}
