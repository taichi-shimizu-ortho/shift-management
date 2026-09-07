import { supabase } from './supabaseClient';
import { getGoogleToken, saveGoogleToken } from './googleToken';

// 有効な Google アクセストークンを返す。
// localStorage に生きているものがあればそれを使い、無ければ Edge Function に
// 再発行を依頼する（サーバー側に保管したリフレッシュトークンが使われる）。
export async function getFreshGoogleToken(): Promise<string> {
  const cached = getGoogleToken();
  if (cached) return cached;

  const { data, error } = await supabase.functions.invoke('google-token', { body: {} });

  if (error) {
    // Edge Function が 4xx/5xx を返した場合、本文の error メッセージを拾う
    const detail = await extractFunctionError(error);
    throw new Error(detail ?? 'Googleのトークン再取得に失敗しました。');
  }

  if (!data?.access_token) {
    throw new Error(data?.error ?? 'Googleのトークン再取得に失敗しました。');
  }

  saveGoogleToken(data.access_token);
  return data.access_token;
}

async function extractFunctionError(error: unknown): Promise<string | null> {
  const context = (error as { context?: Response }).context;
  if (!context || typeof context.json !== 'function') {
    return error instanceof Error ? error.message : null;
  }

  try {
    const body = await context.json();
    return body?.error ?? null;
  } catch {
    return error instanceof Error ? error.message : null;
  }
}
