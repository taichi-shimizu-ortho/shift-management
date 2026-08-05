import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../store/authStore';
import { fetchDoctors } from '../hooks/useShifts';
import type { Profile } from '../types';
import { LogOut, Edit2, Save, X } from 'lucide-react';

export function AdminDoctors() {
  const { user, logout, isAdmin } = useAuthStore();
  const navigate = useNavigate();
  const [doctors, setDoctors] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<'doctor' | 'admin'>('doctor');

  useEffect(() => {
    if (!isAdmin) {
      navigate('/calendar');
      return;
    }
    loadDoctors();
  }, [isAdmin, navigate]);

  const loadDoctors = async () => {
    setIsLoading(true);
    try {
      const data = await fetchDoctors();
      setDoctors(data);
    } catch (error) {
      console.error('Failed to load doctors:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleActive = async (doctorId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !isActive })
        .eq('id', doctorId);

      if (error) throw error;
      await loadDoctors();
    } catch (error) {
      console.error('Failed to update doctor:', error);
    }
  };

  const handleUpdateRole = async (doctorId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: editingRole })
        .eq('id', doctorId);

      if (error) throw error;
      setEditingId(null);
      await loadDoctors();
    } catch (error) {
      console.error('Failed to update role:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">医師管理</h1>
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
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">読み込み中...</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-200">
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    医師名
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    ロール
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    ステータス
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {doctors.map((doctor) => (
                  <tr key={doctor.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {doctor.full_name}
                    </td>
                    <td className="px-6 py-4">
                      {editingId === doctor.id ? (
                        <select
                          value={editingRole}
                          onChange={(e) => setEditingRole(e.target.value as 'doctor' | 'admin')}
                          className="px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="doctor">医師</option>
                          <option value="admin">管理者</option>
                        </select>
                      ) : (
                        <span className={`px-3 py-1 rounded text-sm font-medium ${
                          doctor.role === 'admin'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {doctor.role === 'admin' ? '管理者' : '医師'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded text-sm font-medium ${
                        doctor.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {doctor.is_active ? '有効' : '無効'}
                      </span>
                    </td>
                    <td className="px-6 py-4 flex gap-2">
                      {editingId === doctor.id ? (
                        <>
                          <button
                            onClick={() => handleUpdateRole(doctor.id)}
                            className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
                          >
                            <Save size={16} />
                            保存
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="flex items-center gap-1 bg-gray-300 hover:bg-gray-400 text-gray-800 px-3 py-1 rounded text-sm"
                          >
                            <X size={16} />
                            キャンセル
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setEditingId(doctor.id);
                              setEditingRole(doctor.role);
                            }}
                            className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                          >
                            <Edit2 size={16} />
                            編集
                          </button>
                          <button
                            onClick={() => handleToggleActive(doctor.id, doctor.is_active)}
                            className={`px-3 py-1 rounded text-sm font-medium text-white ${
                              doctor.is_active
                                ? 'bg-red-600 hover:bg-red-700'
                                : 'bg-green-600 hover:bg-green-700'
                            }`}
                          >
                            {doctor.is_active ? '無効化' : '有効化'}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
