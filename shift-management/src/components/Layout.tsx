import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { LogOut } from 'lucide-react';

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout, isAdmin } = useAuthStore();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-wrap gap-4 justify-between items-center">
          <Link to="/calendar" className="text-2xl font-bold text-gray-900 hover:opacity-80">
            医師シフト管理
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-gray-700 font-medium">
              {user?.full_name}
              {isAdmin && <span className="ml-2 bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm font-normal">管理者</span>}
            </span>
            <Link
              to="/calendar"
              className="text-gray-600 hover:text-blue-600 transition font-medium"
            >
              カレンダー
            </Link>
            <Link
              to="/settings"
              className="text-gray-600 hover:text-blue-600 transition font-medium"
            >
              設定
            </Link>
            {isAdmin && (
              <Link
                to="/summary"
                className="text-gray-600 hover:text-blue-600 transition font-medium"
              >
                集計
              </Link>
            )}
            <button
              onClick={logout}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded shadow-sm transition ml-2"
            >
              <LogOut size={18} />
              <span className="hidden sm:inline">ログアウト</span>
            </button>
          </div>
        </div>
      </header>
      <main>
        {children}
      </main>
    </div>
  );
}
