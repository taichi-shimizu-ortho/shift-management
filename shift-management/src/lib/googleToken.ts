// Supabase は provider_token をサインイン直後に一度しか渡さず、セッションにも永続化しない。
// そのため onAuthStateChange で受け取った時点で自前で保存しておく必要がある。
const STORAGE_KEY = 'google_provider_token';

// Google のアクセストークンの有効期限は 1 時間。少し余裕を持たせて切れたとみなす。
const TOKEN_TTL_MS = 55 * 60 * 1000;

type StoredToken = {
  token: string;
  savedAt: number;
};

export function saveGoogleToken(token: string) {
  const payload: StoredToken = { token, savedAt: Date.now() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function getGoogleToken(): string | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const { token, savedAt } = JSON.parse(raw) as StoredToken;
    if (!token || Date.now() - savedAt > TOKEN_TTL_MS) {
      clearGoogleToken();
      return null;
    }
    return token;
  } catch {
    clearGoogleToken();
    return null;
  }
}

export function clearGoogleToken() {
  localStorage.removeItem(STORAGE_KEY);
}
