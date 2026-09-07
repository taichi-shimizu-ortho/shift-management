import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { ja } from 'date-fns/locale';
import { useAuthStore } from '../store/authStore';
import { fetchMonth, fetchShiftTypes, fetchDoctors, assignShift, deleteAssignment } from '../hooks/useShifts';
import { ShiftBadge } from '../components/ShiftBadge';
import type { Assignment, ShiftType, Profile } from '../types';
import { ChevronLeft, ChevronRight, LogOut } from 'lucide-react';

export function Calendar() {
  const { user, logout, isAdmin } = useAuthStore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);
  const [doctors, setDoctors] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ date: string; doctorId?: string } | null>(null);

  const yearMonth = format(currentDate, 'yyyy-MM');

  useEffect(() => {
    loadData();
  }, [currentDate]);

  const loadData = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [monthData, shiftsData, doctorsData] = await Promise.all([
        fetchMonth(yearMonth),
        fetchShiftTypes(),
        fetchDoctors(),
      ]);
      setAssignments(monthData);
      setShiftTypes(shiftsData);
      setDoctors(doctorsData);
    } catch (error: any) {
      // 黙って空のカレンダーを出すと原因が分からないので画面に出す
      console.error('Failed to load data:', error);
      setLoadError(error?.message ?? String(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssign = async (shiftTypeId: number) => {
    if (!selectedCell || !selectedCell.doctorId) return;

    try {
      await assignShift(selectedCell.doctorId, shiftTypeId, selectedCell.date);
      await loadData();
      setSelectedCell(null);
    } catch (error) {
      console.error('Failed to assign shift:', error);
    }
  };

  const handleDelete = async (assignmentId: string) => {
    try {
      await deleteAssignment(assignmentId);
      await loadData();
    } catch (error) {
      console.error('Failed to delete assignment:', error);
    }
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const firstDayOfWeek = getDay(monthStart);

  const getAssignmentsForDay = (date: string) =>
    assignments.filter((a) => a.duty_date === date);

  const handleCellClick = (date: string) => {
    if (!isAdmin) return;
    setSelectedCell({ date });
  };

  return (
    <>
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center mb-6">
              <button
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
                className="p-2 hover:bg-gray-100 rounded"
              >
                <ChevronLeft size={20} />
              </button>
              <h2 className="text-xl font-semibold">
                {format(currentDate, 'yyyy年M月', { locale: ja })}
              </h2>
              <button
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
                className="p-2 hover:bg-gray-100 rounded"
              >
                <ChevronRight size={20} />
              </button>
            </div>

            {isLoading && <div className="text-center text-gray-500 py-4">読み込み中...</div>}

            {loadError && (
              <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
                <p className="font-semibold mb-1">データの読み込みに失敗しました</p>
                <p className="break-all">{loadError}</p>
              </div>
            )}

            {!isLoading && !loadError && assignments.length === 0 && (
              <div className="mb-4 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                この月に登録された予定はありません。
              </div>
            )}

            {!isLoading && (
              <div className="overflow-x-auto">
                <div className="grid grid-cols-7 gap-1 bg-gray-100 p-1 rounded">
                  {['日', '月', '火', '水', '木', '金', '土'].map((day) => (
                    <div key={day} className="text-center font-semibold py-2 text-sm">
                      {day}
                    </div>
                  ))}

                  {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                    <div key={`empty-${i}`} className="bg-white p-2 min-h-24" />
                  ))}

                  {days.map((day) => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const dayAssignments = getAssignmentsForDay(dateStr);

                    return (
                      <div
                        key={dateStr}
                        onClick={() => handleCellClick(dateStr)}
                        className={`bg-white p-2 min-h-24 border border-gray-200 cursor-pointer transition ${
                          selectedCell?.date === dateStr ? 'ring-2 ring-blue-500' : 'hover:bg-blue-50'
                        }`}
                      >
                        <div className="font-semibold text-sm mb-1">{format(day, 'd')}</div>
                        <div className="space-y-1">
                          {dayAssignments.map((a) => (
                            <ShiftBadge
                              key={a.id}
                              assignment={a as any}
                              isAdmin={isAdmin}
                              onDelete={handleDelete}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {selectedCell && isAdmin && (
            <div className="p-6 bg-blue-50 border-t border-gray-200">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  医師を選択: {selectedCell.date}
                </label>
                <select
                  onChange={(e) => setSelectedCell({ ...selectedCell, doctorId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- 医師を選択 --</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.full_name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedCell.doctorId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    勤務種別
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {shiftTypes.map((st) => (
                      <button
                        key={st.id}
                        onClick={() => handleAssign(st.id)}
                        className="px-4 py-2 rounded text-white font-medium hover:opacity-90 transition"
                        style={{ backgroundColor: st.color }}
                      >
                        {st.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => setSelectedCell(null)}
                className="mt-4 w-full bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded"
              >
                キャンセル
              </button>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
