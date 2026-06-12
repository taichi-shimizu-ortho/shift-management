import { Assignment } from '../types';

interface ShiftBadgeProps {
  assignment: Assignment & {
    profiles: { full_name: string };
    shift_types: { name: string; color: string };
  };
  isAdmin: boolean;
  onDelete?: (id: string) => void;
}

export function ShiftBadge({ assignment, isAdmin, onDelete }: ShiftBadgeProps) {
  const color = assignment.shift_types.color;

  return (
    <div
      className="flex items-center justify-between gap-1 px-2 py-1 rounded text-xs text-white mb-1"
      style={{ backgroundColor: color }}
    >
      <span className="truncate">
        {assignment.shift_types.name}: {assignment.profiles.full_name}
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
