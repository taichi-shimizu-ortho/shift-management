import { useEffect, useState } from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { useAuthStore } from '../store/authStore';
import { fetchCounts } from '../hooks/useShifts';
import type { MonthlyCounts } from '../types';
import { ChevronLeft, ChevronRight, LogOut } from 'lucide-react';

export function Summary() {
  const { user, logout } = useAuthStore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [counts, setCounts] = useState<MonthlyCounts[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const yearMonth = format(currentDate, 'yyyy-MM');

  useEffect(() => {
    loadCounts();
  }, [currentDate]);

  const loadCounts = async () => {
    setIsLoading(true);
    try {
      const data = await fetchCounts(yearMonth);
      setCounts(data);
    } catch (error) {
      console.error('Failed to load counts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // グループ化: 医師ごと
  const groupedData = counts.reduce(
    (acc, item) => {
      if (!acc[item.doctor_id]) {
        acc[item.doctor_id] = { full_name: item.full_name, shifts: [] };
      }
      acc[item.doctor_id].shifts.push(item);
      return acc;
    },
    {} as Record<string, { full_name: string; shifts: MonthlyCounts[] }>
  );

  const doctors = Object.values(groupedData);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">月別集計</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-700">{user?.full_name}</span>
            <button
              onClick={logout}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
            >
              <LogOut size={18} />
              ログアウト
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <button
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
                className="p-2 hover:bg-gray-100 rounded"
              >
                <ChevronLeft size={20} />
              </button>
              <h2 className="text-xl font-semibold">
                {format(currentDate, 'yyyy年M月')}
              </h2>
              <button
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
                className="p-2 hover:bg-gray-100 rounded"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="text-center py-8 text-gray-500">読み込み中...</div>
            ) : doctors.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                この月のデータがありません
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-200">
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                      医師名
                    </th>
                    {/* シフト種別のヘッダ */}
                    {Array.from(
                      new Set(counts.flatMap((c) => c.shift_name))
                    ).map((shiftName) => (
                      <th key={shiftName} className="px-6 py-3 text-center text-sm font-semibold text-gray-700">
                        {shiftName}
                      </th>
                    ))}
                    <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">
                      合計
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {doctors.map((doctor) => {
                    const shiftNames = Array.from(
                      new Set(counts.flatMap((c) => c.shift_name))
                    );
                    const total = doctor.shifts.reduce((sum, s) => sum + s.cnt, 0);

                    return (
                      <tr key={doctor.full_name} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="px-6 py-3 font-medium text-gray-900">
                          {doctor.full_name}
                        </td>
                        {shiftNames.map((shiftName) => {
                          const count = doctor.shifts.find((s) => s.shift_name === shiftName)?.cnt ?? 0;
                          return (
                            <td key={shiftName} className="px-6 py-3 text-center text-gray-700">
                              {count}
                            </td>
                          );
                        })}
                        <td className="px-6 py-3 text-center font-semibold text-gray-900">
                          {total}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
