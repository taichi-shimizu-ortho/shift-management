import { createClient } from '@supabase/supabase-js';
import { saveGoogleToken, clearGoogleToken } from './googleToken';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase credentials. Check .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// provider_token はサインイン直後の 1 回しか流れてこないので、
// クライアント生成直後にリスナーを登録して取りこぼす。
supabase.auth.onAuthStateChange((event, session) => {
  if (session?.provider_token) {
    saveGoogleToken(session.provider_token);
  }

  // リフレッシュトークンは無期限に有効な資格情報なので、
  // localStorage には置かず Edge Function に送ってサーバ側で保管する。
  // onAuthStateChange の中で supabase の非同期 API を直接呼ぶとデッドロックするため、外に逃がす。
  if (session?.provider_refresh_token) {
    const refreshToken = session.provider_refresh_token;
    setTimeout(() => {
      supabase.functions
        .invoke('google-token', { body: { refresh_token: refreshToken } })
        .catch((err) => console.error('Failed to store Google refresh token:', err));
    }, 0);
  }

  if (event === 'SIGNED_OUT') {
    clearGoogleToken();
  }
});
