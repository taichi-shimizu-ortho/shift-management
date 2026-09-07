import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuthStore } from '../store/authStore';
import { getFreshGoogleToken } from '../lib/googleAuth';

export function Settings() {
  const user = useAuthStore((state) => state.user);
  
  // 外勤リスト
  const [externalNames, setExternalNames] = useState<string[]>([]);
  const [newExternalName, setNewExternalName] = useState('');
  
  // 当直リスト
  const [nightDutyNames, setNightDutyNames] = useState<string[]>([]);
  const [newNightDutyName, setNewNightDutyName] = useState('');
  
  // 同期対象の Google カレンダーID
  const [calendarIds, setCalendarIds] = useState<string[]>([]);
  const [newCalendarId, setNewCalendarId] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (user) {
      loadSettings();
    }
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_settings')
      .select('external_duty_names, night_duty_names, calendar_ids')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      setExternalNames(data.external_duty_names || []);
      setNightDutyNames(data.night_duty_names || []);
      setCalendarIds(data.calendar_ids?.length ? data.calendar_ids : ['primary']);
    } else {
      // Default initial settings if not found in database
      setExternalNames(["新小倉", "赤池", "稲築", "タケスポ", "新庄", "芳野", "小波瀬"]);
      setNightDutyNames(["当直", "若松", "若松日当直"]);
      setCalendarIds(['primary', 'family08074183291321109187@group.calendar.google.com']);
    }
  };

  const handleAddExternal = () => {
    if (newExternalName.trim() && !externalNames.includes(newExternalName.trim())) {
      setExternalNames([...externalNames, newExternalName.trim()]);
      setNewExternalName('');
    }
  };

  const handleRemoveExternal = (nameToRemove: string) => {
    setExternalNames(externalNames.filter((name) => name !== nameToRemove));
  };

  const handleAddNightDuty = () => {
    if (newNightDutyName.trim() && !nightDutyNames.includes(newNightDutyName.trim())) {
      setNightDutyNames([...nightDutyNames, newNightDutyName.trim()]);
      setNewNightDutyName('');
    }
  };

  const handleRemoveNightDuty = (nameToRemove: string) => {
    setNightDutyNames(nightDutyNames.filter((name) => name !== nameToRemove));
  };

  const handleAddCalendar = () => {
    const id = newCalendarId.trim();
    if (id && !calendarIds.includes(id)) {
      setCalendarIds([...calendarIds, id]);
      setNewCalendarId('');
    }
  };

  const handleRemoveCalendar = (idToRemove: string) => {
    setCalendarIds(calendarIds.filter((id) => id !== idToRemove));
  };

  const saveSettings = async () => {
    if (!user) return;
    setIsSaving(true);
    setMessage('');
    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({ 
          user_id: user.id, 
          external_duty_names: externalNames,
          night_duty_names: nightDutyNames,
          calendar_ids: calendarIds
        });

      if (error) throw error;
      setMessage('設定を保存しました。');
    } catch (error: any) {
      setMessage(`エラー: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleManualSync = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert("セッションが見つかりません。");
        return;
      }

      // 期限切れなら Edge Function 経由で自動的に再発行される
      const providerToken = await getFreshGoogleToken();

      const m = await import('../services/googleCalendar');
      const result = await m.syncGoogleCalendar(providerToken);

      const lines = [
        `一致した予定: ${result.matched}件`,
        `新しく登録: ${result.added}件`,
        `登録済みのためスキップ: ${result.skipped}件`,
      ];
      if (result.calendarErrors.length > 0) {
        lines.push('', '読み込めなかったカレンダー:', ...result.calendarErrors);
      }
      if (result.unknownDoctors.length > 0) {
        lines.push(
          '',
          `医師一覧に見つからなかったため登録しなかった名前 (${result.unknownDoctors.length}人):`,
          ...result.unknownDoctors
        );
      }
      if (result.unmatched.length > 0) {
        // 予定名と設定のリストが合っていないときの手がかりになる
        lines.push('', `一致しなかった予定名 (${result.unmatched.length}種):`, ...result.unmatched);
      }
      alert(lines.join('\n'));
    } catch (err: any) {
      alert("同期中にエラーが発生しました: " + err.message);
      console.error(err);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">設定</h1>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 text-blue-800">外勤の同期設定</h2>
        <p className="text-gray-600 mb-4 text-sm">
          以下のリストに完全一致する予定を自動的に「外勤」として登録します。
        </p>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newExternalName}
            onChange={(e) => setNewExternalName(e.target.value)}
            placeholder="外勤先の名前を入力"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            onKeyDown={(e) => e.key === 'Enter' && handleAddExternal()}
          />
          <button
            onClick={handleAddExternal}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
          >
            追加
          </button>
        </div>

        <ul className="space-y-2">
          {externalNames.map((name, index) => (
            <li key={index} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-200">
              <span className="text-gray-800">{name}</span>
              <button
                onClick={() => handleRemoveExternal(name)}
                className="text-red-600 hover:text-red-800 text-sm font-medium"
              >
                削除
              </button>
            </li>
          ))}
          {externalNames.length === 0 && (
            <li className="text-gray-500 text-sm text-center py-4">登録されている名前はありません</li>
          )}
        </ul>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 text-purple-800">当直の同期設定</h2>
        <p className="text-gray-600 mb-4 text-sm">
          以下のリストに完全一致する予定を自動的に「当直」として登録します。
        </p>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newNightDutyName}
            onChange={(e) => setNewNightDutyName(e.target.value)}
            placeholder="当直の名前を入力"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            onKeyDown={(e) => e.key === 'Enter' && handleAddNightDuty()}
          />
          <button
            onClick={handleAddNightDuty}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium"
          >
            追加
          </button>
        </div>

        <ul className="space-y-2">
          {nightDutyNames.map((name, index) => (
            <li key={index} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-200">
              <span className="text-gray-800">{name}</span>
              <button
                onClick={() => handleRemoveNightDuty(name)}
                className="text-red-600 hover:text-red-800 text-sm font-medium"
              >
                削除
              </button>
            </li>
          ))}
          {nightDutyNames.length === 0 && (
            <li className="text-gray-500 text-sm text-center py-4">登録されている名前はありません</li>
          )}
        </ul>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 text-teal-800">同期するカレンダー</h2>
        <p className="text-gray-600 mb-4 text-sm">
          ここに登録した Google カレンダーから予定を取得します。
          <code className="bg-gray-100 px-1 py-0.5 rounded mx-1">primary</code>
          はログイン中のアカウント本人のカレンダーです。
          ファミリーなどの共有カレンダーは、Google カレンダーの
          「設定と共有」→「カレンダーの統合」にあるカレンダーIDを追加してください。
        </p>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newCalendarId}
            onChange={(e) => setNewCalendarId(e.target.value)}
            placeholder="例: family0123456789@group.calendar.google.com"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            onKeyDown={(e) => e.key === 'Enter' && handleAddCalendar()}
          />
          <button
            onClick={handleAddCalendar}
            className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg font-medium"
          >
            追加
          </button>
        </div>

        <ul className="space-y-2">
          {calendarIds.map((id, index) => (
            <li key={index} className="flex justify-between items-center gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
              <span className="text-gray-800 break-all text-sm">
                {id === 'primary' ? 'primary（自分のカレンダー）' : id}
              </span>
              <button
                onClick={() => handleRemoveCalendar(id)}
                className="text-red-600 hover:text-red-800 text-sm font-medium shrink-0"
              >
                削除
              </button>
            </li>
          ))}
          {calendarIds.length === 0 && (
            <li className="text-gray-500 text-sm text-center py-4">同期対象のカレンダーがありません</li>
          )}
        </ul>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={saveSettings}
          disabled={isSaving}
          className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-8 py-3 rounded-lg font-semibold transition text-lg shadow-sm"
        >
          {isSaving ? '保存中...' : '設定を保存する'}
        </button>
        <button
          onClick={handleManualSync}
          className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold transition text-lg shadow-sm"
        >
          手動で同期テストを実行
        </button>
        {message && (
          <span className={message.includes('エラー') ? 'text-red-600' : 'text-green-600 font-medium'}>
            {message}
          </span>
        )}
      </div>
    </div>
  );
}
